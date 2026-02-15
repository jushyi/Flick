import { StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';

// Avatar size for FriendCard (between avatarMedium and avatarLarge)
const AVATAR_SIZE = 50;

export const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  avatarContainer: {
    marginRight: spacing.sm,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: layout.borderRadius.round,
  },
  avatarPlaceholder: {
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.secondary,
  },
  userInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  displayName: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  username: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
  },
  friendsSince: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  subtitle: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  // Add Friend button (interactive primary)
  addButton: {
    backgroundColor: colors.interactive.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: layout.borderRadius.sm,
    minWidth: 70,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  // Dismiss button (X) for suggestions
  dismissButton: {
    padding: spacing.xs,
    backgroundColor: colors.background.tertiary,
    borderRadius: layout.borderRadius.sm,
  },
  // Pending button (gray)
  pendingButton: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: layout.borderRadius.sm,
    minWidth: 70,
    alignItems: 'center',
  },
  pendingButtonText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
  },
  // Accept button (green)
  acceptButton: {
    backgroundColor: colors.status.ready,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: layout.borderRadius.sm,
    minWidth: 70,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  // Deny button (red/pink)
  denyButton: {
    backgroundColor: colors.status.danger,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: layout.borderRadius.sm,
    minWidth: 60,
    alignItems: 'center',
  },
  denyButtonText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  // Cancel button (for sent requests)
  cancelButton: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: layout.borderRadius.sm,
    minWidth: 70,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Three-dot menu button for friends
  menuButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
});
