import { useEffect, useRef, useCallback } from 'react';
import * as Sentry from '@sentry/react-native';

/**
 * Track screen load performance via Sentry spans.
 * Call markLoaded() when the screen has finished loading its primary content.
 * Disabled in __DEV__ to avoid noise in development.
 */
export function useScreenTrace(screenName: string) {
  const spanRef = useRef<ReturnType<typeof Sentry.startInactiveSpan> | null>(null);

  useEffect(() => {
    if (__DEV__) return;

    const span = Sentry.startInactiveSpan({
      name: `screen/${screenName}`,
      op: 'ui.load',
    });
    spanRef.current = span;

    return () => {
      if (spanRef.current) {
        spanRef.current.end();
        spanRef.current = null;
      }
    };
  }, [screenName]);

  const markLoaded = useCallback((metrics?: Record<string, number>) => {
    if (__DEV__) return;
    if (spanRef.current) {
      if (metrics) {
        for (const [key, value] of Object.entries(metrics)) {
          spanRef.current.setAttribute(key, value);
        }
      }
      spanRef.current.end();
      spanRef.current = null;
    }
  }, []);

  return { markLoaded };
}
