import perf from '@react-native-firebase/perf';

/**
 * Initialize performance monitoring.
 * Disables collection in dev mode to prevent polluting production data.
 */
export function initPerformanceMonitoring() {
  if (__DEV__) {
    perf().setPerformanceCollectionEnabled(false);
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

  const trace = await perf().startTrace(traceName);

  if (attributes) {
    const entries = Object.entries(attributes).slice(0, 4); // Reserve 1 slot for success
    for (const [key, value] of entries) {
      trace.putAttribute(key, String(value).slice(0, 100));
    }
  }

  try {
    const result = await operation(trace);
    trace.putAttribute('success', 'true');
    return result;
  } catch (error) {
    trace.putAttribute('success', 'false');
    throw error;
  } finally {
    await trace.stop();
  }
}
