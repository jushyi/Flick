/**
 * CommentRow styles
 *
 * Styles for individual comment row display with profile photo,
 * name, text, reply button, timestamp, and heart icon.
 */
import { StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  // Profile photo on left
  profilePhotoContainer: {
    marginRight: spacing.sm,
  },
  profilePhoto: {
    width: layout.dimensions.avatarMedium,
    height: layout.dimensions.avatarMedium,
    borderRadius: layout.borderRadius.round,
  },
  profilePhotoPlaceholder: {
    width: layout.dimensions.avatarMedium,
    height: layout.dimensions.avatarMedium,
    borderRadius: layout.borderRadius.round,
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
    marginRight: spacing.xs,
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
    marginLeft: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    backgroundColor: colors.brand.purple,
    borderRadius: layout.borderRadius.sm,
  },
  authorBadgeText: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  // Comment text
  commentText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.primary,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  // Media thumbnail for image/gif comments
  mediaContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.xs,
  },
  mediaThumbnail: {
    width: 100,
    height: 100,
    borderRadius: layout.borderRadius.sm,
    marginRight: spacing.xs,
  },
  // Giphy attribution (required for inline GIF displays)
  giphyAttribution: {
    width: 40,
    height: 60,
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
    fontFamily: typography.fontFamily.readable,
    color: colors.text.tertiary,
    marginHorizontal: 0, // No margin - replyButton paddingRight provides spacing
  },
  timestamp: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.tertiary,
    paddingLeft: 4,
  },
  // Heart icon on right
  heartContainer: {
    paddingLeft: spacing.xs,
    paddingVertical: spacing.xxs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeCount: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    marginTop: 2,
  },
  // Swipe to delete
  deleteButton: {
    backgroundColor: colors.status.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderRadius: layout.borderRadius.xl,
  },
  deleteButtonText: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
    marginTop: spacing.xxs,
  },
});
