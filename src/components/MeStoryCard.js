import React, { useRef, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import PixelIcon from './PixelIcon';
import StrokedNameText from './StrokedNameText';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';
import logger from '../utils/logger';
import { profileCacheKey } from '../utils/imageUtils';

/**
 * MeStoryCard component - Rectangular story card for current user's own stories
 *
 * Displays the user's own story as a tall rectangular blurred photo with
 * gradient border for unviewed stories and profile photo at the bottom.
 * Always shows "Me" as label instead of displayName.
 * Shows empty state with "M" placeholder when no photos exist.
 *
 * @param {object} friend - User's story data object (same structure as friend data)
 * @param {string} friend.userId - User's ID
 * @param {string} friend.displayName - Always "Me" for this component
 * @param {string} friend.profilePhotoURL - User's profile photo URL (optional)
 * @param {Array} friend.topPhotos - User's photos
 * @param {boolean} friend.hasPhotos - Whether user has any photos
 * @param {function} onPress - Callback when card is tapped
 * @param {boolean} isFirst - Whether this is the first card (for left margin)
 * @param {boolean} isViewed - Whether all stories have been viewed (default false)
 */
const MeStoryCardInner = ({ friend, onPress, isFirst = false, isViewed = false }) => {
  const { userId, profilePhotoURL, topPhotos, thumbnailURL, hasPhotos } = friend || {};

  // Use thumbnailURL (most recent photo) if available, fallback to first photo in array
  const thumbnailUrl = thumbnailURL || topPhotos?.[0]?.imageURL || null;

  // Ref for measuring card position (expand/collapse animation)
  const cardRef = useRef(null);

  const handlePress = () => {
    logger.debug('MeStoryCard: Card pressed', { userId });
    if (cardRef.current) {
      cardRef.current.measureInWindow((x, y, width, height) => {
        if (onPress) onPress({ x, y, width, height, borderRadius: 4 });
      });
    } else if (onPress) {
      onPress(null);
    }
  };

  /**
   * Render the photo thumbnail (blurred) or "M" placeholder for empty state
   * Uses expo-image for persistent caching to prevent gray flash on modal dismiss
   */
  const renderPhotoContent = () => (
    <View style={styles.photoContainer}>
      {thumbnailUrl ? (
        <Image
          source={{ uri: thumbnailUrl, cacheKey: `story-thumb-${userId}` }}
          style={styles.photoThumbnail}
          contentFit="cover"
          transition={0}
          cachePolicy="memory-disk"
          blurRadius={20}
        />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.placeholderInitial}>M</Text>
        </View>
      )}
    </View>
  );

  /**
   * Render profile photo at bottom of card
   * Uses RNImage (small size, no flash issue)
   * Not tappable - own profile avatar should not navigate anywhere
   */
  const renderProfilePhoto = () => (
    <View style={styles.profileContainer}>
      {profilePhotoURL ? (
        <Image
          source={{
            uri: profilePhotoURL,
            cacheKey: profileCacheKey(`profile-${userId}`, profilePhotoURL),
          }}
          style={styles.profilePhoto}
          cachePolicy="memory-disk"
          transition={0}
        />
      ) : (
        <View style={styles.profilePlaceholder}>
          <PixelIcon name="person" size={18} color={colors.text.secondary} />
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
      <View ref={cardRef} style={styles.cardWrapper}>
        {hasPhotos && !isViewed ? (
          <LinearGradient
            colors={colors.storyCard.gradientUnviewed}
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

      {/* Always show "Me" as label */}
      <StrokedNameText
        style={styles.name}
        nameColor={friend?.nameColor}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        Me
      </StrokedNameText>
    </TouchableOpacity>
  );
};

// Rectangular card dimensions (taller than wide, like Instagram stories)
// Matches FriendStoryCard exactly
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
    borderRadius: layout.borderRadius.md,
    padding: BORDER_WIDTH,
  },
  viewedBorder: {
    width: PHOTO_WIDTH + BORDER_WIDTH * 2,
    height: PHOTO_HEIGHT + BORDER_WIDTH * 2,
    borderRadius: layout.borderRadius.md,
    padding: BORDER_WIDTH,
    borderWidth: 2,
    borderColor: colors.storyCard.glowViewed,
  },
  noBorder: {
    borderColor: 'transparent',
  },
  photoContainer: {
    flex: 1,
    borderRadius: layout.borderRadius.sm,
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
    fontSize: typography.size.xxxl,
    fontFamily: typography.fontFamily.bodyBold,
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
    fontSize: typography.size.sm,
    color: colors.storyCard.textName,
    textAlign: 'center',
    maxWidth: PHOTO_WIDTH + BORDER_WIDTH * 2,
    fontFamily: typography.fontFamily.body,
  },
});

export const MeStoryCard = memo(MeStoryCardInner);
export default MeStoryCard;
