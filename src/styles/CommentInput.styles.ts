/**
 * CommentInput styles
 *
 * Styles for the comment input component with text input,
 * image picker button, send button, and reply banner.
 */
import { StyleSheet, Platform } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';

export const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    backgroundColor: colors.background.secondary,
  },
  // Reply banner shown when replying to a comment
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background.tertiary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  replyBannerText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
  },
  replyBannerUsername: {
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  replyBannerCancel: {
    padding: spacing.xxs,
  },
  // Input row container
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    paddingBottom: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
  },
  // Text input wrapper - alignItems center for placeholder centering
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: layout.borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    minHeight: 40,
    maxHeight: 100,
  },
  textInput: {
    flex: 1,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.primary,
    paddingTop: 0,
    paddingBottom: 0,
    maxHeight: 80,
    textAlignVertical: 'center', // Center placeholder vertically (Android)
  },
  // Image picker button
  imageButton: {
    paddingLeft: spacing.xs,
    paddingVertical: 2,
  },
  // GIF picker button
  gifButton: {
    paddingLeft: spacing.xs,
    paddingVertical: 2,
  },
  gifButtonText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
  },
  gifButtonTextDisabled: {
    color: colors.text.tertiary,
  },
  // Send button - 44x44 to match inputWrapper visual height with padding
  sendButton: {
    marginLeft: spacing.xs,
    width: 44,
    height: 44,
    borderRadius: layout.borderRadius.round,
    backgroundColor: colors.brand.purple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.background.tertiary,
  },
  // Media preview (above input row)
  mediaPreviewContainer: {
    position: 'relative',
    marginHorizontal: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.xxs,
    alignSelf: 'flex-start',
  },
  mediaPreview: {
    width: 80,
    height: 80,
    borderRadius: layout.borderRadius.sm,
  },
  removeMediaButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    zIndex: 1,
  },
  removeMediaButtonBg: {
    backgroundColor: colors.overlay.dark,
    borderRadius: layout.borderRadius.round,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gifBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: colors.overlay.dark,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: layout.borderRadius.sm,
  },
  gifBadgeText: {
    color: colors.text.primary,
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.bodyBold,
  },
  // Uploading indicator text
  uploadingText: {
    color: colors.text.tertiary,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readableBold,
  },
});
