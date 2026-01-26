/**
 * PhotoDetailModal - Full-screen photo viewer with inline emoji reactions
 *
 * Features:
 * - Full-screen photo display
 * - Swipe-down-to-dismiss gesture
 * - Profile header
 * - Inline horizontal emoji picker in footer
 * - Multiple reactions per user with counts
 * - Stories mode: progress bar, tap navigation, multi-photo
 * - 3D cube rotation for friend-to-friend transitions
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { getTimeAgo } from '../utils/timeUtils';
import { usePhotoDetailModal } from '../hooks/usePhotoDetailModal';
import { styles } from '../styles/PhotoDetailModal.styles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * PhotoDetailModal Component
 *
 * @param {string} mode - View mode: 'feed' (default) or 'stories'
 * @param {boolean} visible - Modal visibility state
 * @param {object} photo - Photo object with user data and reactions (feed mode)
 * @param {array} photos - Array of photos (stories mode)
 * @param {number} initialIndex - Starting photo index (stories mode)
 * @param {function} onPhotoChange - Callback when photo changes (stories mode)
 * @param {function} onClose - Callback to close modal
 * @param {function} onReactionToggle - Callback when emoji is toggled (emoji, currentCount)
 * @param {string} currentUserId - Current user's ID
 * @param {function} onRequestNextFriend - Callback for friend-to-friend transition (stories mode)
 * @param {boolean} hasNextFriend - Whether there's another friend's stories after this
 */
const PhotoDetailModal = ({
  mode = 'feed',
  visible,
  photo,
  photos = [],
  initialIndex = 0,
  onPhotoChange,
  onClose,
  onReactionToggle,
  currentUserId,
  onRequestNextFriend,
  hasNextFriend = false,
}) => {
  // Cube transition animation for friend-to-friend
  const cubeRotation = useRef(new Animated.Value(0)).current;
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Reset cube rotation when modal opens or friend changes
  useEffect(() => {
    if (visible) {
      cubeRotation.setValue(0);
      setIsTransitioning(false);
    }
  }, [visible, photos]);

  /**
   * Handle friend-to-friend transition with cube animation
   */
  const handleFriendTransition = useCallback(() => {
    if (!hasNextFriend || !onRequestNextFriend || isTransitioning) return false;

    setIsTransitioning(true);

    // Animate cube rotation out (0 -> -90 degrees)
    Animated.timing(cubeRotation, {
      toValue: -90,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      // Trigger friend change callback
      onRequestNextFriend();
      // Reset rotation for incoming friend (from 90 -> 0)
      cubeRotation.setValue(90);
      Animated.timing(cubeRotation, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setIsTransitioning(false);
      });
    });

    return true;
  }, [hasNextFriend, onRequestNextFriend, cubeRotation, isTransitioning]);
  const {
    // Mode
    showProgressBar,

    // Photo data
    currentPhoto,
    imageURL,
    capturedAt,
    displayName,
    profilePhotoURL,

    // Stories navigation
    currentIndex,
    totalPhotos,
    handleTapNavigation,

    // Animation
    translateY,
    opacity,
    panResponder,

    // Reactions
    groupedReactions,
    orderedEmojis,
    getUserReactionCount,
    handleEmojiPress,
  } = usePhotoDetailModal({
    mode,
    photo,
    photos,
    initialIndex,
    onPhotoChange,
    visible,
    onClose,
    onReactionToggle,
    currentUserId,
    onFriendTransition: hasNextFriend ? handleFriendTransition : null,
  });

  // In feed mode, check photo prop; in stories mode, check currentPhoto
  if (mode === 'feed' && !photo) return null;
  if (mode === 'stories' && !currentPhoto) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.container, { opacity }]} {...panResponder.panHandlers}>
        <StatusBar barStyle="light-content" />

        {/* Animated content wrapper with cube transition */}
        <Animated.View
          style={[
            styles.contentWrapper,
            {
              transform: [
                { translateY },
                { perspective: 1000 },
                {
                  rotateY: cubeRotation.interpolate({
                    inputRange: [-90, 0, 90],
                    outputRange: ['-90deg', '0deg', '90deg'],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Header with close button */}
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Photo - with tap navigation in stories mode, touchable in feed mode for swipe gesture */}
          <TouchableWithoutFeedback onPress={mode === 'stories' ? handleTapNavigation : undefined}>
            <View style={styles.photoScrollView}>
              <Image
                source={{ uri: imageURL }}
                style={styles.photo}
                contentFit="cover"
                transition={0}
              />
            </View>
          </TouchableWithoutFeedback>

          {/* Profile photo - overlapping top left of photo */}
          <View style={styles.profilePicContainer}>
            {profilePhotoURL ? (
              <Image
                source={{ uri: profilePhotoURL }}
                style={styles.profilePic}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.profilePic, styles.profilePicPlaceholder]}>
                <Text style={styles.profilePicText}>{displayName?.[0]?.toUpperCase() || '?'}</Text>
              </View>
            )}
          </View>

          {/* User info - bottom left of photo */}
          <View style={styles.userInfoOverlay}>
            <Text style={styles.displayName} numberOfLines={1}>
              {displayName || 'Unknown User'}
            </Text>
            <Text style={styles.timestamp}>{getTimeAgo(capturedAt)}</Text>
          </View>

          {/* Progress bar - stories mode only, positioned below user info */}
          {showProgressBar && totalPhotos > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.progressBarScrollView}
              contentContainerStyle={styles.progressBarContainer}
            >
              {Array.from({ length: totalPhotos }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressSegment,
                    index <= currentIndex
                      ? styles.progressSegmentActive
                      : styles.progressSegmentInactive,
                  ]}
                />
              ))}
            </ScrollView>
          )}

          {/* Footer - Tappable Emoji Pills */}
          <View style={styles.footer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.emojiPickerContainer}
            >
              {orderedEmojis.map(emoji => {
                const totalCount = groupedReactions[emoji] || 0;
                const userCount = getUserReactionCount(emoji);
                const isSelected = userCount > 0;

                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.emojiPill, isSelected && styles.emojiPillSelected]}
                    onPress={() => handleEmojiPress(emoji)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.emojiPillEmoji}>{emoji}</Text>
                    {totalCount > 0 && <Text style={styles.emojiPillCount}>{totalCount}</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default PhotoDetailModal;
