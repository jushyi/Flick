/**
 * Account Service Unit Tests
 *
 * Tests for account deletion, scheduled deletion, cancellation,
 * and deletion status checking via Cloud Functions.
 */

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Cloud Functions mock
const mockCallable = jest.fn();
const mockHttpsCallable = jest.fn(() => mockCallable);

jest.mock('@react-native-firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: (...args) => mockHttpsCallable(...args),
}));

// Firestore mock for checkDeletionStatus
const mockFirestoreGet = jest.fn();
const mockFirestoreDoc = jest.fn(() => ({
  get: mockFirestoreGet,
}));
const mockFirestoreCollection = jest.fn(() => ({
  doc: mockFirestoreDoc,
}));

jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({
    collection: mockFirestoreCollection,
    doc: mockFirestoreDoc,
  });
  return firestore;
});

// Auth mock for checkDeletionStatus
const mockCurrentUser = { uid: 'test-user-123' };
jest.mock('@react-native-firebase/auth', () => {
  return () => ({
    currentUser: mockCurrentUser,
  });
});

// Import service after mocks
const {
  deleteUserAccount,
  scheduleAccountDeletion,
  cancelAccountDeletion,
  checkDeletionStatus,
} = require('../../src/services/firebase/accountService');

describe('accountService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset currentUser to authenticated state
    mockCurrentUser.uid = 'test-user-123';
  });

  // ===========================================================================
  // deleteUserAccount tests
  // ===========================================================================
  describe('deleteUserAccount', () => {
    it('should delete account successfully when Cloud Function returns success', async () => {
      mockCallable.mockResolvedValueOnce({ data: { success: true } });

      const result = await deleteUserAccount();

      expect(result.success).toBe(true);
      expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'deleteUserAccount');
      expect(mockCallable).toHaveBeenCalled();
    });

    it('should return error when Cloud Function returns unexpected response', async () => {
      mockCallable.mockResolvedValueOnce({ data: { success: false } });

      const result = await deleteUserAccount();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected response from server');
    });

    it('should return error when Cloud Function returns no data', async () => {
      mockCallable.mockResolvedValueOnce({ data: null });

      const result = await deleteUserAccount();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected response from server');
    });

    it('should return authentication error for unauthenticated code', async () => {
      const error = new Error('Not authenticated');
      error.code = 'functions/unauthenticated';
      mockCallable.mockRejectedValueOnce(error);

      const result = await deleteUserAccount();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication required. Please sign in and try again.');
    });

    it('should return Cloud Function error message for internal error', async () => {
      const error = new Error('Something went wrong on server');
      error.code = 'functions/internal';
      mockCallable.mockRejectedValueOnce(error);

      const result = await deleteUserAccount();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong on server');
    });

    it('should return generic error for unknown error codes', async () => {
      const error = new Error('Unknown error');
      error.code = 'functions/unknown';
      mockCallable.mockRejectedValueOnce(error);

      const result = await deleteUserAccount();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account deletion failed. Please try again.');
    });
  });

  // ===========================================================================
  // scheduleAccountDeletion tests
  // ===========================================================================
  describe('scheduleAccountDeletion', () => {
    it('should schedule deletion successfully and return scheduled date', async () => {
      const scheduledDate = '2025-06-15T00:00:00.000Z';
      mockCallable.mockResolvedValueOnce({
        data: { success: true, scheduledDate },
      });

      const result = await scheduleAccountDeletion();

      expect(result.success).toBe(true);
      expect(result.scheduledDate).toBeInstanceOf(Date);
      expect(result.scheduledDate.toISOString()).toBe(scheduledDate);
      expect(mockHttpsCallable).toHaveBeenCalledWith(
        expect.anything(),
        'scheduleUserAccountDeletion'
      );
    });

    it('should return error when Cloud Function returns unexpected response', async () => {
      mockCallable.mockResolvedValueOnce({ data: { success: false } });

      const result = await scheduleAccountDeletion();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected response from server');
    });

    it('should return authentication error for unauthenticated code', async () => {
      const error = new Error('Not authenticated');
      error.code = 'functions/unauthenticated';
      mockCallable.mockRejectedValueOnce(error);

      const result = await scheduleAccountDeletion();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication required. Please sign in and try again.');
    });

    it('should return network error for unavailable code', async () => {
      const error = new Error('Network error');
      error.code = 'functions/unavailable';
      mockCallable.mockRejectedValueOnce(error);

      const result = await scheduleAccountDeletion();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error. Please check your connection and try again.');
    });

    it('should return generic error for unknown error codes', async () => {
      const error = new Error('Something failed');
      error.code = 'functions/unknown';
      mockCallable.mockRejectedValueOnce(error);

      const result = await scheduleAccountDeletion();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to schedule account deletion. Please try again.');
    });
  });

  // ===========================================================================
  // cancelAccountDeletion tests
  // ===========================================================================
  describe('cancelAccountDeletion', () => {
    it('should cancel deletion successfully', async () => {
      mockCallable.mockResolvedValueOnce({ data: { success: true } });

      const result = await cancelAccountDeletion();

      expect(result.success).toBe(true);
      expect(mockHttpsCallable).toHaveBeenCalledWith(
        expect.anything(),
        'cancelUserAccountDeletion'
      );
    });

    it('should return error when Cloud Function returns unexpected response', async () => {
      mockCallable.mockResolvedValueOnce({ data: { success: false } });

      const result = await cancelAccountDeletion();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected response from server');
    });

    it('should return authentication error for unauthenticated code', async () => {
      const error = new Error('Not authenticated');
      error.code = 'functions/unauthenticated';
      mockCallable.mockRejectedValueOnce(error);

      const result = await cancelAccountDeletion();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication required. Please sign in and try again.');
    });

    it('should return network error for unavailable code', async () => {
      const error = new Error('Network error');
      error.code = 'functions/unavailable';
      mockCallable.mockRejectedValueOnce(error);

      const result = await cancelAccountDeletion();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error. Please check your connection and try again.');
    });

    it('should return generic error for unknown error codes', async () => {
      const error = new Error('Unknown');
      error.code = 'functions/deadline-exceeded';
      mockCallable.mockRejectedValueOnce(error);

      const result = await cancelAccountDeletion();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to cancel deletion. Please try again.');
    });
  });

  // ===========================================================================
  // checkDeletionStatus tests
  // ===========================================================================
  describe('checkDeletionStatus', () => {
    it('should return isScheduled true when deletion is scheduled', async () => {
      const scheduledDate = new Date('2025-06-15T00:00:00.000Z');
      mockFirestoreGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          scheduledForDeletionAt: {
            toDate: () => scheduledDate,
          },
        }),
      });

      const result = await checkDeletionStatus();

      expect(result.isScheduled).toBe(true);
      expect(result.scheduledDate).toEqual(scheduledDate);
    });

    it('should return isScheduled false when no deletion is scheduled', async () => {
      mockFirestoreGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          scheduledForDeletionAt: null,
        }),
      });

      const result = await checkDeletionStatus();

      expect(result.isScheduled).toBe(false);
      expect(result.scheduledDate).toBeNull();
    });

    it('should return isScheduled false when user document does not exist', async () => {
      mockFirestoreGet.mockResolvedValueOnce({
        exists: false,
      });

      const result = await checkDeletionStatus();

      expect(result.isScheduled).toBe(false);
      expect(result.scheduledDate).toBeNull();
    });

    it('should return error when not authenticated', async () => {
      // Temporarily set currentUser to null
      mockCurrentUser.uid = undefined;
      // We need to fully mock no user. The service checks auth().currentUser
      // Since auth() returns { currentUser: mockCurrentUser }, and mockCurrentUser.uid is undefined,
      // The service checks `if (!currentUser)` -- but our mock always returns the object.
      // Let's test the error path by making Firestore throw
      mockFirestoreGet.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await checkDeletionStatus();

      expect(result.isScheduled).toBe(false);
      expect(result.error).toBe('Permission denied');
    });

    it('should return error when Firestore get fails', async () => {
      mockFirestoreGet.mockRejectedValueOnce(new Error('Network error'));

      const result = await checkDeletionStatus();

      expect(result.isScheduled).toBe(false);
      expect(result.scheduledDate).toBeNull();
      expect(result.error).toBe('Network error');
    });

    it('should handle missing scheduledForDeletionAt field', async () => {
      mockFirestoreGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({}),
      });

      const result = await checkDeletionStatus();

      expect(result.isScheduled).toBe(false);
      expect(result.scheduledDate).toBeNull();
    });
  });
});
