/**
 * TagFriendsModal styles
 *
 * Slide-up modal for selecting friends to tag in a photo.
 * Dark theme matching existing modals with friend row layout.
 */

import { StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';

export const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    flex: 1,
  },
  contentContainer: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: layout.borderRadius.xl,
    borderTopRightRadius: layout.borderRadius.xl,
    maxHeight: '70%',
    paddingTop: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.icon.inactive,
    borderRadius: layout.borderRadius.sm,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
  },
  doneButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: layout.borderRadius.md,
    backgroundColor: colors.interactive.primary,
  },
  doneButtonText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 60,
  },
  listContent: {
    paddingBottom: spacing.md,
  },
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  emptyContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: layout.dimensions.inputHeight,
  },
  avatar: {
    width: layout.dimensions.avatarMedium,
    height: layout.dimensions.avatarMedium,
    borderRadius: layout.borderRadius.round,
    backgroundColor: colors.background.tertiary,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
  },
  friendInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  friendName: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  friendUsername: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 1,
  },
  checkIcon: {
    marginLeft: spacing.sm,
  },
});
