/**
 * Mock for @react-native-firebase/perf
 */
const mockPerfTrace = {
  start: jest.fn(() => Promise.resolve()),
  stop: jest.fn(() => Promise.resolve()),
  putAttribute: jest.fn(),
  putMetric: jest.fn(),
};

const mockStartTrace = jest.fn(() => Promise.resolve(mockPerfTrace));
const mockSetPerformanceCollectionEnabled = jest.fn();
const mockGetPerformance = jest.fn(() => ({}));

module.exports = {
  getPerformance: mockGetPerformance,
  setPerformanceCollectionEnabled: mockSetPerformanceCollectionEnabled,
  startTrace: mockStartTrace,
};

module.exports.mockPerfTrace = mockPerfTrace;
module.exports.mockStartTrace = mockStartTrace;
module.exports.mockSetPerformanceCollectionEnabled = mockSetPerformanceCollectionEnabled;
module.exports.mockGetPerformance = mockGetPerformance;
