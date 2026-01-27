/**
 * FeedPhotoCard styles - Instagram-Style Design
 *
 * Edge-to-edge photos with user info row below.
 * Modern, clean aesthetic matching dark theme.
 */
import { StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

export const styles = StyleSheet.create({
  // Card container - no margins, photos go edge-to-edge
  card: {
    backgroundColor: '#000000', // Pure black to match stories section
    marginBottom: 20,
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

  // Info row below photo - profile pic + name + timestamp
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  // Profile photo
  profilePhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: colors.background.tertiary,
  },

  // Fallback icon container
  profilePhotoFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Text container for name and timestamp
  textContainer: {
    flex: 1,
  },

  // Display name
  displayName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },

  // Timestamp
  timestamp: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // Reactions row
  reactions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },

  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
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
    paddingHorizontal: 12,
    paddingBottom: 12,
  },

  // Comment preview section
  commentPreview: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
});
