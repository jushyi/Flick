/**
 * DarkroomScreen styles
 *
 * StyleSheet definitions for the darkroom screen component.
 */

import { Platform, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  // Transparent background for gesture handler so no second background shows during swipe
  gestureRootView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.size.xxl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  statusBarCover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background.primary,
    zIndex: layout.zIndex.overlay,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: Platform.OS === 'android' ? 8 : spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.overlay.light,
    zIndex: layout.zIndex.dropdown,
    backgroundColor: colors.background.primary,
  },
  backButton: {
    width: spacing.xxl,
    height: spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.overlay.light,
    borderRadius: layout.borderRadius.xl,
  },
  downChevron: {
    width: 12,
    height: 12,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.text.primary,
    transform: [{ rotate: '45deg' }],
    marginTop: -4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: spacing.md,
  },
  // Done button disabled state
  doneButtonDisabled: {
    opacity: 0.5,
  },
  // Undo button styles
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.overlay.light,
    borderRadius: layout.borderRadius.xl,
  },
  undoButtonDisabled: {
    opacity: 0.3,
  },
  undoIcon: {
    marginRight: spacing.xxs,
  },
  undoText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  undoTextDisabled: {
    opacity: 0.5,
  },
  // Placeholder for empty state header to maintain layout balance
  headerRightPlaceholder: {
    width: 70,
    height: spacing.xxl,
  },
  headerTitle: {
    fontSize: typography.size.xxl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
    textAlign: 'center',
    ...Platform.select({ android: { includeFontPadding: false, lineHeight: 32 } }),
  },
  headerSubtitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  photoCardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.md + spacing.md,
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.background.primary,
    zIndex: 1,
  },
  triageButtonBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
    zIndex: 10,
    elevation: 10,
  },
  archiveButton: {
    flex: 1,
    height: spacing.huge,
    borderRadius: layout.borderRadius.xl,
    backgroundColor: colors.status.developing, // Amber
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  deleteButton: {
    width: spacing.huge,
    height: spacing.huge,
    borderRadius: layout.borderRadius.xl,
    backgroundColor: colors.system.iosRed, // iOS red for delete
    justifyContent: 'center',
    alignItems: 'center',
  },
  journalButton: {
    flex: 1,
    height: spacing.huge,
    borderRadius: layout.borderRadius.xl,
    backgroundColor: colors.interactive.primary, // Cyan for journal
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  triageButtonIcon: {
    fontSize: typography.size.xl,
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bodyBold,
    marginRight: spacing.xxs,
  },
  deleteButtonIcon: {
    fontSize: typography.size.xxl,
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bodyBold,
  },
  archiveButtonText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  journalButtonText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  // Inline success state styles
  successContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  successContentArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: spacing.xxl,
  },
  successTitleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  successTitle: {
    fontSize: typography.size.display,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    textAlign: 'center',
    ...Platform.select({ android: { includeFontPadding: false, lineHeight: 44 } }),
  },
  doneButtonBottom: {
    backgroundColor: colors.system.blue, // iOS blue
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxxl,
    borderRadius: layout.borderRadius.xl,
    alignSelf: 'center',
    marginBottom: 20,
  },
  doneButtonText: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    ...Platform.select({ android: { includeFontPadding: false, lineHeight: 26 } }),
  },
});
