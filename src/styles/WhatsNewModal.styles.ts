import { StyleSheet, Dimensions } from 'react-native';

import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MODAL_WIDTH = Math.min(SCREEN_WIDTH * 0.9, 400);

export default StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: MODAL_WIDTH,
    backgroundColor: colors.background.secondary,
    borderRadius: layout.borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  itemsContainer: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  bullet: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.brand.purple,
    marginRight: spacing.xs,
    lineHeight: 22,
  },
  itemText: {
    flex: 1,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  dismissButton: {
    width: '100%',
    backgroundColor: colors.brand.purple,
    paddingVertical: spacing.md,
    borderRadius: layout.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.dimensions.buttonMinHeight,
  },
  dismissButtonText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
});
