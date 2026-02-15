import { StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    marginRight: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  // Privacy messaging section
  privacySection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  privacyIcon: {
    marginBottom: spacing.md,
  },
  privacyTitle: {
    fontSize: typography.size.xxl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  privacyText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  // Sync button
  syncButton: {
    backgroundColor: colors.interactive.primary,
    paddingVertical: spacing.md,
    borderRadius: layout.borderRadius.md,
    marginTop: spacing.lg,
    width: '100%',
  },
  syncButtonText: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    textAlign: 'center',
  },
  skipButton: {
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  skipButtonText: {
    color: colors.text.secondary,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    textAlign: 'center',
  },
  // Results section
  resultsHeader: {
    paddingVertical: spacing.md,
  },
  resultsTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  resultsSubtitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
  },
  listContent: {
    paddingBottom: 100,
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyIcon: {
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
  },
  // Continue button (fixed at bottom)
  continueContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background.primary,
  },
  continueButton: {
    backgroundColor: colors.interactive.primary,
    paddingVertical: spacing.md,
    borderRadius: layout.borderRadius.md,
  },
  continueButtonText: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    textAlign: 'center',
  },
});
