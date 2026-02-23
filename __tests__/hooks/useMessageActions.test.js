/**
 * useMessageActions Hook Unit Tests
 *
 * Tests for the message actions hook including:
 * - Action menu open/close with haptic feedback
 * - Reaction handling (send/toggle/remove)
 * - Double-tap heart shortcut
 * - Reply mode management
 * - Unsend via Cloud Function
 * - Delete for me
 */

import { renderHook, act } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';

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

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'Light',
    Medium: 'Medium',
    Heavy: 'Heavy',
  },
}));

// Mock Keyboard
Keyboard.dismiss = jest.fn();

// Mock Cloud Function callable
const mockCallable = jest.fn(() => Promise.resolve({ data: { success: true } }));
const mockHttpsCallable = jest.fn(() => mockCallable);
const mockGetFunctions = jest.fn(() => ({}));

jest.mock('@react-native-firebase/functions', () => ({
  getFunctions: (...args) => mockGetFunctions(...args),
  httpsCallable: (...args) => mockHttpsCallable(...args),
}));

// Import hook AFTER mocks
const useMessageActions = require('../../src/hooks/useMessageActions').default;

describe('useMessageActions', () => {
  const defaultProps = {
    conversationId: 'user1_user2',
    currentUserId: 'user1',
    onSendReaction: jest.fn(),
    onRemoveReaction: jest.fn(),
    onSendReply: jest.fn(),
    onDeleteForMe: jest.fn(),
  };

  const mockMessage = {
    id: 'msg1',
    senderId: 'user2',
    text: 'Hello!',
    type: 'text',
    createdAt: { toMillis: () => 1000 },
  };

  const mockLayout = { x: 10, y: 100, width: 200, height: 40 };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCallable.mockResolvedValue({ data: { success: true } });
  });

  // ===========================================================================
  // openActionMenu
  // ===========================================================================
  describe('openActionMenu', () => {
    it('should set visible=true, message, and position, and trigger medium haptic', () => {
      const { result } = renderHook(() => useMessageActions(defaultProps));

      // Initially closed
      expect(result.current.actionMenuVisible).toBe(false);
      expect(result.current.actionMenuMessage).toBeNull();
      expect(result.current.actionMenuPosition).toBeNull();

      act(() => {
        result.current.openActionMenu(mockMessage, mockLayout);
      });

      expect(result.current.actionMenuVisible).toBe(true);
      expect(result.current.actionMenuMessage).toEqual(mockMessage);
      expect(result.current.actionMenuPosition).toEqual(mockLayout);
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
      expect(Keyboard.dismiss).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // closeActionMenu
  // ===========================================================================
  describe('closeActionMenu', () => {
    it('should reset all action menu state', () => {
      const { result } = renderHook(() => useMessageActions(defaultProps));

      // Open the menu first
      act(() => {
        result.current.openActionMenu(mockMessage, mockLayout);
      });

      expect(result.current.actionMenuVisible).toBe(true);

      // Close it
      act(() => {
        result.current.closeActionMenu();
      });

      expect(result.current.actionMenuVisible).toBe(false);
      expect(result.current.actionMenuMessage).toBeNull();
      expect(result.current.actionMenuPosition).toBeNull();
    });
  });

  // ===========================================================================
  // handleReaction
  // ===========================================================================
  describe('handleReaction', () => {
    it('should call onSendReaction with correct params and close menu', () => {
      const { result } = renderHook(() => useMessageActions(defaultProps));

      // Open action menu for a message
      act(() => {
        result.current.openActionMenu(mockMessage, mockLayout);
      });

      // React with an emoji (empty reactionMap = no existing reactions)
      const emptyReactionMap = new Map();

      act(() => {
        result.current.handleReaction('heart', emptyReactionMap);
      });

      expect(defaultProps.onSendReaction).toHaveBeenCalledWith('msg1', 'heart');
      expect(result.current.actionMenuVisible).toBe(false);
    });

    it('should toggle to removeReaction when user already reacted with same emoji', () => {
      const { result } = renderHook(() => useMessageActions(defaultProps));

      // Open action menu
      act(() => {
        result.current.openActionMenu(mockMessage, mockLayout);
      });

      // Create a reactionMap where user1 already reacted with 'heart' on msg1
      const reactionMap = new Map();
      reactionMap.set('msg1', {
        heart: [{ senderId: 'user1', messageId: 'reaction1' }],
      });

      act(() => {
        result.current.handleReaction('heart', reactionMap);
      });

      expect(defaultProps.onRemoveReaction).toHaveBeenCalledWith('msg1');
      expect(defaultProps.onSendReaction).not.toHaveBeenCalled();
      expect(result.current.actionMenuVisible).toBe(false);
    });
  });

  // ===========================================================================
  // handleDoubleTapHeart
  // ===========================================================================
  describe('handleDoubleTapHeart', () => {
    it('should call onSendReaction with heart emoji and trigger light haptic', () => {
      const { result } = renderHook(() => useMessageActions(defaultProps));

      const emptyReactionMap = new Map();

      act(() => {
        result.current.handleDoubleTapHeart('msg1', emptyReactionMap);
      });

      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
      expect(defaultProps.onSendReaction).toHaveBeenCalledWith('msg1', 'heart');
    });

    it('should toggle to removeReaction when user already hearted', () => {
      const { result } = renderHook(() => useMessageActions(defaultProps));

      const reactionMap = new Map();
      reactionMap.set('msg1', {
        heart: [{ senderId: 'user1', messageId: 'reaction1' }],
      });

      act(() => {
        result.current.handleDoubleTapHeart('msg1', reactionMap);
      });

      expect(defaultProps.onRemoveReaction).toHaveBeenCalledWith('msg1');
      expect(defaultProps.onSendReaction).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // startReply
  // ===========================================================================
  describe('startReply', () => {
    it('should set replyToMessage and close action menu if open', () => {
      const { result } = renderHook(() => useMessageActions(defaultProps));

      // Open action menu first
      act(() => {
        result.current.openActionMenu(mockMessage, mockLayout);
      });

      expect(result.current.actionMenuVisible).toBe(true);

      // Start reply
      act(() => {
        result.current.startReply(mockMessage);
      });

      expect(result.current.replyToMessage).toEqual(mockMessage);
      expect(result.current.actionMenuVisible).toBe(false);
    });
  });

  // ===========================================================================
  // cancelReply
  // ===========================================================================
  describe('cancelReply', () => {
    it('should clear replyToMessage', () => {
      const { result } = renderHook(() => useMessageActions(defaultProps));

      // Set a reply target
      act(() => {
        result.current.startReply(mockMessage);
      });

      expect(result.current.replyToMessage).toEqual(mockMessage);

      // Cancel reply
      act(() => {
        result.current.cancelReply();
      });

      expect(result.current.replyToMessage).toBeNull();
    });
  });

  // ===========================================================================
  // handleUnsend
  // ===========================================================================
  describe('handleUnsend', () => {
    it('should call Cloud Function httpsCallable with correct params', async () => {
      const { result } = renderHook(() => useMessageActions(defaultProps));

      // Open action menu first
      act(() => {
        result.current.openActionMenu(mockMessage, mockLayout);
      });

      await act(async () => {
        await result.current.handleUnsend('msg1');
      });

      expect(mockGetFunctions).toHaveBeenCalled();
      expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'unsendMessage');
      expect(mockCallable).toHaveBeenCalledWith({
        conversationId: 'user1_user2',
        messageId: 'msg1',
      });
      expect(result.current.actionMenuVisible).toBe(false);
    });

    it('should handle errors gracefully without crashing', async () => {
      mockCallable.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useMessageActions(defaultProps));

      // Should not throw
      await act(async () => {
        await result.current.handleUnsend('msg1');
      });

      // Menu should still be closed
      expect(result.current.actionMenuVisible).toBe(false);
    });
  });

  // ===========================================================================
  // handleDeleteForMe
  // ===========================================================================
  describe('handleDeleteForMe', () => {
    it('should call onDeleteForMe and close action menu', () => {
      const { result } = renderHook(() => useMessageActions(defaultProps));

      // Open action menu first
      act(() => {
        result.current.openActionMenu(mockMessage, mockLayout);
      });

      act(() => {
        result.current.handleDeleteForMe('msg1');
      });

      expect(defaultProps.onDeleteForMe).toHaveBeenCalledWith('msg1');
      expect(result.current.actionMenuVisible).toBe(false);
    });
  });
});
