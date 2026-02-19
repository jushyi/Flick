/**
 * useCamera (iOS)
 *
 * iOS-specific camera hook. Adds ultra-wide lens detection and switching via
 * AVFoundation lens strings ("Back Camera", "Back Ultra Wide Camera", etc.).
 *
 * Front camera gets a 0.5x option via full-sensor framing (cameraZoom: 0).
 * Back camera gets 0.5x when the device has a physical ultra-wide lens.
 *
 * Zoom levels:
 *   Front:                 [0.5, 1, 2, 3]
 *   Back + ultra-wide:     [0.5(uw), 1, 2, 3]
 *   Back without ultra-wide: [1, 2, 3]
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
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
 * Custom hook for iOS camera logic
 *
 * Wraps useCameraBase and adds iOS-specific lens detection + zoom levels.
 */
const useCamera = () => {
  const base = useCameraBase();
  const { facing, setFacing, zoom, setZoom, cameraRef } = base;

  // iOS lens state
  const [availableLenses, setAvailableLenses] = useState([]);
  const [selectedLens, setSelectedLens] = useState(null);
  const [hasUltraWide, setHasUltraWide] = useState(false);

  // Debug: log lens changes to verify switching works
  useEffect(() => {
    logger.info('useCamera.ios: selectedLens changed', { selectedLens });
  }, [selectedLens]);

  // Get wide-angle lens string (typically "Back Camera") for base zoom levels
  const wideAngleLens = useMemo(() => {
    if (facing !== 'back' || availableLenses.length === 0) return null;
    return availableLenses.find(lens => lens.toLowerCase() === 'back camera') || null;
  }, [availableLenses, facing]);

  // Get front camera lens string (typically "Front TrueDepth Camera")
  const frontCameraLens = useMemo(() => {
    if (facing !== 'front' || availableLenses.length === 0) return null;
    return availableLenses.find(lens => lens.toLowerCase().includes('front')) || null;
  }, [availableLenses, facing]);

  // Build zoom levels based on device capabilities
  const zoomLevels = useMemo(() => {
    // Front camera: use full sensor at 0x for "0.5x" (standard iOS front-cam widest framing)
    if (facing === 'front') {
      return [
        { label: '0.5', value: 0.5, lens: frontCameraLens, cameraZoom: 0 }, // Full sensor (widest)
        { label: '1', value: 1, lens: frontCameraLens, cameraZoom: 0.05 }, // Standard selfie framing
        { label: '2', value: 2, lens: frontCameraLens, cameraZoom: 0.17 }, // 2x digital zoom
        { label: '3', value: 3, lens: frontCameraLens, cameraZoom: 0.33 }, // 3x digital zoom
      ];
    }

    // Build base levels with explicit wide-angle lens
    const baseLevels = ZOOM_LEVELS_BASE.map(level => ({
      ...level,
      lens: wideAngleLens,
    }));

    // Add 0.5x when device has a physical ultra-wide lens on back camera
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
      return [{ ...ULTRA_WIDE_LEVEL, lens: ultraWideLens }, ...baseLevels];
    }

    return baseLevels;
  }, [hasUltraWide, facing, availableLenses, wideAngleLens, frontCameraLens]);

  // Fallback: try to get lenses via async method when camera ref is available
  useEffect(() => {
    const checkLensesAsync = async () => {
      if (cameraRef.current && !hasUltraWide && facing === 'back') {
        try {
          const lenses = await cameraRef.current.getAvailableLensesAsync();
          logger.info('useCamera.ios: Got lenses via async method', { lenses });
          if (lenses && lenses.length > 0) {
            setAvailableLenses(lenses);
            const hasUW = lenses.some(
              lens =>
                lens.toLowerCase().includes('ultra wide') ||
                lens.toLowerCase().includes('ultrawide')
            );
            setHasUltraWide(hasUW);
            if (hasUW) {
              logger.info('useCamera.ios: Ultra-wide lens detected via async method');
            }
          }
        } catch (error) {
          logger.debug('useCamera.ios: getAvailableLensesAsync not available or failed', {
            error: error.message,
          });
        }
      }
    };

    // Small delay to ensure camera is mounted
    const timeoutId = setTimeout(checkLensesAsync, 500);
    return () => clearTimeout(timeoutId);
  }, [facing, hasUltraWide, cameraRef]);

  // Set the correct lens when availableLenses becomes available
  // Ensures the camera uses the standard wide-angle lens (1x) on launch, not ultra-wide
  useEffect(() => {
    if (wideAngleLens && !selectedLens && facing === 'back') {
      logger.info('useCamera.ios: Setting initial lens to wide-angle on mount', {
        wideAngleLens,
      });
      setSelectedLens(wideAngleLens);
    }
  }, [wideAngleLens, selectedLens, facing]);

  // Set the front camera lens when detected
  useEffect(() => {
    if (frontCameraLens && !selectedLens && facing === 'front') {
      logger.info('useCamera.ios: Setting initial lens to front camera', { frontCameraLens });
      setSelectedLens(frontCameraLens);
    }
  }, [frontCameraLens, selectedLens, facing]);

  const toggleCameraFacing = useCallback(() => {
    lightImpact();
    const newFacing = facing === 'back' ? 'front' : 'back';

    if (newFacing === 'front') {
      // Clear lens — front camera lens effect will set it when detected
      setSelectedLens(null);
      // Map current zoom value to front camera cameraZoom (lens will be set by effect)
      const frontZoomMap = { 0.5: 0, 1: 0.05, 2: 0.17, 3: 0.33 };
      const cameraZoom = frontZoomMap[zoom.value] ?? 0.05;
      setZoom({ label: String(zoom.value), value: zoom.value, lens: null, cameraZoom });
    } else {
      // Switching to back camera
      if (zoom.value === 0.5) {
        if (hasUltraWide) {
          const uwLens = availableLenses.find(
            l => l.toLowerCase().includes('ultra wide') || l.toLowerCase().includes('ultrawide')
          );
          setSelectedLens(uwLens || null);
          setZoom({ ...ULTRA_WIDE_LEVEL, lens: uwLens });
        } else {
          // No ultra-wide on back, reset to 1x
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
  }, [facing, zoom.value, hasUltraWide, availableLenses, wideAngleLens, setFacing, setZoom]);

  const handleZoomChange = useCallback(
    zoomLevel => {
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

  // Handle available lenses change from CameraView callback
  const handleAvailableLensesChanged = useCallback(event => {
    if (!event?.lenses) return;
    logger.info('useCamera.ios: onAvailableLensesChanged fired', {
      lenses: event.lenses,
      count: event.lenses.length,
    });
    setAvailableLenses(event.lenses);
    // Check for ultra-wide: "Back Ultra Wide Camera" or "builtInUltraWideCamera"
    const hasUW = event.lenses.some(
      lens => lens.toLowerCase().includes('ultra wide') || lens.toLowerCase().includes('ultrawide')
    );
    setHasUltraWide(hasUW);
    logger.info('useCamera.ios: Ultra-wide detection result', {
      hasUltraWide: hasUW,
      lenses: event.lenses,
    });
  }, []);

  return {
    // Spread all shared base values
    ...base,

    // iOS lens state
    selectedLens,
    zoomLevels,

    // Override base handlers with iOS-specific versions
    toggleCameraFacing,
    handleZoomChange,
    handleAvailableLensesChanged,
  };
};

export default useCamera;
