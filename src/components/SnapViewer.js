/**
 * SnapViewer - Full-screen view-once snap display with Polaroid frame
 *
 * Displays a snap message in an immersive full-screen overlay with:
 * - Black background
 * - Centered Polaroid frame (white border, photo, caption strip)
 * - X close button in top-right corner
 * - Swipe-down dismiss gesture with haptic feedback
 * - Image loaded via short-lived signed URL (cachePolicy="none")
 * - Marks snap as viewed on dismiss
 *
 * No timer -- user views at own pace until dismissed.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  useWindowDimensions,
  StatusBar,
  Platform,
  BackHandler,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  TouchableOpacity as GHTouchableOpacity,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSignedSnapUrl, markSnapViewed } from '../services/firebase/snapService';

import PixelIcon from './PixelIcon';
import PixelSpinner from './PixelSpinner';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

import logger from '../utils/logger';

const DISMISS_THRESHOLD = 100;
const POLAROID_BORDER = 8;
const POLAROID_BOTTOM_STRIP = 64;

const SnapViewer = ({ visible, snapMessage, conversationId, onClose, senderName }) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // Gesture shared values
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  // Calculate Polaroid dimensions (4:3 aspect ratio photo, centered)
  const maxWidth = screenWidth - 48; // 24px margin on each side
  const photoWidth = Math.min(maxWidth, 340);
  const photoHeight = photoWidth * (4 / 3);
  const polaroidWidth = photoWidth + POLAROID_BORDER * 2;
  const polaroidHeight = photoHeight + POLAROID_BORDER + POLAROID_BOTTOM_STRIP;

  // Load signed URL when visible
  useEffect(() => {
    if (!visible || !snapMessage?.snapStoragePath) {
      setImageUrl(null);
      setLoading(true);
      setImageError(false);
      return;
    }

    let cancelled = false;

    const loadUrl = async () => {
      setLoading(true);
      setImageError(false);

      const result = await getSignedSnapUrl(snapMessage.snapStoragePath);

      if (cancelled) return;

      if (result.success && result.url) {
        setImageUrl(result.url);
        setLoading(false);
      } else {
        logger.error('SnapViewer: Failed to load signed URL', {
          snapStoragePath: snapMessage.snapStoragePath,
          error: result.error,
        });
        setImageError(true);
        setLoading(false);
      }
    };

    loadUrl();

    return () => {
      cancelled = true;
    };
  }, [visible, snapMessage?.snapStoragePath]);

  // Reset gesture values when opening
  useEffect(() => {
    if (visible) {
      translateY.value = 0;
      opacity.value = 1;
    }
  }, [visible, translateY, opacity]);

  const handleDismiss = useCallback(async () => {
    if (!conversationId || !snapMessage?.id) {
      onClose?.();
      return;
    }

    // Mark snap as viewed
    const result = await markSnapViewed(conversationId, snapMessage.id);
    if (!result.success) {
      logger.warn('SnapViewer: Failed to mark snap as viewed', {
        conversationId,
        messageId: snapMessage.id,
        error: result.error,
      });
    }

    // Trigger haptic feedback on dismiss
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    onClose?.();
  }, [conversationId, snapMessage?.id, onClose]);

  // Handle Android back button
  useEffect(() => {
    if (!visible) return;

    const handleBackPress = () => {
      handleDismiss();
      return true;
    };

    if (Platform.OS === 'android') {
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      return () => subscription.remove();
    }
  }, [visible, handleDismiss]);

  // Swipe-down dismiss gesture
  const panGesture = Gesture.Pan()
    .onUpdate(event => {
      'worklet';
      // Only track downward movement
      const yTranslation = Math.max(0, event.translationY);
      translateY.value = yTranslation;
      // Fade opacity as user swipes down
      opacity.value = 1 - yTranslation / (DISMISS_THRESHOLD * 3);
    })
    .onEnd(event => {
      'worklet';
      if (event.translationY >= DISMISS_THRESHOLD) {
        // Dismiss
        translateY.value = withTiming(screenHeight, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 });
        runOnJS(handleDismiss)();
      } else {
        // Snap back
        translateY.value = withTiming(0, { duration: 200 });
        opacity.value = withTiming(1, { duration: 200 });
      }
    });

  const animatedPolaroidStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible || !snapMessage) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <StatusBar hidden />
        <Animated.View style={[styles.overlay, animatedOverlayStyle]}>
          {/* Close button */}
          <View style={[styles.closeButtonContainer, { top: insets.top + 16 }]}>
            <GHTouchableOpacity
              onPress={handleDismiss}
              style={styles.closeButton}
              activeOpacity={0.7}
              accessibilityLabel="Close snap"
              accessibilityRole="button"
            >
              <PixelIcon name="close" size={24} color={colors.text.primary} />
            </GHTouchableOpacity>
          </View>

          {/* Sender name */}
          {senderName && (
            <Text style={[styles.senderName, { top: insets.top + 20 }]}>{senderName}</Text>
          )}

          {/* Polaroid frame with gesture */}
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.polaroidContainer, animatedPolaroidStyle]}>
              <View style={[styles.polaroid, { width: polaroidWidth, height: polaroidHeight }]}>
                {/* Photo area */}
                <View style={[styles.photoContainer, { width: photoWidth, height: photoHeight }]}>
                  {loading ? (
                    <View style={styles.loadingContainer}>
                      <PixelSpinner size="large" color={colors.text.primary} />
                    </View>
                  ) : imageError ? (
                    <View style={styles.errorContainer}>
                      <PixelIcon name="warning" size={32} color={colors.status.danger} />
                      <Text style={styles.errorText}>Failed to load snap</Text>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.snapImage}
                      contentFit="contain"
                      cachePolicy="none"
                      transition={0}
                    />
                  )}
                </View>

                {/* Caption strip (always visible per user decision) */}
                <View style={styles.captionStrip}>
                  {snapMessage.caption ? (
                    <Text style={styles.captionText} numberOfLines={2}>
                      {snapMessage.caption}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Animated.View>
          </GestureDetector>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  senderName: {
    position: 'absolute',
    left: 16,
    fontSize: 14,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
  },
  polaroidContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  polaroid: {
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    padding: POLAROID_BORDER,
    paddingBottom: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  photoContainer: {
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  snapImage: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
  },
  captionStrip: {
    height: POLAROID_BOTTOM_STRIP,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  captionText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.body,
    color: '#0A0A1A',
    textAlign: 'center',
  },
});

export default SnapViewer;
