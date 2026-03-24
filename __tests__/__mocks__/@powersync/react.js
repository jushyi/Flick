/**
 * Mock for @powersync/react
 * Provides mocked React hooks and context for PowerSync.
 */

const React = require('react');

const mockDb = {
  init: jest.fn().mockResolvedValue(undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnectAndClear: jest.fn().mockResolvedValue(undefined),
  getNextCrudTransaction: jest.fn().mockResolvedValue(null),
  execute: jest.fn().mockResolvedValue({ rows: { _array: [] } }),
  getAll: jest.fn().mockResolvedValue([]),
};

const useQuery = jest.fn().mockReturnValue({
  data: [],
  isLoading: false,
  error: null,
});

const useStatus = jest.fn().mockReturnValue({
  connected: true,
});

const usePowerSync = jest.fn().mockReturnValue(mockDb);

const PowerSyncContext = {
  Provider: ({ children }) => children,
};

module.exports = {
  useQuery,
  useStatus,
  usePowerSync,
  PowerSyncContext,
};
