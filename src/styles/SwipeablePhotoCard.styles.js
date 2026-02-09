/**
 * SwipeablePhotoCard styles
 *
 * Extracted from SwipeablePhotoCard.js as part of three-way separation refactoring.
 * Contains all StyleSheet definitions for the swipeable photo card component.
 */

import { StyleSheet, Dimensions } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const styles = StyleSheet.create({
  cardContainer: {
    // Absolute positioning for stacking cards on top of each other (UAT-005)
    position: 'absolute',
    width: SCREEN_WIDTH * 0.92,
    alignSelf: 'center',
    // UAT-014: Reduced border radius from 24 to 6 for subtler rounded corners
    borderRadius: 6,
    // UAT-012: Black background matches screen, prevents gray flash during cascade
    backgroundColor: colors.background.primary,
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
    backgroundColor: colors.systemColors.gray,
  },
  journalOverlay: {
    backgroundColor: colors.systemColors.green,
  },
  deleteOverlay: {
    backgroundColor: colors.status.danger,
  },
  iconContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  // Box icon for Archive
  boxIcon: {
    width: 48,
    height: 48,
    borderWidth: 3,
    borderColor: colors.text.primary,
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxIconInner: {
    width: 24,
    height: 6,
    backgroundColor: colors.text.primary,
    borderRadius: 2,
    marginTop: -12,
  },
  // Checkmark circle for Journal
  checkmarkCircle: {
    width: 52,
    height: 52,
    borderWidth: 3,
    borderColor: colors.text.primary,
    borderRadius: 9999,
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
    borderRadius: 2,
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
    bottom: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 9999,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  tagOverlayBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 9999,
    backgroundColor: colors.interactive.primary,
  },
});
