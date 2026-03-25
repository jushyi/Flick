import { useState, useEffect, useCallback, useMemo } from 'react';
import useCameraBase, {
  ZOOM_LEVELS_BASE,
  ULTRA_WIDE_LEVEL,
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

type LensesChangedEvent = {
  lenses?: string[];
};

type UseCameraReturn = UseCameraBaseReturn & {
  selectedLens: string | null;
  zoomLevels: ZoomLevel[];
  toggleCameraFacing: () => void;
  handleZoomChange: (zoomLevel: ZoomLevel) => void;
  handleAvailableLensesChanged: (event: LensesChangedEvent) => void;
};

const useCamera = (options: CameraOptions = {}): UseCameraReturn => {
  const base = useCameraBase(options);
  const { facing, setFacing, zoom, setZoom, cameraRef, isFacingLockedRef } = base;

  const [availableLenses, setAvailableLenses] = useState<string[]>([]);
  const [selectedLens, setSelectedLens] = useState<string | null>(null);
  const [hasUltraWide, setHasUltraWide] = useState(false);

  useEffect(() => {
    logger.info('useCamera.ios: selectedLens changed', { selectedLens });
  }, [selectedLens]);

  const wideAngleLens = useMemo((): string | null => {
    if (facing !== 'back' || availableLenses.length === 0) return null;
    return availableLenses.find(lens => lens.toLowerCase() === 'back camera') || null;
  }, [availableLenses, facing]);

  const frontCameraLens = useMemo((): string | null => {
    if (facing !== 'front' || availableLenses.length === 0) return null;
    return availableLenses.find(lens => lens.toLowerCase().includes('front')) || null;
  }, [availableLenses, facing]);

  const zoomLevels = useMemo((): ZoomLevel[] => {
    if (facing === 'front') {
      return [
        { label: '0.5', value: 0.5, lens: frontCameraLens, cameraZoom: 0 },
        { label: '1', value: 1, lens: frontCameraLens, cameraZoom: 0.05 },
        { label: '2', value: 2, lens: frontCameraLens, cameraZoom: 0.17 },
        { label: '3', value: 3, lens: frontCameraLens, cameraZoom: 0.33 },
      ];
    }

    const baseLevels: ZoomLevel[] = ZOOM_LEVELS_BASE.map(level => ({
      ...level,
      lens: wideAngleLens,
    }));

    if (hasUltraWide && facing === 'back') {
      const ultraWideLens = availableLenses.find(
        lens =>
          lens.toLowerCase().includes('ultra wide') || lens.toLowerCase().includes('ultrawide')
      );
      logger.debug('useCamera.ios: Building zoom levels with ultra-wide', {
        ultraWideLens,
        wideAngleLens,
        facing,
      });
      return [{ ...ULTRA_WIDE_LEVEL, lens: ultraWideLens || null }, ...baseLevels];
    }

    return baseLevels;
  }, [hasUltraWide, facing, availableLenses, wideAngleLens, frontCameraLens]);

  useEffect(() => {
    const checkLensesAsync = async () => {
      if (cameraRef.current && !hasUltraWide && facing === 'back') {
        try {
          const lenses = await (cameraRef.current as unknown as { getAvailableLensesAsync: () => Promise<string[]> }).getAvailableLensesAsync();
          logger.info('useCamera.ios: Got lenses via async method', { lenses });
          if (lenses && lenses.length > 0) {
            setAvailableLenses(lenses);
            const hasUW = lenses.some(
              (lens: string) =>
                lens.toLowerCase().includes('ultra wide') ||
                lens.toLowerCase().includes('ultrawide')
            );
            setHasUltraWide(hasUW);
            if (hasUW) {
              logger.info('useCamera.ios: Ultra-wide lens detected via async method');
            }
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          logger.debug('useCamera.ios: getAvailableLensesAsync not available or failed', {
            error: message,
          });
        }
      }
    };

    const timeoutId = setTimeout(checkLensesAsync, 500);
    return () => clearTimeout(timeoutId);
  }, [facing, hasUltraWide, cameraRef]);

  useEffect(() => {
    if (wideAngleLens && !selectedLens && facing === 'back') {
      logger.info('useCamera.ios: Setting initial lens to wide-angle on mount', {
        wideAngleLens,
      });
      setSelectedLens(wideAngleLens);
    }
  }, [wideAngleLens, selectedLens, facing]);

  useEffect(() => {
    if (frontCameraLens && !selectedLens && facing === 'front') {
      logger.info('useCamera.ios: Setting initial lens to front camera', { frontCameraLens });
      setSelectedLens(frontCameraLens);
    }
  }, [frontCameraLens, selectedLens, facing]);

  const toggleCameraFacing = useCallback(() => {
    if (isFacingLockedRef.current) return;

    lightImpact();
    const newFacing = facing === 'back' ? 'front' : 'back';

    if (newFacing === 'front') {
      setSelectedLens(null);
      const frontZoomMap: Record<number, number> = { 0.5: 0, 1: 0.05, 2: 0.17, 3: 0.33 };
      const cameraZoom = frontZoomMap[zoom.value] ?? 0.05;
      setZoom({ label: String(zoom.value), value: zoom.value, lens: null, cameraZoom });
    } else {
      if (zoom.value === 0.5) {
        if (hasUltraWide) {
          const uwLens = availableLenses.find(
            l => l.toLowerCase().includes('ultra wide') || l.toLowerCase().includes('ultrawide')
          );
          setSelectedLens(uwLens || null);
          setZoom({ ...ULTRA_WIDE_LEVEL, lens: uwLens || null });
        } else {
          setZoom({ ...ZOOM_LEVELS_BASE[0], lens: wideAngleLens });
          setSelectedLens(wideAngleLens);
        }
      } else {
        const baseLevel = ZOOM_LEVELS_BASE.find(l => l.value === zoom.value) || ZOOM_LEVELS_BASE[0];
        setZoom({ ...baseLevel, lens: wideAngleLens });
        setSelectedLens(wideAngleLens);
      }
    }

    setFacing(newFacing);
  }, [
    facing,
    zoom.value,
    hasUltraWide,
    availableLenses,
    wideAngleLens,
    setFacing,
    setZoom,
    isFacingLockedRef,
  ]);

  const handleZoomChange = useCallback(
    (zoomLevel: ZoomLevel) => {
      if (zoomLevel.value !== zoom.value) {
        lightImpact();
        setZoom(zoomLevel);
        setSelectedLens(zoomLevel.lens || null);
        logger.info('useCamera.ios: Zoom level changed', {
          from: zoom.value,
          to: zoomLevel.value,
          lens: zoomLevel.lens,
          selectedLens: zoomLevel.lens || null,
        });
      }
    },
    [zoom.value, setZoom]
  );

  const handleAvailableLensesChanged = useCallback((event: LensesChangedEvent) => {
    if (!event?.lenses) return;
    logger.info('useCamera.ios: onAvailableLensesChanged fired', {
      lenses: event.lenses,
      count: event.lenses.length,
    });
    setAvailableLenses(event.lenses);
    const hasUW = event.lenses.some(
      (lens: string) => lens.toLowerCase().includes('ultra wide') || lens.toLowerCase().includes('ultrawide')
    );
    setHasUltraWide(hasUW);
    logger.info('useCamera.ios: Ultra-wide detection result', {
      hasUltraWide: hasUW,
      lenses: event.lenses,
    });
  }, []);

  return {
    ...base,
    selectedLens,
    zoomLevels,
    toggleCameraFacing,
    handleZoomChange,
    handleAvailableLensesChanged,
  };
};

export default useCamera;
