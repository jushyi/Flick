/**
 * CameraScreen styles
 *
 * Extracted from CameraScreen.js as part of three-way separation refactoring.
 * Contains all StyleSheet definitions for the camera screen component.
 */

import { StyleSheet, Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Layout constants
const TAB_BAR_HEIGHT = 65; // Bottom tab navigator height (includes safe area)
const FOOTER_HEIGHT = 200; // Covers ~1/4 of screen for iOS-native camera feel
const CAMERA_HEIGHT = SCREEN_HEIGHT - FOOTER_HEIGHT - TAB_BAR_HEIGHT;
const CAMERA_BORDER_RADIUS = 24; // Rounded corners for camera preview
const FLOATING_BUTTON_SIZE = 45; // Flash, flip buttons (10% smaller, floating above footer)
const FLOATING_BUTTON_OFFSET = 8; // Distance above footer edge

// Card dimensions for darkroom button (4:3 aspect ratio like a photo)
const CARD_WIDTH = 63; // ~95% of capture button size (84 * 0.75 for 4:3 aspect)
const CARD_HEIGHT = 84; // ~95% of capture button diameter (88 * 0.95)

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
    backgroundColor: '#000000', // Match container background to prevent outline artifacts
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
    paddingHorizontal: 16,
  },
  // Floating button - 45px (10% smaller than 50px), for flash and flip
  floatingButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
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
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
    paddingHorizontal: 40,
    width: '100%',
  },
  // Zoom control bar - centered in floating controls row
  zoomBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 25,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  zoomButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  zoomButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  zoomLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  zoomButtonTextActive: {
    color: '#FFFFFF',
  },
  zoomSuffix: {
    fontSize: 12, // Slightly smaller for the 'x'
    marginLeft: 1,
  },
  // Permission screens
  permissionContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  // Darkroom card stack container - holds fanned cards
  darkroomCardContainer: {
    width: CARD_WIDTH + 20, // Extra space for fanning offset (increased for larger cards)
    height: CARD_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  darkroomCardDisabled: {
    opacity: 0.4,
  },
  // Wrapper for animated card positioning
  darkroomCardWrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    // Card shadow for depth
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  // Gradient background for the card (fills wrapper)
  darkroomCardGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Number displayed inside the top card
  darkroomCardText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Invisible spacer to balance darkroom button and center capture button
  footerSpacer: {
    width: CARD_WIDTH + 20, // Match container width
    height: CARD_HEIGHT,
    opacity: 0,
  },
  // Flash auto indicator (small letter on button)
  flashLabel: {
    position: 'absolute',
    bottom: 4,
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // Capture button - 88px (10% larger) with thin spaced ring
  captureButtonOuter: {
    width: 100, // 88px button + 6px gap on each side + 2px ring = 100px
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
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
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
  },
  // Flash overlay for camera shutter effect - contained within camera preview
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: CAMERA_BORDER_RADIUS,
    borderBottomRightRadius: CAMERA_BORDER_RADIUS,
    zIndex: 100,
  },
});
