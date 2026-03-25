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
import type { ZoomLevel, UseCameraBaseReturn } from './useCameraBase';
import logger from '../utils/logger';
import { lightImpact } from '../utils/haptics';

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

type CameraOptions = {
  mode?: 'normal' | 'snap';
  onSnapCapture?: ((media: { uri: string; mediaType: 'photo' | 'video' }) => void) | null;
};

type UseCameraReturn = UseCameraBaseReturn & {
  selectedLens: string | null;
  zoomLevels: ZoomLevel[];
  toggleCameraFacing: () => void;
  handleZoomChange: (zoomLevel: ZoomLevel) => void;
  handleAvailableLensesChanged: () => void;
};

const useCamera = (options: CameraOptions = {}): UseCameraReturn => {
  const base = useCameraBase(options);
  const { facing, setFacing, zoom, setZoom } = base;

  const zoomLevels: ZoomLevel[] = ZOOM_LEVELS_BASE;

  const toggleCameraFacing = useCallback(() => {
    if (base.isFacingLockedRef.current) return;

    lightImpact();
    setZoom(ZOOM_LEVELS_BASE[0]);
    setFacing(facing === 'back' ? 'front' : 'back');
  }, [facing, setFacing, setZoom, base.isFacingLockedRef]);

  const handleZoomChange = useCallback(
    (zoomLevel: ZoomLevel) => {
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

  const handleAvailableLensesChanged = useCallback(() => {}, []);

  return {
    ...base,
    selectedLens: null,
    zoomLevels,
    toggleCameraFacing,
    handleZoomChange,
    handleAvailableLensesChanged,
  };
};

export default useCamera;
