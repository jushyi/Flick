import { StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    marginRight: 12,
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
    paddingVertical: 32,
  },
  privacyIcon: {
    marginBottom: 16,
  },
  privacyTitle: {
    fontSize: typography.size.xxl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  privacyText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  // Sync button
  syncButton: {
    backgroundColor: colors.brand.purple,
    paddingVertical: 16,
    borderRadius: 4,
    marginTop: 24,
    width: '100%',
  },
  syncButtonText: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    textAlign: 'center',
  },
  skipButton: {
    paddingVertical: 16,
    marginTop: 12,
  },
  skipButtonText: {
    color: colors.text.secondary,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    textAlign: 'center',
  },
  // Results section
  resultsHeader: {
    paddingVertical: 16,
  },
  resultsTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    marginBottom: 4,
  },
  resultsSubtitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
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
    paddingHorizontal: 40,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
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
    marginTop: 16,
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
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
    paddingBottom: 40,
    backgroundColor: colors.background.primary,
  },
  continueButton: {
    backgroundColor: colors.brand.purple,
    paddingVertical: 16,
    borderRadius: 4,
  },
  continueButtonText: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    textAlign: 'center',
  },
});
