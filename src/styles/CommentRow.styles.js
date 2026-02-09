/**
 * CommentRow styles
 *
 * Styles for individual comment row display with profile photo,
 * name, text, reply button, timestamp, and heart icon.
 */
import { StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

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
    borderRadius: 9999,
  },
  profilePhotoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePhotoInitial: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
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
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  authorBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.brand.purple,
    borderRadius: 2,
  },
  authorBadgeText: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  // Comment text
  commentText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
    lineHeight: 20,
    marginBottom: 6,
  },
  // Media thumbnail for image/gif comments
  mediaThumbnail: {
    width: 100,
    height: 100,
    borderRadius: 2,
    marginBottom: 6,
  },
  // Footer row with reply and timestamp
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyButton: {
    paddingVertical: 2,
    paddingRight: 4,
  },
  replyButtonText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
  },
  dot: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.tertiary,
    marginHorizontal: 0, // UAT-031 fix: removed margin entirely (replyButton has paddingRight: 8)
  },
  timestamp: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.tertiary,
    paddingLeft: 4,
  },
  // Heart icon on right
  heartContainer: {
    paddingLeft: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeCount: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 2,
  },
});
