/**
 * SwipeablePhotoCard - Swipeable card for photo triage
 *
 * Features:
 * - On-card overlays: Color overlays with icons fade in during swipe
 * - Three-stage haptic feedback: threshold, release, completion
 * - Spring-back animation when threshold not met
 * - Imperative methods for button-triggered animations
 *
 * Swipe directions:
 * - Up swipe → Journal (cyan overlay, checkmark icon)
 * - Down swipe → Archive (amber overlay, box icon)
 * - Delete via button only (red overlay, X icon, falls down)
 *
 * @param {object} photo - Photo object to display
 * @param {function} onSwipeLeft - Callback when Archive action triggered (down swipe or button)
 * @param {function} onSwipeRight - Callback when Journal action triggered (up swipe or button)
 * @param {function} onSwipeDown - Callback when Delete action triggered (button only)
 * @param {number} stackIndex - Position in the stack (0=front, 1=behind, 2=furthest back)
 * @param {boolean} isActive - Whether this card is swipeable (only front card)
 * @param {ref} ref - Ref for imperative methods (triggerArchive, triggerJournal, triggerDelete)
 */

import { forwardRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet as RNStyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import PixelIcon from './PixelIcon';
import VideoPlayer from './VideoPlayer';
import logger from '../utils/logger';
import useSwipeableCard from '../hooks/useSwipeableCard';
import { styles } from '../styles/SwipeablePhotoCard.styles';
import { colors } from '../constants/colors';

type Props = {
  photo: Record<string, unknown>;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeDown?: () => void;
  onDeleteComplete?: () => void;
  onExitClearance?: () => void;
  onTagPress?: () => void;
  hasTagged?: boolean;
  caption?: string;
  onCaptionChange?: (text: string) => void;
  keyboardVisible?: boolean;
  stackIndex?: number;
  [key: string]: unknown;
};

const SwipeablePhotoCard = forwardRef(
  (
    {
      photo,
      onSwipeLeft,
      onSwipeRight,
      onSwipeDown,
      onDeleteComplete,
      onExitClearance,
      onTagPress,
      hasTagged,
      caption,
      onCaptionChange,
      keyboardVisible,
      stackIndex = 0,
      isActive = true,
      enterFrom = null,
      isNewlyVisible = false,
    },
    ref
  ) => {
    const { cardStyle, archiveOverlayStyle, journalOverlayStyle, deleteOverlayStyle, panGesture } =
      useSwipeableCard({
        photo,
        onSwipeLeft,
        onSwipeRight,
        onSwipeDown,
        onDeleteComplete,
        onExitClearance,
        stackIndex,
        isActive,
        enterFrom,
        isNewlyVisible,
        keyboardVisible,
        ref,
      });

    const isVideo = photo?.mediaType === 'video';
    if (!photo || (!photo.imageURL && !photo.videoURL)) {
      logger.warn('SwipeablePhotoCard: Missing photo or media URL', { photo });
      return null;
    }

    // Stack z-index: front card has highest z (3 - stackIndex)
    const zIndex = 3 - stackIndex;

    // Card content (shared between active and stack cards)
    const cardContent = (
      <Animated.View
        style={[
          styles.cardContainer,
          cardStyle,
          { zIndex },
          // Stack cards have no pointer events
          !isActive && { pointerEvents: 'none' },
        ]}
      >
        {/* Media content: VideoPlayer for active video cards, Image for photos/stack */}
        {isVideo && isActive ? (
          <VideoPlayer
            source={photo.videoURL}
            style={styles.photoImage}
            isMuted={false}
            autoPlay
            loop
            showControls
            showProgressBar={false}
            controlsPosition="top"
          />
        ) : isVideo ? (
          <View style={[styles.photoImage, darkroomVideoStyles.videoPlaceholder]}>
            <PixelIcon name="play" size={32} color={colors.text.primary} />
          </View>
        ) : (
          <Image
            source={{ uri: photo.imageURL, cacheKey: `photo-${photo.id}` }}
            style={styles.photoImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            onError={error =>
              logger.error('SwipeablePhotoCard: Image load error', {
                photoId: photo.id,
                error: error.error,
              })
            }
            onLoad={() =>
              logger.debug('SwipeablePhotoCard: Image loaded successfully', {
                photoId: photo.id,
              })
            }
          />
        )}

        {/* Video icon overlay - shows play badge for video stack cards */}
        {isVideo && !isActive && (
          <View style={darkroomVideoStyles.videoIcon}>
            <PixelIcon name="play" size={12} color={colors.text.primary} />
          </View>
        )}

        {/* Caption input - only on active front card */}
        {stackIndex === 0 && onCaptionChange && (
          <View style={styles.captionInputContainer}>
            <TextInput
              style={styles.captionInput}
              placeholder="Add a caption..."
              placeholderTextColor={colors.text.tertiary}
              value={caption || ''}
              onChangeText={onCaptionChange}
              maxLength={100}
              multiline
              scrollEnabled={false}
              keyboardAppearance="dark"
              returnKeyType="done"
              blurOnSubmit={true}
              cursorColor={colors.interactive.primary}
              selectionColor={colors.interactive.primary}
              includeFontPadding={false}
            />
            {(caption || '').length >= 80 && (
              <Text style={styles.captionCounter}>{(caption || '').length}/100</Text>
            )}
          </View>
        )}

        {/* Tag Button Overlay - only on active card when onTagPress provided */}
        {onTagPress && (
          <TouchableOpacity
            style={styles.tagOverlayButton}
            onPress={onTagPress}
            activeOpacity={0.7}
          >
            <PixelIcon
              name={hasTagged ? 'people-outline' : 'person-add-outline'}
              size={20}
              color={colors.icon.primary}
            />
            {hasTagged && <View style={styles.tagOverlayBadge} />}
          </TouchableOpacity>
        )}

        {/* Journal Overlay (up swipe) - cyan with checkmark */}
        {isActive && (
          <Animated.View style={[styles.overlay, styles.journalOverlay, journalOverlayStyle]}>
            <View style={styles.iconContainer}>
              <View style={styles.checkmarkCircle}>
                <Text style={styles.checkmarkText}>✓</Text>
              </View>
            </View>
            <Text style={styles.overlayText}>Journal</Text>
          </Animated.View>
        )}

        {/* Archive Overlay (down swipe) - amber with box icon */}
        {isActive && (
          <Animated.View style={[styles.overlay, styles.archiveOverlay, archiveOverlayStyle]}>
            <View style={styles.iconContainer}>
              <PixelIcon name="archive-outline" size={48} color={colors.text.primary} />
            </View>
            <Text style={styles.overlayText}>Archive</Text>
          </Animated.View>
        )}

        {/* Delete Overlay (button-triggered) - red with X icon */}
        {isActive && (
          <Animated.View style={[styles.overlay, styles.deleteOverlay, deleteOverlayStyle]}>
            <View style={styles.iconContainer}>
              <View style={styles.xIcon}>
                <View style={[styles.xLine, styles.xLine1]} />
                <View style={[styles.xLine, styles.xLine2]} />
              </View>
            </View>
            <Text style={styles.overlayText}>Delete</Text>
          </Animated.View>
        )}
      </Animated.View>
    );

    // Always wrap in GestureDetector to keep tree structure stable.
    // Gesture is disabled for inactive cards via .enabled(isActive) in useSwipeableCard,
    // preventing remount of the Animated.View (and expo-image transition re-trigger) on Android.
    return <GestureDetector gesture={panGesture}>{cardContent}</GestureDetector>;
  }
);

SwipeablePhotoCard.displayName = 'SwipeablePhotoCard';

const darkroomVideoStyles = RNStyleSheet.create({
  videoIcon: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: colors.overlay.dark,
    borderRadius: 8,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholder: {
    backgroundColor: colors.background.secondary || '#1A1A2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SwipeablePhotoCard;
