/**
 * Shared PowerSync Mock
 *
 * Provides a mock factory for getPowerSyncDb() that returns a mock db with
 * execute, getAll, get, and writeTransaction methods.
 *
 * Usage in test files:
 *   import { mockDb, resetPowerSyncMocks } from '../setup/powersync.mock';
 *
 * The jest.mock for PowerSyncProvider is NOT done here -- each test file
 * must set up its own jest.mock since jest.mock is hoisted per-file.
 */

export const mockExecute = jest.fn().mockResolvedValue(undefined);
export const mockGetAll = jest.fn().mockResolvedValue([]);
export const mockGet = jest.fn().mockResolvedValue(null);

export const mockTx = {
  execute: jest.fn().mockResolvedValue(undefined),
  getAll: jest.fn().mockResolvedValue([]),
  get: jest.fn().mockResolvedValue(null),
};

export const mockWriteTransaction = jest.fn(async (callback: (tx: typeof mockTx) => Promise<void>) => {
  await callback(mockTx);
});

export const mockDb = {
  execute: mockExecute,
  getAll: mockGetAll,
  get: mockGet,
  writeTransaction: mockWriteTransaction,
};

/**
 * Create a fresh mock PowerSync db instance
 */
export const createMockPowerSyncDb = () => ({
  execute: jest.fn().mockResolvedValue(undefined),
  getAll: jest.fn().mockResolvedValue([]),
  get: jest.fn().mockResolvedValue(null),
  writeTransaction: jest.fn(async (callback: (tx: any) => Promise<void>) => {
    const tx = {
      execute: jest.fn().mockResolvedValue(undefined),
      getAll: jest.fn().mockResolvedValue([]),
      get: jest.fn().mockResolvedValue(null),
    };
    await callback(tx);
    return tx;
  }),
});

/**
 * Pre-configured jest.fn that returns mockDb
 */
export const mockGetPowerSyncDb = jest.fn(() => mockDb);

/**
 * Reset all mock state between tests
 */
export const resetPowerSyncMocks = (): void => {
  mockExecute.mockClear().mockResolvedValue(undefined);
  mockGetAll.mockClear().mockResolvedValue([]);
  mockGet.mockClear().mockResolvedValue(null);
  mockTx.execute.mockClear().mockResolvedValue(undefined);
  mockTx.getAll.mockClear().mockResolvedValue([]);
  mockTx.get.mockClear().mockResolvedValue(null);
  mockWriteTransaction.mockClear();
  mockGetPowerSyncDb.mockClear().mockReturnValue(mockDb);
};
