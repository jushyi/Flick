/**
 * useCamera (Android)
 *
 * Android camera hook. Uses digital zoom only — [1, 2, 3] — on both front
 * and back cameras. No physical lens switching.
 *
 * Android's lens enumeration APIs are not accessible from expo-camera's JS
 * layer (onAvailableLensesChanged never fires, getAvailableLensesAsync is
 * iOS-only, and the native CameraView ref exposes no camera info methods),
 * so ultra-wide (0.5x) is not supported on Android at this time.
 */

import { useCallback } from 'react';
import useCameraBase, {
  ZOOM_LEVELS_BASE,
  TAB_BAR_HEIGHT,
  FOOTER_HEIGHT,
  CAMERA_HEIGHT,
  CAMERA_BORDER_RADIUS,
  FLOATING_BUTTON_SIZE,
  FLOATING_BUTTON_OFFSET,
  CARD_WIDTH,
  CARD_HEIGHT,
  BASE_ROTATION_PER_CARD,
  BASE_OFFSET_PER_CARD,
  SPREAD_ROTATION_MULTIPLIER,
  SPREAD_OFFSET_MULTIPLIER,
} from './useCameraBase';
import logger from '../utils/logger';
import { lightImpact } from '../utils/haptics';

// Re-export layout constants so CameraScreen can import them from the single
// 'useCamera' path without needing to know about useCameraBase.
export {
  TAB_BAR_HEIGHT,
  FOOTER_HEIGHT,
  CAMERA_HEIGHT,
  CAMERA_BORDER_RADIUS,
  FLOATING_BUTTON_SIZE,
  FLOATING_BUTTON_OFFSET,
  CARD_WIDTH,
  CARD_HEIGHT,
  BASE_ROTATION_PER_CARD,
  BASE_OFFSET_PER_CARD,
  SPREAD_ROTATION_MULTIPLIER,
  SPREAD_OFFSET_MULTIPLIER,
};

/**
 * Custom hook for Android camera logic
 *
 * Wraps useCameraBase with Android-appropriate zoom handling.
 * Digital zoom only — [1, 2, 3] on both front and back cameras.
 */
const useCamera = () => {
  const base = useCameraBase();
  const { facing, setFacing, zoom, setZoom } = base;

  // Android uses digital zoom only — same levels for front and back
  const zoomLevels = ZOOM_LEVELS_BASE;

  // Reset zoom to 1x when flipping cameras
  const toggleCameraFacing = useCallback(() => {
    lightImpact();
    setZoom(ZOOM_LEVELS_BASE[0]);
    setFacing(facing === 'back' ? 'front' : 'back');
  }, [facing, setFacing, setZoom]);

  const handleZoomChange = useCallback(
    zoomLevel => {
      if (zoomLevel.value !== zoom.value) {
        lightImpact();
        setZoom(zoomLevel);
        logger.info('useCamera.android: Zoom level changed', {
          from: zoom.value,
          to: zoomLevel.value,
        });
      }
    },
    [zoom.value, setZoom]
  );

  // No-op: onAvailableLensesChanged never fires on Android (iOS only in expo-camera)
  const handleAvailableLensesChanged = useCallback(() => {}, []);

  return {
    ...base,
    selectedLens: null, // No lens switching on Android
    zoomLevels,
    toggleCameraFacing,
    handleZoomChange,
    handleAvailableLensesChanged,
  };
};

export default useCamera;
