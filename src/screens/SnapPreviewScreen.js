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

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  Keyboard,
} from 'react-native';

import { useNavigation, useRoute } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedKeyboard,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { uploadAndSendSnap } from '../services/firebase/snapService';

import PixelIcon from '../components/PixelIcon';
import PinToggle from '../components/PinToggle';
import PinTooltip from '../components/PinTooltip';

import { useAuth } from '../context/AuthContext';

import usePinPreference from '../hooks/usePinPreference';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import logger from '../utils/logger';

// Polaroid frame constants
const POLAROID_BORDER = 16; // Thick white border on top and sides (realistic Polaroid)
const POLAROID_STRIP_HEIGHT = 64; // Thick white strip at bottom for caption
const SWIPE_DISMISS_THRESHOLD = 120; // Pixels of downward swipe to dismiss

const SnapPreviewScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const { photoUri, conversationId, friendId, friendDisplayName } = route.params;

  const [caption, setCaption] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Pin-to-screen preference (per-friend sticky, iOS-only)
  const {
    pinEnabled,
    togglePin,
    loaded: pinLoaded,
    showTooltip,
    dismissTooltip,
  } = usePinPreference(friendId);

  // Pin toggle only renders in one-on-one conversations (route always targets a single friend)
  const isOneOnOne = true;

  // Swipe-down dismiss animation
  const translateY = useSharedValue(0);

  // Calculate Polaroid dimensions based on screen width
  const polaroidWidth = screenWidth - 48; // 24px margin on each side
  const photoWidth = polaroidWidth - POLAROID_BORDER * 2;
  const photoHeight = photoWidth * (4 / 3); // 4:3 aspect ratio

  // Keyboard offset — replaces KAV which doesn't account for suggestions/autocomplete bar.
  // useAnimatedKeyboard provides native tracking (iOS);
  // JS keyboard events are the fallback (Android with edgeToEdgeEnabled).
  const keyboard = useAnimatedKeyboard();
  const jsKeyboardHeight = useSharedValue(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, e => {
      jsKeyboardHeight.value = e.endCoordinates.height;
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      jsKeyboardHeight.value = 0;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [jsKeyboardHeight]);

  const keyboardOffsetStyle = useAnimatedStyle(() => {
    const nativeHeight = keyboard.height.value;
    const jsHeight = jsKeyboardHeight.value;
    const kbHeight = nativeHeight > 0 ? nativeHeight : jsHeight;
    return {
      transform: [{ translateY: -kbHeight * 0.56 }],
    };
  });

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

    Keyboard.dismiss();
    setIsSending(true);
    logger.info('SnapPreviewScreen: Sending snap', {
      conversationId,
      friendId,
      hasCaption: !!caption,
    });

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const result = await uploadAndSendSnap(conversationId, user.uid, photoUri, caption || null, {
        pinToScreen: pinEnabled && isOneOnOne,
      });

      if (result.success) {
        logger.info('SnapPreviewScreen: Snap sent successfully', {
          messageId: result.messageId,
        });
        // Pop all snap screens off the root stack, then navigate into the Conversation.
        // popToTop removes SnapPreview + SnapCamera, revealing MainTabs.
        // The navigate call ensures the Messages tab's Conversation screen is focused
        // (Material Top Tabs may reset nested stack state on tab blur, so we explicitly
        // navigate rather than relying on preserved state).
        navigation.popToTop();
        setTimeout(() => {
          navigation.navigate('MainTabs', {
            screen: 'Messages',
            params: {
              screen: 'Conversation',
              params: {
                conversationId,
                friendId,
                friendProfile: {
                  uid: friendId,
                  displayName: friendDisplayName || 'Friend',
                },
              },
            },
          });
        }, 100);
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
  }, [
    isSending,
    conversationId,
    friendId,
    friendDisplayName,
    user.uid,
    photoUri,
    caption,
    pinEnabled,
    isOneOnOne,
    navigation,
  ]);

  return (
    <GestureHandlerRootView style={screenStyles.root}>
      <View style={screenStyles.container}>
        {/* Header: X close + "To: RecipientName" */}
        <View style={[screenStyles.header, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
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

        {/* Polaroid frame — Reanimated keyboard offset replaces KAV which doesn't
            account for suggestions/autocomplete bar on either platform */}
        <Animated.View style={[{ flex: 1 }, keyboardOffsetStyle]}>
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
                <View style={screenStyles.captionStrip}>
                  <TextInput
                    style={screenStyles.captionInput}
                    value={caption}
                    onChangeText={setCaption}
                    placeholder="Write something!"
                    placeholderTextColor="#999999"
                    maxLength={150}
                    multiline={false}
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={() => Keyboard.dismiss()}
                    autoCorrect
                    autoComplete="off"
                    keyboardAppearance="dark"
                    editable={!isSending}
                  />
                </View>
              </View>
            </Animated.View>
          </GestureDetector>
        </Animated.View>

        {/* Pin toggle — between Polaroid and send button, iOS 1:1 conversations only */}
        {pinLoaded && isOneOnOne && (
          <View style={screenStyles.pinToggleContainer}>
            <PinToggle enabled={pinEnabled} onToggle={togglePin} disabled={isSending} />
            <PinTooltip visible={showTooltip && pinLoaded} onDismiss={dismissTooltip} />
          </View>
        )}

        {/* Footer: wide send button — outside KAV so it stays fixed at screen bottom */}
        <View style={[screenStyles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <TouchableOpacity
            style={[screenStyles.sendButton, isSending && screenStyles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={isSending}
            activeOpacity={0.7}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.text.inverse} />
            ) : (
              <View style={screenStyles.sendButtonContent}>
                <PixelIcon name="arrow-up" size={18} color={colors.text.inverse} />
                <Text style={screenStyles.sendButtonText}>Send</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
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
    paddingBottom: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      android: { marginTop: -2 },
      ios: {},
    }),
  },
  recipientLabel: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
    textAlign: 'center',
    height: 36,
    lineHeight: 36,
    includeFontPadding: false,
    textAlignVertical: 'center',
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
    backgroundColor: '#1A1A1A',
    overflow: 'hidden',
  },
  // Caption strip at bottom of Polaroid — uses frame padding for horizontal inset
  captionStrip: {
    height: POLAROID_STRIP_HEIGHT,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingHorizontal: POLAROID_BORDER,
  },
  captionInput: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: '#1A1A1A',
    padding: 0,
    margin: 0,
    textAlignVertical: 'center',
  },
  // Pin toggle container between Polaroid and footer
  pinToggleContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
  },
  // Footer with wide send button
  footer: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  sendButton: {
    height: 48,
    borderRadius: 4,
    backgroundColor: colors.status.developing, // Amber/yellow - matches snap theme
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sendButtonText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.inverse,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

export default SnapPreviewScreen;
