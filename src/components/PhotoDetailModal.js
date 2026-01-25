/**
 * PhotoDetailModal - Full-screen photo viewer with inline emoji reactions
 *
 * Features:
 * - Full-screen photo display
 * - Swipe-down-to-dismiss gesture
 * - Profile header
 * - Inline horizontal emoji picker in footer
 * - Multiple reactions per user with counts
 */
import React from 'react';
import {
  View,
  Text,
  Modal,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
} from 'react-native';
import { getTimeAgo } from '../utils/timeUtils';
import { usePhotoDetailModal, REACTION_EMOJIS } from '../hooks/usePhotoDetailModal';
import { styles } from '../styles/PhotoDetailModal.styles';

/**
 * PhotoDetailModal Component
 *
 * @param {boolean} visible - Modal visibility state
 * @param {object} photo - Photo object with user data and reactions
 * @param {function} onClose - Callback to close modal
 * @param {function} onReactionToggle - Callback when emoji is toggled (emoji, currentCount)
 * @param {string} currentUserId - Current user's ID
 */
const PhotoDetailModal = ({ visible, photo, onClose, onReactionToggle, currentUserId }) => {
  const {
    // Photo data
    imageURL,
    capturedAt,
    displayName,
    profilePhotoURL,

    // Animation
    translateY,
    opacity,
    panResponder,

    // Reactions
    groupedReactions,
    orderedEmojis,
    getUserReactionCount,
    handleEmojiPress,
  } = usePhotoDetailModal({ photo, visible, onClose, onReactionToggle, currentUserId });

  if (!photo) return null;

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

          {/* Photo */}
          <View style={styles.photoScrollView}>
            <Image source={{ uri: imageURL }} style={styles.photo} resizeMode="cover" />
          </View>

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
