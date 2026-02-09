/**
 * SwipeablePhotoCard - Flick-style swipeable card for photo triage
 *
 * Features:
 * - Arc motion: Card curves downward as it moves horizontally (like flicking from wrist)
 * - Rotation: Card tilts in direction of swipe
 * - On-card overlays: Color overlays with icons fade in during swipe
 * - Three-stage haptic feedback: threshold, release, completion
 * - Spring-back animation when threshold not met
 * - Imperative methods for button-triggered animations
 *
 * Swipe directions:
 * - Left swipe → Archive (gray overlay, box icon)
 * - Right swipe → Journal (green overlay, checkmark icon)
 * - Delete via button only (down-swipe disabled to prevent accidental deletions)
 *
 * @param {object} photo - Photo object to display
 * @param {function} onSwipeLeft - Callback when Archive action triggered (left swipe or button)
 * @param {function} onSwipeRight - Callback when Journal action triggered (right swipe or button)
 * @param {function} onSwipeDown - Callback when Delete action triggered (button only)
 * @param {number} stackIndex - Position in the stack (0=front, 1=behind, 2=furthest back)
 * @param {boolean} isActive - Whether this card is swipeable (only front card)
 * @param {ref} ref - Ref for imperative methods (triggerArchive, triggerJournal, triggerDelete)
 */

import React, { forwardRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import PixelIcon from './PixelIcon';
import logger from '../utils/logger';
import useSwipeableCard from '../hooks/useSwipeableCard';
import { styles } from '../styles/SwipeablePhotoCard.styles';
import { colors } from '../constants/colors';

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
        ref,
      });

    if (!photo || !photo.imageURL) {
      logger.warn('SwipeablePhotoCard: Missing photo or imageURL', { photo });
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
        {/* Photo Image - expo-image with native caching and transitions */}
        <Image
          source={{ uri: photo.imageURL }}
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

        {/* Tag Button Overlay - only on active card when onTagPress provided */}
        {onTagPress && (
          <TouchableOpacity
            style={styles.tagOverlayButton}
            onPress={onTagPress}
            activeOpacity={0.7}
          >
            <PixelIcon name="add" size={20} color={colors.icon.primary} />
            {hasTagged && <View style={styles.tagOverlayBadge} />}
          </TouchableOpacity>
        )}

        {/* Archive Overlay (Left swipe) - only show on active card */}
        {isActive && (
          <Animated.View style={[styles.overlay, styles.archiveOverlay, archiveOverlayStyle]}>
            <View style={styles.iconContainer}>
              <View style={styles.boxIcon}>
                <View style={styles.boxIconInner} />
              </View>
            </View>
            <Text style={styles.overlayText}>Archive</Text>
          </Animated.View>
        )}

        {/* Journal Overlay (Right swipe) - only show on active card */}
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

        {/* Delete Overlay (button-triggered) - only show on active card */}
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

    // Only wrap in GestureDetector for active (swipeable) card
    if (isActive) {
      return <GestureDetector gesture={panGesture}>{cardContent}</GestureDetector>;
    }

    // Stack cards (not swipeable) - render directly
    return cardContent;
  }
);

SwipeablePhotoCard.displayName = 'SwipeablePhotoCard';

export default SwipeablePhotoCard;
