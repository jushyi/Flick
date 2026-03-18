/**
 * useScreenshotDetection
 *
 * Custom hook wrapping expo-screen-capture's addScreenshotListener.
 * Activates/deactivates the listener based on an `active` boolean and
 * calls an `onScreenshot` callback when a screenshot is detected.
 *
 * Features:
 * - Debounce: only the first screenshot per activation cycle triggers callback
 * - Silent failure: if addScreenshotListener is unavailable (some Android devices),
 *   logs a warning and continues without crashing
 * - Cleanup: removes listener on deactivation or unmount
 */

import * as ScreenCapture from 'expo-screen-capture';
import { useEffect, useRef, useCallback } from 'react';

import logger from '../utils/logger';

/**
 * @param {Object} options
 * @param {boolean} options.active - Whether screenshot detection should be active
 * @param {Function} options.onScreenshot - Callback invoked on first screenshot detection
 */
const useScreenshotDetection = ({ active, onScreenshot }) => {
  const listenerRef = useRef(null);
  const alreadyDetectedRef = useRef(false);
  const onScreenshotRef = useRef(onScreenshot);

  // Keep callback ref current to avoid stale closure in listener
  useEffect(() => {
    onScreenshotRef.current = onScreenshot;
  }, [onScreenshot]);

  useEffect(() => {
    if (active) {
      // Reset debounce flag on each activation cycle
      alreadyDetectedRef.current = false;

      try {
        listenerRef.current = ScreenCapture.addScreenshotListener(() => {
          if (alreadyDetectedRef.current) return;
          alreadyDetectedRef.current = true;
          onScreenshotRef.current?.();
        });
      } catch (error) {
        // Silent failure per user decision — some Android devices do not support
        // addScreenshotListener (API unavailable)
        logger.warn('useScreenshotDetection: addScreenshotListener unavailable', {
          error: error.message,
        });
      }
    } else {
      // Deactivate: remove listener
      listenerRef.current?.remove();
      listenerRef.current = null;
    }

    // Cleanup on unmount or dependency change
    return () => {
      listenerRef.current?.remove();
      listenerRef.current = null;
    };
  }, [active]);
};

export default useScreenshotDetection;
