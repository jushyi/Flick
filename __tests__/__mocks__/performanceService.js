/**
 * Mock for performanceService (legacy Firebase performance)
 * Used by old .js tests that import from src/services/firebase/performanceService
 */
const mockWithTrace = jest.fn((name, operation) =>
  operation({ putAttribute: jest.fn(), putMetric: jest.fn() })
);

module.exports = {
  withTrace: mockWithTrace,
};

module.exports.mockWithTrace = mockWithTrace;
