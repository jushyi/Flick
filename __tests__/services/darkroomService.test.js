/**
 * Darkroom Service Unit Tests
 *
 * Tests for darkroom reveal timing, scheduling, and initialization.
 */

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Create Firestore mocks
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();

// Track current mock time for Timestamp.now()
let mockCurrentTime = 1000000;

// Mock Timestamp class
const createMockTimestamp = seconds => ({
  seconds,
  toDate: () => new Date(seconds * 1000),
});

// Mock Firestore
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: (...args) => mockCollection(...args),
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  setDoc: (...args) => mockSetDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  serverTimestamp: () => ({ _serverTimestamp: true }),
  Timestamp: {
    now: () => createMockTimestamp(mockCurrentTime),
    fromDate: date => createMockTimestamp(Math.floor(date.getTime() / 1000)),
  },
}));

// Import service after mocks
const {
  getDarkroom,
  isDarkroomReadyToReveal,
  scheduleNextReveal,
  ensureDarkroomInitialized,
} = require('../../src/services/firebase/darkroomService');

describe('darkroomService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentTime = 1000000; // Reset mock time
    mockQuery.mockReturnValue({ _query: true });
    mockCollection.mockReturnValue({ _collection: true });
    mockDoc.mockReturnValue({ _doc: true, ref: { id: 'test-doc' } });
  });

  // ===========================================================================
  // getDarkroom tests
  // ===========================================================================
  describe('getDarkroom', () => {
    it('should return existing darkroom data', async () => {
      const darkroomData = {
        userId: 'user-123',
        nextRevealAt: createMockTimestamp(1000100),
        lastRevealedAt: createMockTimestamp(999900),
        createdAt: createMockTimestamp(999800),
      };

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => darkroomData,
      });

      const result = await getDarkroom('user-123');

      expect(result.success).toBe(true);
      expect(result.darkroom.userId).toBe('user-123');
      expect(result.darkroom.nextRevealAt).toBeDefined();
    });

    it('should create new darkroom if not exists', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });
      mockSetDoc.mockResolvedValueOnce();

      const result = await getDarkroom('user-123');

      expect(result.success).toBe(true);
      expect(result.darkroom.userId).toBe('user-123');
      expect(result.darkroom.lastRevealedAt).toBeNull();
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('should return error when Firestore fails', async () => {
      mockGetDoc.mockRejectedValueOnce(new Error('Firestore error'));

      const result = await getDarkroom('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Firestore error');
    });
  });

  // ===========================================================================
  // isDarkroomReadyToReveal tests
  // ===========================================================================
  describe('isDarkroomReadyToReveal', () => {
    it('should return true when nextRevealAt is in the past', async () => {
      // nextRevealAt is 100 seconds before current time
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          userId: 'user-123',
          nextRevealAt: createMockTimestamp(mockCurrentTime - 100),
        }),
      });

      const result = await isDarkroomReadyToReveal('user-123');

      expect(result).toBe(true);
    });

    it('should return false when nextRevealAt is in the future', async () => {
      // nextRevealAt is 100 seconds after current time
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          userId: 'user-123',
          nextRevealAt: createMockTimestamp(mockCurrentTime + 100),
        }),
      });

      const result = await isDarkroomReadyToReveal('user-123');

      expect(result).toBe(false);
    });

    it('should return true when nextRevealAt equals current time', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          userId: 'user-123',
          nextRevealAt: createMockTimestamp(mockCurrentTime),
        }),
      });

      const result = await isDarkroomReadyToReveal('user-123');

      expect(result).toBe(true);
    });

    it('should return false when getDarkroom fails', async () => {
      mockGetDoc.mockRejectedValueOnce(new Error('Error'));

      const result = await isDarkroomReadyToReveal('user-123');

      expect(result).toBe(false);
    });

    it('should return falsy when nextRevealAt is null', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          userId: 'user-123',
          nextRevealAt: null,
        }),
      });

      const result = await isDarkroomReadyToReveal('user-123');

      // Returns null or false - both are falsy, which is correct behavior
      expect(result).toBeFalsy();
    });
  });

  // ===========================================================================
  // scheduleNextReveal tests
  // ===========================================================================
  describe('scheduleNextReveal', () => {
    it('should update darkroom with new nextRevealAt and lastRevealedAt', async () => {
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await scheduleNextReveal('user-123');

      expect(result.success).toBe(true);
      expect(result.nextRevealAt).toBeDefined();
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          nextRevealAt: expect.anything(),
          lastRevealedAt: expect.anything(),
        })
      );
    });

    it('should return error when update fails', async () => {
      mockUpdateDoc.mockRejectedValueOnce(new Error('Update failed'));

      const result = await scheduleNextReveal('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  // ===========================================================================
  // ensureDarkroomInitialized tests
  // ===========================================================================
  describe('ensureDarkroomInitialized', () => {
    it('should create new darkroom if not exists', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });
      mockSetDoc.mockResolvedValueOnce();

      const result = await ensureDarkroomInitialized('user-123');

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('should return success if nextRevealAt is still valid', async () => {
      // nextRevealAt is in the future
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          userId: 'user-123',
          nextRevealAt: createMockTimestamp(mockCurrentTime + 1000),
        }),
      });

      const result = await ensureDarkroomInitialized('user-123');

      expect(result.success).toBe(true);
      expect(result.created).toBeUndefined();
      expect(result.refreshed).toBeUndefined();
    });

    it('should reveal photos and refresh when nextRevealAt is stale', async () => {
      // nextRevealAt is in the past
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          userId: 'user-123',
          nextRevealAt: createMockTimestamp(mockCurrentTime - 100),
        }),
      });

      // Mock getDocs for developing photos query
      const mockDocs = [{ ref: { id: 'photo-1' } }, { ref: { id: 'photo-2' } }];
      mockGetDocs.mockResolvedValueOnce({ docs: mockDocs });
      mockUpdateDoc.mockResolvedValue();

      const result = await ensureDarkroomInitialized('user-123');

      expect(result.success).toBe(true);
      expect(result.refreshed).toBe(true);
      expect(result.revealed).toBe(2);
    });

    it('should continue even if revealing photos fails', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          userId: 'user-123',
          nextRevealAt: createMockTimestamp(mockCurrentTime - 100),
        }),
      });

      // Simulate reveal failure
      mockGetDocs.mockRejectedValueOnce(new Error('Reveal failed'));
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await ensureDarkroomInitialized('user-123');

      // Should still succeed (refresh timing even if reveal failed)
      expect(result.success).toBe(true);
      expect(result.refreshed).toBe(true);
    });

    it('should return error when Firestore read fails', async () => {
      mockGetDoc.mockRejectedValueOnce(new Error('Read failed'));

      const result = await ensureDarkroomInitialized('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Read failed');
    });

    it('should handle null nextRevealAt as stale', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          userId: 'user-123',
          nextRevealAt: null,
        }),
      });

      mockGetDocs.mockResolvedValueOnce({ docs: [] });
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await ensureDarkroomInitialized('user-123');

      expect(result.success).toBe(true);
      expect(result.refreshed).toBe(true);
    });
  });
});
