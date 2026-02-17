import { StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  backButton: {
    padding: spacing.xxs,
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 36,
  },
  permissionBanner: {
    backgroundColor: colors.background.secondary,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: layout.borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.status.danger,
  },
  permissionBannerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  permissionBannerText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  permissionBannerTitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  permissionBannerSubtitle: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  permissionBannerButton: {
    backgroundColor: colors.interactive.primary,
    paddingVertical: 10,
    borderRadius: layout.borderRadius.md,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  permissionBannerButtonText: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
  },
  menuContainer: {
    marginTop: spacing.lg,
  },
  sectionHeader: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  sectionHeaderText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 20,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  infoRowContent: {
    marginLeft: spacing.md,
    flex: 1,
  },
  infoRowLabel: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
  },
  infoRowSubtitle: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    marginTop: 2,
  },
  syncButton: {
    backgroundColor: colors.interactive.primary,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingVertical: 14,
    borderRadius: layout.borderRadius.md,
    alignItems: 'center',
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
  },
  successBanner: {
    backgroundColor: colors.background.secondary,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: layout.borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.status.ready,
    flexDirection: 'row',
    alignItems: 'center',
  },
  successBannerText: {
    marginLeft: spacing.sm,
    flex: 1,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.primary,
  },
});
