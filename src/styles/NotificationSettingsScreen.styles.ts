import { StyleSheet, Platform } from 'react-native';
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
    paddingBottom: Platform.OS === 'android' ? 6 : spacing.sm,
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
    ...Platform.select({
      android: {
        includeFontPadding: false,
        lineHeight: 26,
      },
    }),
  },
  headerSpacer: {
    width: 36,
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
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 20,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  toggleItemDisabled: {
    opacity: 0.4,
  },
  toggleItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  toggleItemContent: {
    marginLeft: spacing.md,
    flex: 1,
  },
  toggleItemLabel: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
  },
  toggleItemSubtitle: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    marginTop: 2,
  },
  masterToggleItem: {
    backgroundColor: colors.background.secondary,
    borderRadius: layout.borderRadius.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 0,
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
});
