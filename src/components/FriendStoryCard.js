import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../constants/colors';
import logger from '../utils/logger';

/**
 * FriendStoryCard component - Simple blurred photo thumbnail
 *
 * Displays a friend's story as a compact blurred photo with
 * gradient border for unviewed stories.
 *
 * @param {object} friend - Friend data object
 * @param {string} friend.userId - Friend's user ID
 * @param {string} friend.displayName - Friend's display name
 * @param {string} friend.profilePhotoURL - Friend's profile photo URL (optional)
 * @param {Array} friend.topPhotos - Friend's top photos by engagement
 * @param {boolean} friend.hasPhotos - Whether friend has any photos
 * @param {function} onPress - Callback when card is tapped
 * @param {boolean} isFirst - Whether this is the first card (for left margin)
 * @param {boolean} isViewed - Whether the story has been viewed (default false)
 */
const FriendStoryCard = ({ friend, onPress, isFirst = false, isViewed = false }) => {
  const { userId, displayName, topPhotos, hasPhotos } = friend;

  // Get first photo URL for thumbnail
  const thumbnailUrl = topPhotos?.[0]?.imageURL || null;

  /**
   * Handle card press
   */
  const handlePress = () => {
    logger.debug('FriendStoryCard: Card pressed', { userId, displayName });
    if (onPress) {
      onPress();
    }
  };

  /**
   * Get first letter of display name for fallback
   */
  const getInitial = () => {
    return displayName?.[0]?.toUpperCase() || '?';
  };

  /**
   * Render the photo thumbnail (blurred)
   */
  const renderPhotoContent = () => (
    <View style={styles.photoContainer}>
      {thumbnailUrl ? (
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.photoThumbnail}
          blurRadius={20}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.placeholderInitial}>{getInitial()}</Text>
        </View>
      )}
    </View>
  );

  return (
    <TouchableOpacity
      style={[styles.container, isFirst && styles.firstContainer]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Gradient border for unviewed stories, subtle border for viewed */}
      {hasPhotos && !isViewed ? (
        <LinearGradient
          colors={colors.brand.gradient.developing}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBorder}
        >
          {renderPhotoContent()}
        </LinearGradient>
      ) : (
        <View style={[styles.viewedBorder, !hasPhotos && styles.noBorder]}>
          {renderPhotoContent()}
        </View>
      )}

      {/* Display name below card */}
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {displayName || 'Unknown'}
      </Text>
    </TouchableOpacity>
  );
};

// Compact square card dimensions (no Polaroid frame)
const PHOTO_SIZE = 68;
const BORDER_WIDTH = 3;

const styles = StyleSheet.create({
  container: {
    width: PHOTO_SIZE + BORDER_WIDTH * 2 + 8, // Photo + border + padding
    alignItems: 'center',
    marginRight: 8,
  },
  firstContainer: {
    marginLeft: 0,
  },
  gradientBorder: {
    width: PHOTO_SIZE + BORDER_WIDTH * 2,
    height: PHOTO_SIZE + BORDER_WIDTH * 2,
    borderRadius: 12,
    padding: BORDER_WIDTH,
    marginBottom: 6,
  },
  viewedBorder: {
    width: PHOTO_SIZE + BORDER_WIDTH * 2,
    height: PHOTO_SIZE + BORDER_WIDTH * 2,
    borderRadius: 12,
    padding: BORDER_WIDTH,
    borderWidth: 2,
    borderColor: colors.storyCard.glowViewed,
    marginBottom: 6,
  },
  noBorder: {
    borderColor: 'transparent',
  },
  photoContainer: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.background.tertiary,
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
  },
  placeholderInitial: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  name: {
    fontSize: 11,
    color: colors.storyCard.textName,
    textAlign: 'center',
    maxWidth: PHOTO_SIZE + BORDER_WIDTH * 2,
  },
});

export default FriendStoryCard;
