/**
 * FeedPhotoCard styles - Instagram-Style Design
 *
 * Edge-to-edge photos with user info row below.
 * Retro 16-bit aesthetic matching dark theme.
 */
import { StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';

export const styles = StyleSheet.create({
  // Card container - no margins, photos go edge-to-edge
  card: {
    backgroundColor: colors.background.primary,
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },

  profilePhoto: {
    width: 36,
    height: 36,
    borderRadius: layout.borderRadius.full,
    marginRight: 10,
    backgroundColor: colors.background.tertiary,
  },

  profilePhotoFallback: {
    width: 36,
    height: 36,
    borderRadius: layout.borderRadius.full,
    marginRight: 10,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  textContainer: {
    flex: 1,
  },

  displayName: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },

  timestamp: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // Caption text below info row
  captionText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.primary,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    includeFontPadding: false,
  },

  // Reactions row
  reactions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },

  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.sm,
  },

  reactionEmoji: {
    fontSize: typography.size.md,
    marginRight: 2,
  },

  reactionCount: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
  },

  moreReactions: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    marginLeft: 2,
  },

  noReactions: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.tertiary,
    fontStyle: 'italic',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },

  // Comment preview section
  commentPreview: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
});
