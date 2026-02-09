import { StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

export const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 9999,
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
    marginRight: 12,
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
    fontFamily: typography.fontFamily.body,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  subtitle: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Add Friend button (purple)
  addButton: {
    backgroundColor: colors.brand.purple,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 2,
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
    padding: 8,
    backgroundColor: colors.background.tertiary,
    borderRadius: 2,
  },
  // Pending button (gray)
  pendingButton: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 2,
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 2,
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 2,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 2,
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
    padding: 8,
    marginLeft: 8,
  },
});
