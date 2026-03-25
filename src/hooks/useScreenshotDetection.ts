import * as ScreenCapture from 'expo-screen-capture';
import { useEffect, useRef } from 'react';

import logger from '../utils/logger';

type ScreenshotDetectionOptions = {
  active: boolean;
  onScreenshot: () => void;
};

const useScreenshotDetection = ({ active, onScreenshot }: ScreenshotDetectionOptions): void => {
  const listenerRef = useRef<{ remove: () => void } | null>(null);
  const alreadyDetectedRef = useRef(false);
  const onScreenshotRef = useRef(onScreenshot);

  useEffect(() => {
    onScreenshotRef.current = onScreenshot;
  }, [onScreenshot]);

  useEffect(() => {
    if (active) {
      alreadyDetectedRef.current = false;

      try {
        listenerRef.current = ScreenCapture.addScreenshotListener(() => {
          if (alreadyDetectedRef.current) return;
          alreadyDetectedRef.current = true;
          onScreenshotRef.current?.();
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn('useScreenshotDetection: addScreenshotListener unavailable', {
          error: message,
        });
      }
    } else {
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
