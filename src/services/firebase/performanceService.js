import { getPerformance, trace as createTrace } from '@react-native-firebase/perf';

/**
 * Initialize performance monitoring.
 * Disables collection in dev mode to prevent polluting production data.
 */
export function initPerformanceMonitoring() {
  if (__DEV__) {
    const perf = getPerformance();
    perf.dataCollectionEnabled = false;
  }
}

/**
 * Reusable trace wrapper with guaranteed stop().
 * @param {string} traceName - Feature-prefixed name (e.g., 'feed/load')
 * @param {Function} operation - Async function to trace. Receives trace as arg for adding metrics.
 * @param {Object} [attributes] - Up to 4 key-value string pairs (1 slot reserved for success)
 * @returns {Promise<*>} Result of the operation
 */
export async function withTrace(traceName, operation, attributes) {
  if (__DEV__) return operation({ putMetric: () => {}, putAttribute: () => {} });

  const perf = getPerformance();
  const t = createTrace(perf, traceName);
  await t.start();

  if (attributes) {
    const entries = Object.entries(attributes).slice(0, 4); // Reserve 1 slot for success
    for (const [key, value] of entries) {
      t.putAttribute(key, String(value).slice(0, 100));
    }
  }

  try {
    const result = await operation(t);
    t.putAttribute('success', 'true');
    return result;
  } catch (error) {
    t.putAttribute('success', 'false');
    throw error;
  } finally {
    await t.stop();
  }
}
