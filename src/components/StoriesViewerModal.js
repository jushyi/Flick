import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  StatusBar,
  PanResponder,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { getTimeAgo } from '../utils/timeUtils';
import StrokedNameText from './StrokedNameText';
import logger from '../utils/logger';
import { useScreenTrace } from '../hooks/useScreenTrace';
import { colors } from '../constants/colors';
import { profileCacheKey } from '../utils/imageUtils';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * StoriesViewerModal - Full-screen photo viewer for friend's stories
 *
 * Features:
 * - Full-screen photo display
 * - Progress bar showing current photo position
 * - Tap left/right to navigate between photos
 * - Swipe down to close
 * - Friend info header with profile photo
 * - Start at specified initial index (for resuming from last unviewed)
 *
 * @param {boolean} visible - Modal visibility state
 * @param {function} onClose - Callback to close modal
 * @param {object} friend - Friend object with userId, displayName, profilePhotoURL, topPhotos
 * @param {function} onPhotoChange - Optional callback when photo changes
 * @param {number} initialIndex - Starting photo index (default: 0)
 * @param {function} onAvatarPress - Callback when avatar is tapped (navigates to profile)
 */
const StoriesViewerModal = ({
  visible,
  onClose,
  friend,
  onPhotoChange,
  initialIndex = 0,
  onAvatarPress,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Screen load trace - measures time from mount to stories data ready
  const { markLoaded } = useScreenTrace('StoriesViewer');
  const screenTraceMarkedRef = useRef(false);

  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const { userId, displayName, profilePhotoURL, topPhotos = [] } = friend || {};
  const currentPhoto = topPhotos[currentIndex] || null;

  // Reset index when modal opens with new friend
  useEffect(() => {
    if (visible && friend?.userId) {
      logger.debug('StoriesViewer: Modal opened', {
        friendId: friend.userId,
        photoCount: topPhotos.length,
        startingIndex: initialIndex,
      });

      // Defensive check: close modal if friend has no photos
      if (!topPhotos || topPhotos.length === 0) {
        logger.warn('StoriesViewer: Friend has no photos, closing modal', {
          friendId: friend.userId,
        });
        onClose();
        return;
      }

      // Start at initialIndex (clamped to valid range)
      const validIndex = Math.min(Math.max(0, initialIndex), topPhotos.length - 1);
      setCurrentIndex(validIndex);
      translateY.setValue(0);
      opacity.setValue(1);

      // Mark screen trace as loaded after stories data is ready (once only)
      if (!screenTraceMarkedRef.current) {
        screenTraceMarkedRef.current = true;
        markLoaded({ story_count: topPhotos.length });
      }
    }
  }, [visible, friend?.userId, topPhotos.length, initialIndex, onClose]);

  // Preload next image for smoother transitions
  useEffect(() => {
    if (visible && topPhotos.length > 0 && currentIndex < topPhotos.length - 1) {
      const nextPhoto = topPhotos[currentIndex + 1];
      if (nextPhoto?.imageURL) {
        logger.debug('StoriesViewer: Preloading next image', { nextIndex: currentIndex + 1 });
        Image.prefetch(nextPhoto.imageURL).catch(err => {
          // Silent fail - preloading is best-effort
          logger.debug('StoriesViewer: Image prefetch failed', { error: err.message });
        });
      }
    }
  }, [visible, currentIndex, topPhotos]);

  // Pan responder for swipe down to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to downward swipes (dy > 10)
        return gestureState.dy > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow downward swipes
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
          // Fade out as user swipes down
          const fadeAmount = Math.max(0, 1 - gestureState.dy / SCREEN_HEIGHT);
          opacity.setValue(fadeAmount);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If swiped down more than 100px or fast swipe (velocity), close the modal
        const dismissThreshold = 100;
        if (gestureState.dy > dismissThreshold || gestureState.vy > 0.5) {
          logger.debug('StoriesViewer: Swipe-down close triggered');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: SCREEN_HEIGHT,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onClose();
            // Reset after a short delay to ensure smooth transition
            setTimeout(() => {
              translateY.setValue(0);
              opacity.setValue(1);
            }, 100);
          });
        } else {
          // Spring back to original position with smooth animation
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              tension: 50,
              friction: 10,
              useNativeDriver: true,
            }),
            Animated.spring(opacity, {
              toValue: 1,
              tension: 50,
              friction: 10,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  const handleTap = event => {
    const { locationX } = event.nativeEvent;

    if (locationX < SCREEN_WIDTH * 0.3) {
      // Left tap - previous
      if (currentIndex === 0) {
        logger.debug('StoriesViewer: At first photo, closing');
        closeWithAnimation();
      } else {
        const newIndex = currentIndex - 1;
        logger.debug('StoriesViewer: Navigating', { direction: 'previous', newIndex });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCurrentIndex(newIndex);
        if (onPhotoChange && topPhotos[newIndex]) {
          onPhotoChange(topPhotos[newIndex]);
        }
      }
    } else if (locationX > SCREEN_WIDTH * 0.7) {
      // Right tap - next
      if (currentIndex === topPhotos.length - 1) {
        logger.debug('StoriesViewer: At last photo, closing');
        closeWithAnimation();
      } else {
        const newIndex = currentIndex + 1;
        logger.debug('StoriesViewer: Navigating', { direction: 'next', newIndex });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCurrentIndex(newIndex);
        if (onPhotoChange && topPhotos[newIndex]) {
          onPhotoChange(topPhotos[newIndex]);
        }
      }
    }
    // Center tap (40%) - no action
  };

  const closeWithAnimation = () => {
    logger.debug('StoriesViewer: Animated close triggered');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      setTimeout(() => {
        translateY.setValue(0);
        opacity.setValue(1);
      }, 100);
    });
  };

  const handleAvatarPress = () => {
    logger.debug('StoriesViewer: Avatar pressed', { userId, displayName });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    if (onAvatarPress) {
      onAvatarPress(userId, displayName);
    }
  };

  const renderProgressBar = () => {
    return (
      <View style={styles.progressBarContainer}>
        {topPhotos.map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressSegment,
              index <= currentIndex ? styles.progressSegmentActive : styles.progressSegmentInactive,
            ]}
          />
        ))}
      </View>
    );
  };

  if (!friend || !currentPhoto) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={closeWithAnimation}
      statusBarTranslucent
    >
      <Animated.View style={[styles.container, { opacity }]} {...panResponder.panHandlers}>
        <StatusBar barStyle="light-content" />

        {/* Animated content wrapper */}
        <Animated.View
          style={[
            styles.contentWrapper,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Progress Bar */}
          {renderProgressBar()}

          {/* Header with friend info */}
          <View style={styles.header}>
            <View style={styles.friendInfo}>
              <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.7}>
                {profilePhotoURL ? (
                  <Image
                    source={{
                      uri: profilePhotoURL,
                      cacheKey: profileCacheKey(`profile-${userId}`, profilePhotoURL),
                    }}
                    style={styles.profilePic}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    priority="high"
                  />
                ) : (
                  <View style={[styles.profilePic, styles.profilePicPlaceholder]}>
                    <Text style={styles.profilePicText}>
                      {displayName?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.friendTextContainer}>
                <StrokedNameText
                  style={styles.displayName}
                  nameColor={friend?.nameColor}
                  numberOfLines={1}
                >
                  {displayName || 'Unknown User'}
                </StrokedNameText>
                <Text style={styles.timestamp}>{getTimeAgo(currentPhoto.capturedAt)}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={closeWithAnimation} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>X</Text>
            </TouchableOpacity>
          </View>

          {/* Photo with tap navigation */}
          <TouchableWithoutFeedback onPress={handleTap}>
            <View style={styles.photoContainer}>
              <Image
                source={{ uri: currentPhoto.imageURL, cacheKey: `story-${currentPhoto.id}` }}
                style={styles.photo}
                contentFit="cover"
                cachePolicy="memory-disk"
                priority="high"
              />
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  contentWrapper: {
    flex: 1,
  },
  progressBarContainer: {
    flexDirection: 'row',
    paddingTop: (StatusBar.currentHeight || 54) + 8,
    paddingHorizontal: spacing.xs,
    gap: spacing.xxs,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
  },
  progressSegmentActive: {
    backgroundColor: colors.text.primary,
  },
  progressSegmentInactive: {
    backgroundColor: colors.overlay.light,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profilePic: {
    width: layout.dimensions.avatarSmall,
    height: layout.dimensions.avatarSmall,
    borderRadius: layout.borderRadius.full,
    borderWidth: 1,
    borderColor: colors.overlay.light,
  },
  profilePicPlaceholder: {
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
  },
  friendTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  displayName: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
  },
  timestamp: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    marginTop: 1,
  },
  closeButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  closeButtonText: {
    fontSize: typography.size.xl,
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bodyBold,
  },
  photoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
});

export default StoriesViewerModal;
