/**
 * Message Service Unit Tests
 *
 * Tests for messageService including:
 * - markConversationRead with readReceipts
 * - Validation of required parameters
 * - Error handling
 */

// Mock logger to prevent console output
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Create mock functions for Firestore at module level
const mockUpdateDoc = jest.fn();
const mockServerTimestamp = jest.fn(() => ({ _serverTimestamp: true }));

// Mock document reference
const mockDocRef = { id: 'mock-doc-ref' };

// Mock @react-native-firebase/firestore
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: jest.fn(() => ({})),
  doc: jest.fn(() => mockDocRef),
  getDoc: jest.fn(() =>
    Promise.resolve({
      exists: () => true,
      data: () => ({}),
      id: 'test-doc',
    })
  ),
  getDocs: jest.fn(() =>
    Promise.resolve({
      docs: [],
      empty: true,
      forEach: jest.fn(),
      size: 0,
    })
  ),
  setDoc: jest.fn(() => Promise.resolve()),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: jest.fn(() => Promise.resolve()),
  addDoc: jest.fn(() => Promise.resolve({ id: 'new-msg-id' })),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  orderBy: jest.fn(() => ({})),
  limit: jest.fn(() => ({})),
  startAfter: jest.fn(() => ({})),
  onSnapshot: jest.fn(() => jest.fn()),
  serverTimestamp: () => mockServerTimestamp(),
}));

// Import service AFTER mocks are set up
const { markConversationRead } = require('../../src/services/firebase/messageService');

describe('messageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  // ===========================================================================
  // markConversationRead - readReceipts
  // ===========================================================================
  describe('markConversationRead - readReceipts', () => {
    it('should write both unreadCount and readReceipts in a single updateDoc call', async () => {
      const result = await markConversationRead('conv1', 'user1');

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);

      const updateData = mockUpdateDoc.mock.calls[0][1];
      expect(updateData['unreadCount.user1']).toBe(0);
      expect(updateData['readReceipts.user1']).toBeDefined();
      expect(updateData['readReceipts.user1']).toEqual({ _serverTimestamp: true });
    });

    it('should return success true on successful write', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      const result = await markConversationRead('conv1', 'user1');

      expect(result.success).toBe(true);
    });

    it('should return success false with error message on failure', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('Permission denied'));

      const result = await markConversationRead('conv1', 'user1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });

    it('should return error when conversationId is missing', async () => {
      const result = await markConversationRead(null, 'user1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required fields');
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should return error when userId is missing', async () => {
      const result = await markConversationRead('conv1', null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required fields');
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should call updateDoc with the correct document reference', async () => {
      await markConversationRead('conv1', 'user1');

      expect(mockUpdateDoc).toHaveBeenCalledWith(mockDocRef, expect.any(Object));
    });

    it('should use serverTimestamp for readReceipts value', async () => {
      await markConversationRead('conv1', 'user1');

      const updateData = mockUpdateDoc.mock.calls[0][1];
      // serverTimestamp() should have been called to produce the value
      expect(mockServerTimestamp).toHaveBeenCalled();
      expect(updateData['readReceipts.user1']).toEqual(mockServerTimestamp());
    });
  });
});
