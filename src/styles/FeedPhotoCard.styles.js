/**
 * FeedPhotoCard styles - Overlapping Profile Design
 *
 * Edge-to-edge photos with profile photo overlapping bottom edge
 * and name/timestamp centered below.
 */
import { StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

// Profile photo dimensions
const PROFILE_SIZE = 52;
const PROFILE_OVERLAP = PROFILE_SIZE / 2; // Half overlaps photo

export const styles = StyleSheet.create({
  // Card container - no margins, photos go edge-to-edge
  card: {
    backgroundColor: '#000000', // Pure black to match stories section
    marginBottom: 20,
  },

  // Wrapper for photo and overlapping profile
  photoWrapper: {
    position: 'relative',
    marginBottom: PROFILE_OVERLAP, // Space for overlapping profile
  },

  // Photo container - full screen width, square
  photoContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.background.tertiary,
  },

  photo: {
    width: '100%',
    height: '100%',
  },

  // Profile overlay - positioned at bottom center of photo
  profileOverlay: {
    position: 'absolute',
    bottom: -PROFILE_OVERLAP, // Overlap by half the profile size
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  // Profile photo - larger for emphasis
  profilePhoto: {
    width: PROFILE_SIZE,
    height: PROFILE_SIZE,
    borderRadius: PROFILE_SIZE / 2,
    backgroundColor: colors.background.tertiary,
    borderWidth: 3,
    borderColor: '#000000', // Black border to separate from photo
  },

  // Fallback icon container
  profilePhotoFallback: {
    width: PROFILE_SIZE,
    height: PROFILE_SIZE,
    borderRadius: PROFILE_SIZE / 2,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000000',
  },

  // User info container - centered below profile photo
  userInfo: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },

  // Display name - centered
  displayName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },

  // Timestamp - centered below name
  timestamp: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
    textAlign: 'center',
  },

  // Reactions row - centered
  reactions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },

  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 6,
  },

  reactionEmoji: {
    fontSize: 14,
    marginRight: 2,
  },

  reactionCount: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.secondary,
  },

  moreReactions: {
    fontSize: 11,
    color: colors.text.secondary,
    marginLeft: 2,
  },

  noReactions: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
});
