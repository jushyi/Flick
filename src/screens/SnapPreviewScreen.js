/**
 * SnapPreviewScreen — Polaroid-framed snap preview with caption input
 *
 * Shown after capturing a snap photo in snap mode. Displays the captured image
 * inside a Polaroid frame with a WYSIWYG caption input in the thick bottom strip.
 * User can retake (X button or swipe-down), type a caption, and send.
 *
 * Route params:
 *   photoUri         - Local URI of captured photo
 *   conversationId   - Target conversation document ID
 *   friendId         - Recipient user ID
 *   friendDisplayName - Recipient display name (shown in "To:" header)
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';

import { useNavigation, useRoute } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { uploadAndSendSnap } from '../services/firebase/snapService';

import PixelIcon from '../components/PixelIcon';

import { useAuth } from '../context/AuthContext';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import logger from '../utils/logger';

// Polaroid frame constants
const POLAROID_BORDER = 8; // Thin white border on top and sides
const POLAROID_STRIP_HEIGHT = 64; // Thick white strip at bottom for caption
const SWIPE_DISMISS_THRESHOLD = 120; // Pixels of downward swipe to dismiss

const SnapPreviewScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  const { photoUri, conversationId, friendId, friendDisplayName } = route.params;

  const [caption, setCaption] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Swipe-down dismiss animation
  const translateY = useSharedValue(0);

  // Calculate Polaroid dimensions based on screen width
  const polaroidWidth = screenWidth - 48; // 24px margin on each side
  const photoWidth = polaroidWidth - POLAROID_BORDER * 2;
  const photoHeight = photoWidth * (4 / 3); // 4:3 aspect ratio

  // Handle retake / dismiss — go back to camera (stays in snap mode)
  const handleDismiss = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Swipe-down gesture to discard
  const panGesture = Gesture.Pan()
    .onUpdate(event => {
      // Only allow downward swipe
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd(event => {
      if (event.translationY > SWIPE_DISMISS_THRESHOLD) {
        runOnJS(handleDismiss)();
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Handle send snap
  const handleSend = useCallback(async () => {
    if (isSending) return;

    setIsSending(true);
    logger.info('SnapPreviewScreen: Sending snap', {
      conversationId,
      friendId,
      hasCaption: !!caption,
    });

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const result = await uploadAndSendSnap(conversationId, user.uid, photoUri, caption || null);

      if (result.success) {
        logger.info('SnapPreviewScreen: Snap sent successfully', {
          messageId: result.messageId,
        });
        // Navigate back to conversation (pop SnapPreviewScreen and SnapCamera)
        navigation.pop(2);
      } else if (result.retriesExhausted) {
        Alert.alert('Failed to send snap', 'Please check your connection and try again.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => handleSend() },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to send snap');
      }
    } catch (error) {
      logger.error('SnapPreviewScreen: Unexpected error sending snap', {
        error: error.message,
      });
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsSending(false);
    }
  }, [isSending, conversationId, user.uid, photoUri, caption, navigation]);

  return (
    <GestureHandlerRootView style={screenStyles.root}>
      <KeyboardAvoidingView
        style={screenStyles.container}
        behavior={Platform.select({ ios: 'padding', android: 'height' })}
        keyboardVerticalOffset={Platform.select({ ios: 60, android: 0 })}
      >
        {/* "To: RecipientName" header */}
        <View style={screenStyles.header}>
          {/* X close / retake button */}
          <TouchableOpacity
            style={screenStyles.closeButton}
            onPress={handleDismiss}
            activeOpacity={0.7}
          >
            <PixelIcon name="close" size={20} color={colors.icon.primary} />
          </TouchableOpacity>

          <Text style={screenStyles.recipientLabel}>To: {friendDisplayName || 'Friend'}</Text>

          {/* Spacer to balance layout */}
          <View style={screenStyles.headerSpacer} />
        </View>

        {/* Polaroid frame with swipe-down gesture */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[screenStyles.polaroidOuter, animatedStyle]}>
            <View style={[screenStyles.polaroidFrame, { width: polaroidWidth }]}>
              {/* Photo inside Polaroid */}
              <Image
                source={{ uri: photoUri }}
                style={[screenStyles.photo, { width: photoWidth, height: photoHeight }]}
                contentFit="cover"
              />

              {/* Thick bottom strip with caption input */}
              <View style={[screenStyles.captionStrip, { width: polaroidWidth }]}>
                <TextInput
                  style={screenStyles.captionInput}
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Write something!"
                  placeholderTextColor={colors.text.tertiary}
                  maxLength={150}
                  multiline={false}
                  returnKeyType="done"
                  blurOnSubmit
                  editable={!isSending}
                />
              </View>
            </View>
          </Animated.View>
        </GestureDetector>

        {/* Bottom controls: send button */}
        <View style={screenStyles.bottomBar}>
          <TouchableOpacity
            style={[screenStyles.sendButton, isSending && screenStyles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={isSending}
            activeOpacity={0.7}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.text.inverse} />
            ) : (
              <PixelIcon name="arrow-up" size={24} color={colors.text.inverse} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
};

const screenStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  // Header: "To: RecipientName"
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.select({ ios: 56, android: 40 }),
    paddingBottom: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipientLabel: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  // Polaroid frame
  polaroidOuter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  polaroidFrame: {
    backgroundColor: '#FFFFFF',
    padding: POLAROID_BORDER,
    paddingBottom: 0, // Bottom strip handles its own spacing
    borderRadius: 2,
    // Shadow for depth
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  photo: {
    borderRadius: 1,
  },
  // Caption strip at bottom of Polaroid
  captionStrip: {
    height: POLAROID_STRIP_HEIGHT,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  captionInput: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
    color: '#1A1A1A',
    padding: 0,
    margin: 0,
    textAlignVertical: 'center',
  },
  // Bottom bar with send button
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: Platform.select({ ios: 40, android: 24 }),
    paddingTop: 12,
  },
  sendButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.status.developing, // Amber/yellow - matches snap theme
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

export default SnapPreviewScreen;
