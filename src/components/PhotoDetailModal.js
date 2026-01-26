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
 */
import React from 'react';
import {
  View,
  Text,
  Modal,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  StatusBar,
  Animated,
} from 'react-native';
import { getTimeAgo } from '../utils/timeUtils';
import { usePhotoDetailModal } from '../hooks/usePhotoDetailModal';
import { styles } from '../styles/PhotoDetailModal.styles';

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
}) => {
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

        {/* Animated content wrapper */}
        <Animated.View
          style={[
            styles.contentWrapper,
            {
              transform: [{ translateY }],
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

          {/* Photo - with tap navigation in stories mode */}
          {mode === 'stories' ? (
            <TouchableWithoutFeedback onPress={handleTapNavigation}>
              <View style={styles.photoScrollView}>
                <Image source={{ uri: imageURL }} style={styles.photo} resizeMode="cover" />
              </View>
            </TouchableWithoutFeedback>
          ) : (
            <View style={styles.photoScrollView}>
              <Image source={{ uri: imageURL }} style={styles.photo} resizeMode="cover" />
            </View>
          )}

          {/* Profile photo - overlapping top left of photo */}
          <View style={styles.profilePicContainer}>
            {profilePhotoURL ? (
              <Image source={{ uri: profilePhotoURL }} style={styles.profilePic} />
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
            <View style={styles.progressBarContainer}>
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
            </View>
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
