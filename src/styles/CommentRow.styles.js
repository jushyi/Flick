/**
 * CommentRow styles
 *
 * Styles for individual comment row display with profile photo,
 * name, text, reply button, timestamp, and heart icon.
 */
import { StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  // Profile photo on left
  profilePhotoContainer: {
    marginRight: 12,
  },
  profilePhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  profilePhotoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePhotoInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  // Middle content section
  contentContainer: {
    flex: 1,
    marginRight: 8,
  },
  // Name row with optional author badge
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  displayName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  authorBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.brand.purple,
    borderRadius: 4,
  },
  authorBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.primary,
  },
  // Comment text
  commentText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
    marginBottom: 6,
  },
  // Media thumbnail for image/gif comments
  mediaThumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginBottom: 6,
  },
  // Footer row with reply and timestamp
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyButton: {
    paddingVertical: 2,
    paddingRight: 8,
  },
  replyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  dot: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginHorizontal: 6,
  },
  timestamp: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  // Heart icon on right
  heartContainer: {
    paddingLeft: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeCount: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
  },
});
