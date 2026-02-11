import { useEffect, useRef, useCallback } from 'react';
import perf from '@react-native-firebase/perf';

/**
 * Hook that measures time from screen mount to data-ready.
 * Uses custom code traces (not startScreenTrace which crashes on iOS).
 * @param {string} screenName - Screen identifier (e.g., 'FeedScreen')
 * @returns {{ markLoaded: Function }} Call markLoaded(metrics?) when screen data is ready
 */
export function useScreenTrace(screenName) {
  const traceRef = useRef(null);

  useEffect(() => {
    if (__DEV__) return;

    let active = true;

    (async () => {
      const trace = await perf().startTrace(`screen/${screenName}`);
      if (active) {
        traceRef.current = trace;
      } else {
        await trace.stop();
      }
    })();

    return () => {
      active = false;
      if (traceRef.current) {
        traceRef.current.stop();
        traceRef.current = null;
      }
    };
  }, [screenName]);

  const markLoaded = useCallback(async metrics => {
    if (__DEV__) return;

    if (traceRef.current) {
      if (metrics) {
        for (const [key, value] of Object.entries(metrics)) {
          traceRef.current.putMetric(key, value);
        }
      }
      await traceRef.current.stop();
      traceRef.current = null;
    }
  }, []);

  return { markLoaded };
}
