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
const mockAddDoc = jest.fn(() => Promise.resolve({ id: 'new-msg-id' }));
const mockServerTimestamp = jest.fn(() => ({ _serverTimestamp: true }));
const mockArrayUnion = jest.fn((...items) => ({ _arrayUnion: items }));

// Mock document reference
const mockDocRef = { id: 'mock-doc-ref' };

// Mock collection reference
const mockCollectionRef = { id: 'mock-collection-ref' };

// Mock @react-native-firebase/firestore
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: jest.fn(() => mockCollectionRef),
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
  addDoc: (...args) => mockAddDoc(...args),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  orderBy: jest.fn(() => ({})),
  limit: jest.fn(() => ({})),
  startAfter: jest.fn(() => ({})),
  onSnapshot: jest.fn(() => jest.fn()),
  serverTimestamp: () => mockServerTimestamp(),
  arrayUnion: (...args) => mockArrayUnion(...args),
}));

// Import service AFTER mocks are set up
const {
  markConversationRead,
  sendReaction,
  removeReaction,
  sendReply,
  deleteMessageForMe,
} = require('../../src/services/firebase/messageService');

describe('messageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
    mockAddDoc.mockResolvedValue({ id: 'new-msg-id' });
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

  // ===========================================================================
  // sendReaction
  // ===========================================================================
  describe('sendReaction', () => {
    it('should return success with messageId when called with valid params', async () => {
      const result = await sendReaction('conv1', 'user1', 'msg1', 'heart');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('new-msg-id');
    });

    it('should return error when conversationId is missing', async () => {
      const result = await sendReaction(null, 'user1', 'msg1', 'heart');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required fields');
      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('should create doc with correct shape (type: reaction, emoji, targetMessageId, null text/gifUrl/imageUrl)', async () => {
      await sendReaction('conv1', 'user1', 'msg1', 'laugh');

      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      const docData = mockAddDoc.mock.calls[0][1];
      expect(docData).toEqual({
        senderId: 'user1',
        type: 'reaction',
        emoji: 'laugh',
        targetMessageId: 'msg1',
        text: null,
        gifUrl: null,
        imageUrl: null,
        createdAt: { _serverTimestamp: true },
      });
    });

    it('should use serverTimestamp() for createdAt', async () => {
      await sendReaction('conv1', 'user1', 'msg1', 'heart');

      const docData = mockAddDoc.mock.calls[0][1];
      expect(docData.createdAt).toEqual({ _serverTimestamp: true });
      expect(mockServerTimestamp).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // removeReaction
  // ===========================================================================
  describe('removeReaction', () => {
    it('should return success when called with valid params', async () => {
      const result = await removeReaction('conv1', 'user1', 'msg1');

      expect(result.success).toBe(true);
    });

    it('should create doc with emoji: null (removal sentinel)', async () => {
      await removeReaction('conv1', 'user1', 'msg1');

      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      const docData = mockAddDoc.mock.calls[0][1];
      expect(docData).toEqual({
        senderId: 'user1',
        type: 'reaction',
        emoji: null,
        targetMessageId: 'msg1',
        text: null,
        gifUrl: null,
        imageUrl: null,
        createdAt: { _serverTimestamp: true },
      });
    });
  });

  // ===========================================================================
  // sendReply
  // ===========================================================================
  describe('sendReply', () => {
    const mockReplyToMessage = {
      id: 'original-msg-1',
      senderId: 'user2',
      type: 'text',
      text: 'Hello, how are you?',
    };

    it('should return success with messageId for text reply', async () => {
      const result = await sendReply(
        'conv1',
        'user1',
        'I am good!',
        null,
        null,
        mockReplyToMessage
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('new-msg-id');
    });

    it('should create doc with correct replyTo shape (messageId, senderId, type, text truncated to 100 chars, deleted: false)', async () => {
      const longTextMessage = {
        id: 'original-msg-2',
        senderId: 'user2',
        type: 'text',
        text: 'A'.repeat(200),
      };

      await sendReply('conv1', 'user1', 'Reply text', null, null, longTextMessage);

      const docData = mockAddDoc.mock.calls[0][1];
      expect(docData.replyTo).toEqual({
        messageId: 'original-msg-2',
        senderId: 'user2',
        type: 'text',
        text: 'A'.repeat(100),
        deleted: false,
      });
    });

    it('should set type to image and text to null for image reply', async () => {
      const imageMessage = {
        id: 'original-msg-3',
        senderId: 'user2',
        type: 'image',
        text: null,
      };

      await sendReply('conv1', 'user1', null, null, 'https://example.com/photo.jpg', imageMessage);

      const docData = mockAddDoc.mock.calls[0][1];
      expect(docData.type).toBe('image');
      expect(docData.text).toBeNull();
      expect(docData.imageUrl).toBe('https://example.com/photo.jpg');
      expect(docData.replyTo.type).toBe('image');
      expect(docData.replyTo.text).toBeNull();
    });

    it('should return error when replyToMessage is missing', async () => {
      const result = await sendReply('conv1', 'user1', 'Reply text', null, null, null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid replyToMessage: must have id, senderId, and type');
      expect(mockAddDoc).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // deleteMessageForMe
  // ===========================================================================
  describe('deleteMessageForMe', () => {
    it('should return success when called with valid params', async () => {
      const result = await deleteMessageForMe('conv1', 'user1', 'msg1');

      expect(result.success).toBe(true);
    });

    it('should call updateDoc with arrayUnion on deletedMessages.{userId}', async () => {
      await deleteMessageForMe('conv1', 'user1', 'msg1');

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      expect(mockUpdateDoc).toHaveBeenCalledWith(mockDocRef, {
        'deletedMessages.user1': { _arrayUnion: ['msg1'] },
      });
    });

    it('should return error when params are missing', async () => {
      const result1 = await deleteMessageForMe(null, 'user1', 'msg1');
      expect(result1.success).toBe(false);
      expect(result1.error).toBe('Missing required fields');

      const result2 = await deleteMessageForMe('conv1', null, 'msg1');
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Missing required fields');

      const result3 = await deleteMessageForMe('conv1', 'user1', null);
      expect(result3.success).toBe(false);
      expect(result3.error).toBe('Missing required fields');

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });
});
