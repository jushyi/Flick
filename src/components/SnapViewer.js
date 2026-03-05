/**
 * SnapViewer - Full-screen view-once snap display with Polaroid frame
 *
 * Displays a snap message in an immersive full-screen overlay with:
 * - Semi-transparent background (conversation visible behind)
 * - Centered Polaroid frame (white border, photo, caption strip)
 * - Reaction bar below Polaroid for recipients (6 emoji buttons)
 * - X close button in top-right corner
 * - Expand-from-source / suck-back-to-source animation (matching story viewer)
 * - Swipe-down dismiss gesture with scale-down effect and haptic feedback
 * - Image loaded via short-lived signed URL (cachePolicy="none")
 * - Marks snap as viewed on dismiss
 *
 * No timer -- user views at own pace until dismissed.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
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
  interpolate,
  Easing as ReanimatedEasing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSignedSnapUrl, markSnapViewed } from '../services/firebase/snapService';
import { endPinnedSnapActivity } from '../services/liveActivityService';

import PixelIcon from './PixelIcon';
import PixelSpinner from './PixelSpinner';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

import logger from '../utils/logger';

const DISMISS_THRESHOLD = 100;
const POLAROID_BORDER = 8;
const POLAROID_BOTTOM_STRIP = 64;

const REACTION_EMOJIS = [
  { key: 'heart', char: '\u2764\uFE0F' },
  { key: 'laugh', char: '\uD83D\uDE02' },
  { key: 'surprise', char: '\uD83D\uDE2E' },
  { key: 'sad', char: '\uD83D\uDE22' },
  { key: 'angry', char: '\uD83D\uDE21' },
  { key: 'thumbs_up', char: '\uD83D\uDC4D' },
];

const SnapViewer = ({
  visible,
  snapMessage,
  conversationId,
  onClose,
  senderName,
  onReaction,
  currentUserId,
  sourceRect,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState(null);

  // Gesture shared values
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  // Expand/collapse animation values
  const openProgress = useSharedValue(0); // 0 = source position, 1 = full screen
  const scale = useSharedValue(1); // Shrinks during swipe-down drag
  const animTranslateX = useSharedValue(0);

  // Track whether close animation is in progress to avoid double-dismiss
  const isClosingRef = useRef(false);

  // Source rect ref for close animation (stable across re-renders)
  const sourceRectRef = useRef(sourceRect);
  sourceRectRef.current = sourceRect;

  // Compute source transform from sourceRect
  const sourceTransform = useMemo(() => {
    if (!sourceRect) return null;
    const scaleX = sourceRect.width / screenWidth;
    const scaleY = sourceRect.height / screenHeight;
    const s = Math.min(scaleX, scaleY);
    const cx = sourceRect.x + sourceRect.width / 2;
    const cy = sourceRect.y + sourceRect.height / 2;
    return {
      scale: s,
      translateX: cx - screenWidth / 2,
      translateY: cy - screenHeight / 2,
      borderRadius: sourceRect.borderRadius || 4,
    };
  }, [sourceRect, screenWidth, screenHeight]);

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
      setSelectedReaction(null);
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

  // Opening animation — expand from source or fade in
  useEffect(() => {
    if (!visible) {
      isClosingRef.current = false;
      return;
    }

    isClosingRef.current = false;
    translateY.value = 0;
    scale.value = 1;
    animTranslateX.value = 0;

    if (sourceTransform) {
      // Start at source position, animate to full screen
      openProgress.value = 0;
      opacity.value = 0;

      // Animate expand
      openProgress.value = withTiming(1, {
        duration: 280,
        easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
      });
      opacity.value = withTiming(1, { duration: 150 });
    } else {
      // Fallback: fade in (no source rect, e.g. notification deep link)
      openProgress.value = 1;
      opacity.value = withTiming(1, { duration: 200 });
    }
  }, [visible, sourceTransform, translateY, opacity, openProgress, scale, animTranslateX]);

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

    // End Live Activity for pinned snaps (iOS only, best-effort)
    if (result.success && snapMessage.pinned && Platform.OS === 'ios') {
      try {
        await endPinnedSnapActivity(snapMessage.id || snapMessage.pinnedActivityId);
        logger.info('SnapViewer: Ended Live Activity for pinned snap', {
          activityId: snapMessage.id || snapMessage.pinnedActivityId,
        });
      } catch (err) {
        logger.warn('SnapViewer: Failed to end Live Activity', {
          error: err.message,
        });
      }
    }

    // Trigger haptic feedback on dismiss
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    onClose?.();
  }, [
    conversationId,
    snapMessage?.id,
    snapMessage?.pinned,
    snapMessage?.pinnedActivityId,
    onClose,
  ]);

  // Close with suck-back or slide-down animation
  const closeWithAnimation = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    const source = sourceRectRef.current;
    const transform = source
      ? {
          scale: Math.min(source.width / screenWidth, source.height / screenHeight),
          translateX: source.x + source.width / 2 - screenWidth / 2,
          translateY: source.y + source.height / 2 - screenHeight / 2,
        }
      : null;

    if (transform) {
      // Suck-back to source position
      const suckDuration = 200;
      const easeIn = ReanimatedEasing.in(ReanimatedEasing.cubic);

      openProgress.value = withTiming(0, { duration: suckDuration, easing: easeIn });
      animTranslateX.value = withTiming(0, { duration: suckDuration, easing: easeIn });
      translateY.value = withTiming(0, { duration: suckDuration, easing: easeIn });
      scale.value = withTiming(1, { duration: suckDuration, easing: easeIn });
      opacity.value = withTiming(0, { duration: suckDuration }, () => {
        runOnJS(handleDismiss)();
      });
    } else {
      // Fallback: slide down + fade
      translateY.value = withTiming(screenHeight, { duration: 220 });
      opacity.value = withTiming(0, { duration: 220 }, () => {
        runOnJS(handleDismiss)();
      });
    }
  }, [
    screenWidth,
    screenHeight,
    handleDismiss,
    openProgress,
    animTranslateX,
    translateY,
    scale,
    opacity,
  ]);

  // Handle Android back button
  useEffect(() => {
    if (!visible) return;

    const handleBackPress = () => {
      closeWithAnimation();
      return true;
    };

    if (Platform.OS === 'android') {
      const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      return () => subscription.remove();
    }
  }, [visible, closeWithAnimation]);

  // Swipe-down dismiss gesture
  const panGesture = Gesture.Pan()
    .onUpdate(event => {
      'worklet';
      // Only track downward movement
      const yTranslation = Math.max(0, event.translationY);
      translateY.value = yTranslation;
      // Fade opacity as user swipes down
      opacity.value = 1 - yTranslation / (DISMISS_THRESHOLD * 3);
      // Scale down slightly while dragging (matching stories feel)
      scale.value = 1 - yTranslation / (screenHeight * 3);
    })
    .onEnd(event => {
      'worklet';
      if (event.translationY >= DISMISS_THRESHOLD) {
        // Dismiss with animation
        runOnJS(closeWithAnimation)();
      } else {
        // Snap back
        translateY.value = withTiming(0, { duration: 200 });
        opacity.value = withTiming(1, { duration: 200 });
        scale.value = withTiming(1, { duration: 200 });
      }
    });

  // Animated style for polaroid container — interpolates between source and full-screen
  const animatedPolaroidStyle = useAnimatedStyle(() => {
    if (!sourceTransform) {
      // Fallback: just translateY (existing swipe behavior) + scale
      return {
        transform: [{ translateY: translateY.value }, { scale: scale.value }],
      };
    }

    const progress = openProgress.value;
    const currentScale = interpolate(progress, [0, 1], [sourceTransform.scale, 1]) * scale.value;
    const currentTX =
      interpolate(progress, [0, 1], [sourceTransform.translateX, 0]) + animTranslateX.value;
    const currentTY =
      interpolate(progress, [0, 1], [sourceTransform.translateY, 0]) + translateY.value;

    return {
      transform: [{ translateX: currentTX }, { translateY: currentTY }, { scale: currentScale }],
    };
  });

  // Animated overlay opacity
  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  // Determine if reaction bar should be shown (only for recipients, not senders)
  const isRecipient = currentUserId && snapMessage?.senderId !== currentUserId;
  const showReactionBar = onReaction && isRecipient;

  const handleReactionPress = useCallback(
    emojiKey => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedReaction(emojiKey);
      onReaction?.(emojiKey);
    },
    [onReaction]
  );

  if (!visible || !snapMessage) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeWithAnimation}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <StatusBar hidden />
        <Animated.View style={[styles.overlay, animatedOverlayStyle]}>
          {/* Close button */}
          <View style={[styles.closeButtonContainer, { top: insets.top + 16 }]}>
            <GHTouchableOpacity
              onPress={closeWithAnimation}
              style={styles.closeButton}
              activeOpacity={0.7}
              accessibilityLabel="Close snap"
              accessibilityRole="button"
            >
              <PixelIcon name="close" size={24} color={colors.text.primary} />
            </GHTouchableOpacity>
          </View>

          {/* Polaroid frame with gesture */}
          <Animated.View style={[styles.polaroidContainer, animatedPolaroidStyle]}>
            <GestureDetector gesture={panGesture}>
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
                      contentFit="cover"
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
            </GestureDetector>

            {/* Reaction bar — OUTSIDE GestureDetector so taps work */}
            {showReactionBar && (
              <View style={styles.reactionBar}>
                {REACTION_EMOJIS.map(emoji => (
                  <Pressable
                    key={emoji.key}
                    style={({ pressed }) => [
                      styles.reactionButton,
                      selectedReaction === emoji.key && styles.reactionButtonSelected,
                      pressed && styles.reactionButtonPressed,
                    ]}
                    onPress={() => handleReactionPress(emoji.key)}
                  >
                    <Text style={styles.reactionEmoji}>{emoji.char}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Animated.View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
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
  reactionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: colors.background.secondary,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: colors.border.default,
  },
  reactionButton: {
    width: 40,
    height: 40,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  reactionButtonSelected: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 2,
    borderColor: colors.interactive.primary,
  },
  reactionButtonPressed: {
    backgroundColor: colors.background.tertiary,
  },
  reactionEmoji: {
    fontSize: 22,
  },
});

export default SnapViewer;
