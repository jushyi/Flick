import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import logger from '../utils/logger';

/**
 * FriendStoryCard component - Rectangular story card with profile photo
 *
 * Displays a friend's story as a tall rectangular blurred photo with
 * gradient border for unviewed stories and profile photo at the bottom.
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
  const { userId, displayName, profilePhotoURL, topPhotos, hasPhotos } = friend;

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

  /**
   * Render profile photo at bottom of card
   */
  const renderProfilePhoto = () => (
    <View style={styles.profileContainer}>
      {profilePhotoURL ? (
        <Image source={{ uri: profilePhotoURL }} style={styles.profilePhoto} />
      ) : (
        <View style={styles.profilePlaceholder}>
          <Ionicons name="person" size={18} color={colors.text.secondary} />
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
      {/* Card with gradient or viewed border */}
      <View style={styles.cardWrapper}>
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

        {/* Profile photo overlapping bottom of card */}
        {renderProfilePhoto()}
      </View>

      {/* Display name below card */}
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {displayName || 'Unknown'}
      </Text>
    </TouchableOpacity>
  );
};

// Rectangular card dimensions (taller than wide, like Instagram stories)
const PHOTO_WIDTH = 88;
const PHOTO_HEIGHT = 130;
const BORDER_WIDTH = 3;
const PROFILE_SIZE = 32;

const styles = StyleSheet.create({
  container: {
    width: PHOTO_WIDTH + BORDER_WIDTH * 2 + 8,
    alignItems: 'center',
    marginRight: 10,
  },
  firstContainer: {
    marginLeft: 0,
  },
  cardWrapper: {
    position: 'relative',
    marginBottom: PROFILE_SIZE / 2 + 4, // Space for overlapping profile + gap
  },
  gradientBorder: {
    width: PHOTO_WIDTH + BORDER_WIDTH * 2,
    height: PHOTO_HEIGHT + BORDER_WIDTH * 2,
    borderRadius: 14,
    padding: BORDER_WIDTH,
  },
  viewedBorder: {
    width: PHOTO_WIDTH + BORDER_WIDTH * 2,
    height: PHOTO_HEIGHT + BORDER_WIDTH * 2,
    borderRadius: 14,
    padding: BORDER_WIDTH,
    borderWidth: 2,
    borderColor: colors.storyCard.glowViewed,
  },
  noBorder: {
    borderColor: 'transparent',
  },
  photoContainer: {
    flex: 1,
    borderRadius: 10,
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
    fontSize: 28,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  profileContainer: {
    position: 'absolute',
    bottom: -PROFILE_SIZE / 2,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  profilePhoto: {
    width: PROFILE_SIZE,
    height: PROFILE_SIZE,
    borderRadius: PROFILE_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.background.primary,
    backgroundColor: colors.background.tertiary,
  },
  profilePlaceholder: {
    width: PROFILE_SIZE,
    height: PROFILE_SIZE,
    borderRadius: PROFILE_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.background.primary,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 12,
    color: colors.storyCard.textName,
    textAlign: 'center',
    maxWidth: PHOTO_WIDTH + BORDER_WIDTH * 2,
    fontWeight: '500',
  },
});

export default FriendStoryCard;
