/**
 * useScreenshotDetection — Custom hook wrapping expo-screen-capture listener
 *
 * Activates/deactivates the screenshot listener based on an `active` boolean
 * and calls an `onScreenshot` callback when a screenshot is detected.
 *
 * Features:
 * - Activation control via `active` prop
 * - Debounce via alreadyDetectedRef (one callback per activation cycle)
 * - Silent failure on unsupported devices (try/catch around listener setup)
 * - Cleanup on deactivation or unmount
 */

import { useEffect, useRef } from 'react';

import * as ScreenCapture from 'expo-screen-capture';

import logger from '../utils/logger';

const useScreenshotDetection = ({ active, onScreenshot }) => {
  const listenerRef = useRef(null);
  const alreadyDetectedRef = useRef(false);
  const onScreenshotRef = useRef(onScreenshot);

  // Keep callback ref in sync to avoid stale closures
  useEffect(() => {
    onScreenshotRef.current = onScreenshot;
  }, [onScreenshot]);

  useEffect(() => {
    if (active) {
      // Reset debounce flag on each new activation cycle
      alreadyDetectedRef.current = false;

      try {
        listenerRef.current = ScreenCapture.addScreenshotListener(() => {
          if (alreadyDetectedRef.current) return;
          alreadyDetectedRef.current = true;
          onScreenshotRef.current?.();
        });
      } catch (error) {
        // expo-screen-capture may not be available on some Android devices
        logger.warn('useScreenshotDetection: addScreenshotListener unavailable', {
          error: error.message,
        });
      }
    } else {
      // Deactivate: remove listener
      listenerRef.current?.remove();
      listenerRef.current = null;
    }

    return () => {
      listenerRef.current?.remove();
      listenerRef.current = null;
    };
  }, [active]);
};

export default useScreenshotDetection;
