/**
 * useConversation Hook Unit Tests
 *
 * Tests for the conversation hook including:
 * - Conversation document subscription via onSnapshot
 * - readReceipts data exposure via conversationDoc
 * - First-read-only guard (markConversationRead only when unreadCount > 0)
 * - Foreground-only guard (AppState === 'active')
 * - AppState change listener triggers markConversationRead on foreground return
 * - Cleanup of both onSnapshot subscription and AppState listener on unmount
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

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

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  getPresentedNotificationsAsync: jest.fn(() => Promise.resolve([])),
  dismissNotificationAsync: jest.fn(() => Promise.resolve()),
}));

// Mock messageService
const mockSubscribeToMessages = jest.fn();
const mockLoadMoreMessages = jest.fn();
const mockSendMessage = jest.fn();
const mockMarkConversationRead = jest.fn();
const mockSendReaction = jest.fn();
const mockRemoveReaction = jest.fn();
const mockSendReply = jest.fn();
const mockDeleteMessageForMe = jest.fn();

jest.mock('../../src/services/firebase/messageService', () => ({
  subscribeToMessages: (...args) => mockSubscribeToMessages(...args),
  loadMoreMessages: (...args) => mockLoadMoreMessages(...args),
  sendMessage: (...args) => mockSendMessage(...args),
  markConversationRead: (...args) => mockMarkConversationRead(...args),
  sendReaction: (...args) => mockSendReaction(...args),
  removeReaction: (...args) => mockRemoveReaction(...args),
  sendReply: (...args) => mockSendReply(...args),
  deleteMessageForMe: (...args) => mockDeleteMessageForMe(...args),
}));

// Track onSnapshot callbacks for testing
let convDocSnapshotCallback = null;
const mockConvDocUnsubscribe = jest.fn();
const mockOnSnapshot = jest.fn((ref, successCb) => {
  convDocSnapshotCallback = successCb;
  return mockConvDocUnsubscribe;
});

const mockDoc = jest.fn(() => ({ _mockDocRef: true }));
const mockGetFirestore = jest.fn(() => ({}));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: (...args) => mockGetFirestore(...args),
  doc: (...args) => mockDoc(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
}));

// Mock AppState
let appStateChangeCallback = null;
const mockAppStateRemove = jest.fn();
AppState.addEventListener = jest.fn((event, callback) => {
  if (event === 'change') {
    appStateChangeCallback = callback;
  }
  return { remove: mockAppStateRemove };
});
// Default: app is in foreground
Object.defineProperty(AppState, 'currentState', {
  get: jest.fn(() => 'active'),
  configurable: true,
});

// Import hook AFTER mocks
const useConversation = require('../../src/hooks/useConversation').default;

describe('useConversation', () => {
  const mockConversationId = 'user1_user2';
  const mockCurrentUserId = 'user1';

  beforeEach(() => {
    jest.clearAllMocks();
    convDocSnapshotCallback = null;
    appStateChangeCallback = null;

    // Default: subscribeToMessages returns an unsubscribe function
    const mockMsgUnsubscribe = jest.fn();
    mockSubscribeToMessages.mockReturnValue(mockMsgUnsubscribe);
    mockMarkConversationRead.mockResolvedValue({ success: true });

    // Reset AppState to active
    Object.defineProperty(AppState, 'currentState', {
      get: jest.fn(() => 'active'),
      configurable: true,
    });
  });

  // ===========================================================================
  // Conversation document subscription
  // ===========================================================================
  describe('conversation document subscription', () => {
    it('should subscribe to conversation document on mount', () => {
      renderHook(() => useConversation(mockConversationId, mockCurrentUserId));

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'conversations', mockConversationId);
    });

    it('should expose conversationDoc with readReceipts data', async () => {
      const { result } = renderHook(() => useConversation(mockConversationId, mockCurrentUserId));

      // Initially null
      expect(result.current.conversationDoc).toBeNull();

      // Simulate conversation document snapshot
      act(() => {
        convDocSnapshotCallback({
          exists: true,
          id: mockConversationId,
          data: () => ({
            participants: ['user1', 'user2'],
            readReceipts: {
              user1: { toMillis: () => 1000 },
              user2: { toMillis: () => 2000 },
            },
            unreadCount: { user1: 0, user2: 0 },
          }),
        });
      });

      await waitFor(() => {
        expect(result.current.conversationDoc).not.toBeNull();
        expect(result.current.conversationDoc.readReceipts).toBeDefined();
        expect(result.current.conversationDoc.readReceipts.user1.toMillis()).toBe(1000);
        expect(result.current.conversationDoc.readReceipts.user2.toMillis()).toBe(2000);
      });
    });

    it('should unsubscribe from conversation document on unmount', () => {
      const { unmount } = renderHook(() => useConversation(mockConversationId, mockCurrentUserId));

      unmount();

      expect(mockConvDocUnsubscribe).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // First-read-only guard
  // ===========================================================================
  describe('first-read-only guard', () => {
    it('should call markConversationRead when unreadCount > 0', async () => {
      renderHook(() => useConversation(mockConversationId, mockCurrentUserId));

      // Simulate conversation doc with unread messages
      act(() => {
        convDocSnapshotCallback({
          exists: true,
          id: mockConversationId,
          data: () => ({
            participants: ['user1', 'user2'],
            unreadCount: { user1: 3, user2: 0 },
            readReceipts: {},
          }),
        });
      });

      await waitFor(() => {
        expect(mockMarkConversationRead).toHaveBeenCalledWith(
          mockConversationId,
          mockCurrentUserId
        );
      });
    });

    it('should NOT call markConversationRead when unreadCount is 0', async () => {
      renderHook(() => useConversation(mockConversationId, mockCurrentUserId));

      // Simulate conversation doc with no unread messages
      act(() => {
        convDocSnapshotCallback({
          exists: true,
          id: mockConversationId,
          data: () => ({
            participants: ['user1', 'user2'],
            unreadCount: { user1: 0, user2: 0 },
            readReceipts: { user1: { toMillis: () => 1000 } },
          }),
        });
      });

      // Wait for effects to settle, then verify
      await waitFor(() => {
        expect(result => result.current.conversationDoc).toBeTruthy();
      }).catch(() => {});

      // markConversationRead should not have been called
      expect(mockMarkConversationRead).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Foreground-only guard
  // ===========================================================================
  describe('foreground-only guard', () => {
    it('should NOT call markConversationRead when app is backgrounded', async () => {
      // Set app state to background
      Object.defineProperty(AppState, 'currentState', {
        get: jest.fn(() => 'background'),
        configurable: true,
      });

      renderHook(() => useConversation(mockConversationId, mockCurrentUserId));

      // Simulate conversation doc with unread messages
      act(() => {
        convDocSnapshotCallback({
          exists: true,
          id: mockConversationId,
          data: () => ({
            participants: ['user1', 'user2'],
            unreadCount: { user1: 5, user2: 0 },
            readReceipts: {},
          }),
        });
      });

      // Wait for effects to settle
      await waitFor(() => {
        expect(result => result.current.conversationDoc).toBeTruthy();
      }).catch(() => {});

      // markConversationRead should not have been called because app is backgrounded
      expect(mockMarkConversationRead).not.toHaveBeenCalled();
    });

    it('should call markConversationRead when app returns to foreground with unread messages', async () => {
      // Start with app in background
      Object.defineProperty(AppState, 'currentState', {
        get: jest.fn(() => 'background'),
        configurable: true,
      });

      renderHook(() => useConversation(mockConversationId, mockCurrentUserId));

      // Simulate conversation doc with unread messages
      act(() => {
        convDocSnapshotCallback({
          exists: true,
          id: mockConversationId,
          data: () => ({
            participants: ['user1', 'user2'],
            unreadCount: { user1: 2, user2: 0 },
            readReceipts: {},
          }),
        });
      });

      // Verify markConversationRead was NOT called while backgrounded
      expect(mockMarkConversationRead).not.toHaveBeenCalled();

      // Simulate app returning to foreground
      act(() => {
        if (appStateChangeCallback) {
          appStateChangeCallback('active');
        }
      });

      await waitFor(() => {
        expect(mockMarkConversationRead).toHaveBeenCalledWith(
          mockConversationId,
          mockCurrentUserId
        );
      });
    });
  });

  // ===========================================================================
  // AppState listener cleanup
  // ===========================================================================
  describe('AppState listener cleanup', () => {
    it('should clean up AppState listener on unmount', async () => {
      const { unmount } = renderHook(() => useConversation(mockConversationId, mockCurrentUserId));

      // Simulate conversation doc to trigger the mark-as-read effect
      act(() => {
        convDocSnapshotCallback({
          exists: true,
          id: mockConversationId,
          data: () => ({
            participants: ['user1', 'user2'],
            unreadCount: { user1: 0, user2: 0 },
            readReceipts: {},
          }),
        });
      });

      unmount();

      expect(mockAppStateRemove).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Phase 2: reactions
  // ===========================================================================
  describe('Phase 2: reactions', () => {
    it('should call sendReaction with conversationId, currentUserId, targetMessageId, emoji', async () => {
      mockSendReaction.mockResolvedValue({ success: true, messageId: 'rxn-1' });

      const { result } = renderHook(() => useConversation(mockConversationId, mockCurrentUserId));

      await act(async () => {
        await result.current.handleSendReaction('msg-1', 'heart');
      });

      expect(mockSendReaction).toHaveBeenCalledWith(
        mockConversationId,
        mockCurrentUserId,
        'msg-1',
        'heart'
      );
    });

    it('should call removeReaction with conversationId, currentUserId, targetMessageId', async () => {
      mockRemoveReaction.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useConversation(mockConversationId, mockCurrentUserId));

      await act(async () => {
        await result.current.handleRemoveReaction('msg-1');
      });

      expect(mockRemoveReaction).toHaveBeenCalledWith(
        mockConversationId,
        mockCurrentUserId,
        'msg-1'
      );
    });
  });

  // ===========================================================================
  // Phase 2: replies
  // ===========================================================================
  describe('Phase 2: replies', () => {
    it('should call sendReply with correct arguments including replyToMessage', async () => {
      mockSendReply.mockResolvedValue({ success: true, messageId: 'reply-1' });
      const replyToMessage = { id: 'orig-1', senderId: 'user2', type: 'text' };

      const { result } = renderHook(() => useConversation(mockConversationId, mockCurrentUserId));

      await act(async () => {
        await result.current.handleSendReply('reply text', null, null, replyToMessage);
      });

      expect(mockSendReply).toHaveBeenCalledWith(
        mockConversationId,
        mockCurrentUserId,
        'reply text',
        null,
        null,
        replyToMessage
      );
    });
  });

  // ===========================================================================
  // Phase 2: soft deletion
  // ===========================================================================
  describe('Phase 2: soft deletion', () => {
    it('should call deleteMessageForMe with conversationId, currentUserId, messageId', async () => {
      mockDeleteMessageForMe.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useConversation(mockConversationId, mockCurrentUserId));

      await act(async () => {
        await result.current.handleDeleteForMe('msg-to-delete');
      });

      expect(mockDeleteMessageForMe).toHaveBeenCalledWith(
        mockConversationId,
        mockCurrentUserId,
        'msg-to-delete'
      );
    });
  });
});
