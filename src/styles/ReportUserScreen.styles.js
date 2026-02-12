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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  headerButton: {
    width: spacing.xxl,
    height: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: spacing.xxl,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    flexGrow: 1,
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  reasonIcon: {
    marginRight: spacing.md,
  },
  reasonLabel: {
    flex: 1,
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
  },
  checkmark: {
    marginLeft: spacing.xs,
  },
  detailsContainer: {
    marginTop: spacing.lg,
  },
  detailsInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: layout.borderRadius.md,
    padding: spacing.md,
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  submitButton: {
    backgroundColor: colors.interactive.primary,
    borderRadius: layout.borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.inverse,
  },
});
