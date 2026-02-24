/**
 * CameraScreen styles
 *
 * StyleSheet definitions for the camera screen component.
 */

import { Platform, StyleSheet, Dimensions } from 'react-native';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const TAB_BAR_HEIGHT = layout.dimensions.tabBarHeight; // Bottom tab navigator height (includes safe area)
const FOOTER_HEIGHT = layout.dimensions.footerHeight; // Covers ~1/4 of screen for iOS-native camera feel
const CAMERA_HEIGHT = SCREEN_HEIGHT - FOOTER_HEIGHT - TAB_BAR_HEIGHT;
const CAMERA_BORDER_RADIUS = layout.dimensions.cameraBorderRadius; // Rounded corners for camera preview
const FLOATING_BUTTON_SIZE = 45; // Flash, flip buttons (10% smaller, floating above footer)
const FLOATING_BUTTON_OFFSET = 8; // Distance above footer edge

// Card dimensions for darkroom button (4:3 aspect ratio like a photo)
const CARD_WIDTH = 63; // ~95% of capture button size (84 * 0.75 for 4:3 aspect)
const CARD_HEIGHT = 84; // ~95% of capture button diameter (88 * 0.95)

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  // Camera container - edge-to-edge with rounded bottom corners only
  cameraContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: CAMERA_HEIGHT,
    borderBottomLeftRadius: CAMERA_BORDER_RADIUS,
    borderBottomRightRadius: CAMERA_BORDER_RADIUS,
    overflow: 'hidden',
    borderWidth: 0, // Explicitly remove any border
    backgroundColor: colors.background.primary, // Match container background to prevent outline artifacts
  },
  // Camera container for snap mode - full screen, no tab bar or footer offset
  cameraContainerSnap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    borderWidth: 0,
    backgroundColor: colors.background.primary,
  },
  // Camera - fills the container
  camera: {
    flex: 1,
  },
  // Floating controls row - positioned above footer, over camera preview
  floatingControls: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT + FOOTER_HEIGHT + FLOATING_BUTTON_OFFSET,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  // Floating button - 45px (10% smaller than 50px), for flash and flip
  floatingButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay.dark,
    width: FLOATING_BUTTON_SIZE,
    height: FLOATING_BUTTON_SIZE,
    borderRadius: FLOATING_BUTTON_SIZE / 2,
  },
  // Footer bar - absolute positioned, black background (matches nav bar), above tab bar
  footerBar: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT,
    left: 0,
    right: 0,
    height: FOOTER_HEIGHT,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
    paddingHorizontal: spacing.xxl,
    width: '100%',
  },
  // Zoom control bar - centered in floating controls row
  zoomBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.overlay.dark,
    borderRadius: layout.borderRadius.xl,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  zoomButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: layout.borderRadius.xl,
  },
  zoomButtonActive: {
    backgroundColor: colors.overlay.lightBorder,
  },
  zoomLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomButtonText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.overlay.lightMedium,
  },
  zoomButtonTextActive: {
    color: colors.text.primary,
  },
  zoomSuffix: {
    fontSize: typography.size.sm, // Slightly smaller for the 'x'
    fontFamily: typography.fontFamily.readable,
    marginLeft: 1,
  },
  // Permission screens
  permissionContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  permissionTitle: {
    fontSize: typography.size.xxl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  permissionButton: {
    backgroundColor: colors.background.white,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: layout.borderRadius.md,
  },
  permissionButtonText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.inverse,
  },
  // Darkroom card stack container - holds fanned cards
  darkroomCardContainer: {
    width: CARD_WIDTH + 40, // Extra space for fanning offset + glow
    height: CARD_HEIGHT + 32, // Extra space for glow
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  darkroomCardDisabled: {
    opacity: 0.4,
  },
  // Wrapper for animated card positioning
  darkroomCardWrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: layout.borderRadius.sm,
    // Border handled by SVG stroke in GradientCard — no native border needed
    // White glow effect emanating from card edges (iOS shadow props only)
    shadowColor: colors.text.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    // Android: elevation without backgroundColor injects a dark Material surface background.
    // Shadow props are iOS-only (no glow on Android), so elevation is not needed.
    ...Platform.select({ android: { elevation: 0 } }),
  },
  // Gradient background for the card (fills wrapper)
  darkroomCardGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Number displayed inside the top card
  darkroomCardText: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    lineHeight: 28,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  // Invisible spacer to balance darkroom button and center capture button
  footerSpacer: {
    width: CARD_WIDTH + 40, // Match container width
    height: CARD_HEIGHT + 32, // Match container height
    opacity: 0,
  },
  // Flash auto indicator (small letter on button)
  flashLabel: {
    position: 'absolute',
    bottom: 4,
    fontSize: 8,
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bodyBold,
  },
  // Capture button - 88px (10% larger) with thin spaced ring
  captureButtonOuter: {
    width: 100, // 88px button + 6px gap on each side + 2px ring = 100px
    height: 100,
    borderRadius: layout.borderRadius.full,
    borderWidth: 2,
    borderColor: colors.overlay.lightMedium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 88,
    height: 88,
    borderRadius: layout.borderRadius.full,
    backgroundColor: colors.background.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.text.inverse,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonPressed: {
    opacity: 0.7,
  },
  captureButtonInner: {
    width: 76,
    height: 76,
    borderRadius: layout.borderRadius.full,
    backgroundColor: colors.background.white,
  },
  // Flash overlay for camera shutter effect - contained within camera preview
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background.white,
    borderBottomLeftRadius: CAMERA_BORDER_RADIUS,
    borderBottomRightRadius: CAMERA_BORDER_RADIUS,
    zIndex: 100,
  },
});
