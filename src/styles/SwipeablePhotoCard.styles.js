/**
 * SwipeablePhotoCard styles
 *
 * StyleSheet definitions for the swipeable photo card component.
 */

import { StyleSheet, Dimensions } from 'react-native';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const styles = StyleSheet.create({
  cardContainer: {
    // Absolute positioning for stacking cards on top of each other
    position: 'absolute',
    width: SCREEN_WIDTH * 0.92,
    alignSelf: 'center',
    borderRadius: layout.borderRadius.sm,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    elevation: 0,
  },
  photoImage: {
    width: '100%',
    aspectRatio: 4 / 5,
    // Black background matches screen, prevents any flash
    // during cascade animation if image needs brief moment to render
    backgroundColor: colors.background.primary,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  archiveOverlay: {
    backgroundColor: colors.status.developing,
  },
  journalOverlay: {
    backgroundColor: colors.interactive.primary,
  },
  deleteOverlay: {
    backgroundColor: colors.status.danger,
  },
  iconContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  // Checkmark circle for Journal
  checkmarkCircle: {
    width: 52,
    height: 52,
    borderWidth: 3,
    borderColor: colors.text.primary,
    borderRadius: layout.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    fontSize: typography.size.xxxl,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  // X icon for Delete
  xIcon: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  xLine: {
    position: 'absolute',
    width: 40,
    height: 4,
    backgroundColor: colors.text.primary,
    borderRadius: layout.borderRadius.sm,
  },
  xLine1: {
    transform: [{ rotate: '45deg' }],
  },
  xLine2: {
    transform: [{ rotate: '-45deg' }],
  },
  overlayText: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // Tag overlay button - bottom-right of photo card
  tagOverlayButton: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: layout.borderRadius.full,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  tagOverlayBadge: {
    position: 'absolute',
    top: spacing.xxs,
    right: spacing.xxs,
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: layout.borderRadius.full,
    backgroundColor: colors.interactive.primary,
  },
});
