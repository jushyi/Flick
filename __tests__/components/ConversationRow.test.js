/**
 * ConversationRow Component Unit Tests
 *
 * Tests for:
 * - getPreviewText status logic (Sent/Seen with privacy gating)
 * - UnreadBadge rendering (count display, 99+ cap, zero count)
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';

// Mock date-fns
const mockIsYesterday = jest.fn(() => false);
const mockFormat = jest.fn(() => 'Mon');
jest.mock('date-fns', () => ({
  isYesterday: (...args) => mockIsYesterday(...args),
  format: (...args) => mockFormat(...args),
}));

// Mock expo-image
jest.mock('expo-image', () => ({
  Image: 'Image',
}));

// Mock PixelIcon
jest.mock('../../src/components/PixelIcon', () => 'PixelIcon');

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock AuthContext - define mockUserProfile BEFORE jest.mock
let mockUserProfile = { readReceiptsEnabled: true };
jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    userProfile: mockUserProfile,
  }),
}));

const ConversationRow = require('../../src/components/ConversationRow').default;

// Factory helpers
const CURRENT_USER_ID = 'user-me';
const FRIEND_ID = 'user-friend';

const makeConversation = (overrides = {}) => ({
  id: 'conv-1',
  participants: [CURRENT_USER_ID, FRIEND_ID],
  lastMessage: {
    senderId: CURRENT_USER_ID,
    text: 'Hello there',
    type: 'text',
    timestamp: { toDate: () => new Date(), toMillis: () => Date.now() - 1000 },
  },
  readReceipts: {},
  unreadCount: 0,
  updatedAt: { toDate: () => new Date(), toMillis: () => Date.now() },
  ...overrides,
});

const makeFriendProfile = (overrides = {}) => ({
  uid: FRIEND_ID,
  username: 'frienduser',
  displayName: 'Friend User',
  profilePhotoURL: null,
  photoURL: null,
  nameColor: null,
  readReceiptsEnabled: true,
  ...overrides,
});

describe('ConversationRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserProfile = { readReceiptsEnabled: true };
  });

  describe('getPreviewText', () => {
    it('shows "Sent" when current user sent last text message and friend has not read', () => {
      const conversation = makeConversation({
        readReceipts: {},
        lastMessage: {
          senderId: CURRENT_USER_ID,
          text: 'Hello',
          type: 'text',
          timestamp: { toDate: () => new Date(), toMillis: () => Date.now() },
        },
      });
      render(
        <ConversationRow
          conversation={conversation}
          friendProfile={makeFriendProfile()}
          currentUserId={CURRENT_USER_ID}
          onPress={() => {}}
          onLongPress={() => {}}
        />
      );
      expect(screen.getByText('Sent')).toBeTruthy();
    });

    it('shows "Seen" when current user sent last text message and friend has read', () => {
      const now = Date.now();
      const conversation = makeConversation({
        readReceipts: {
          [FRIEND_ID]: { toDate: () => new Date(now), toMillis: () => now },
        },
        lastMessage: {
          senderId: CURRENT_USER_ID,
          text: 'Hello',
          type: 'text',
          timestamp: { toDate: () => new Date(now - 1000), toMillis: () => now - 1000 },
        },
      });
      render(
        <ConversationRow
          conversation={conversation}
          friendProfile={makeFriendProfile()}
          currentUserId={CURRENT_USER_ID}
          onPress={() => {}}
          onLongPress={() => {}}
        />
      );
      expect(screen.getByText('Seen')).toBeTruthy();
    });

    it('shows "Sent" (not "Seen") when current user has readReceiptsEnabled === false', () => {
      mockUserProfile = { readReceiptsEnabled: false };
      const now = Date.now();
      const conversation = makeConversation({
        readReceipts: {
          [FRIEND_ID]: { toDate: () => new Date(now), toMillis: () => now },
        },
        lastMessage: {
          senderId: CURRENT_USER_ID,
          text: 'Hello',
          type: 'text',
          timestamp: { toDate: () => new Date(now - 1000), toMillis: () => now - 1000 },
        },
      });
      render(
        <ConversationRow
          conversation={conversation}
          friendProfile={makeFriendProfile()}
          currentUserId={CURRENT_USER_ID}
          onPress={() => {}}
          onLongPress={() => {}}
        />
      );
      expect(screen.getByText('Sent')).toBeTruthy();
    });

    it('shows "Sent" (not "Seen") when friend has readReceiptsEnabled === false', () => {
      const now = Date.now();
      const conversation = makeConversation({
        readReceipts: {
          [FRIEND_ID]: { toDate: () => new Date(now), toMillis: () => now },
        },
        lastMessage: {
          senderId: CURRENT_USER_ID,
          text: 'Hello',
          type: 'text',
          timestamp: { toDate: () => new Date(now - 1000), toMillis: () => now - 1000 },
        },
      });
      render(
        <ConversationRow
          conversation={conversation}
          friendProfile={makeFriendProfile({ readReceiptsEnabled: false })}
          currentUserId={CURRENT_USER_ID}
          onPress={() => {}}
          onLongPress={() => {}}
        />
      );
      expect(screen.getByText('Sent')).toBeTruthy();
    });

    it('shows actual message text when friend sent the last text message', () => {
      const conversation = makeConversation({
        lastMessage: {
          senderId: FRIEND_ID,
          text: 'hello',
          type: 'text',
          timestamp: { toDate: () => new Date(), toMillis: () => Date.now() },
        },
      });
      render(
        <ConversationRow
          conversation={conversation}
          friendProfile={makeFriendProfile()}
          currentUserId={CURRENT_USER_ID}
          onPress={() => {}}
          onLongPress={() => {}}
        />
      );
      expect(screen.getByText('hello')).toBeTruthy();
    });

    it('shows "Sent a GIF" when friend sent a gif', () => {
      const conversation = makeConversation({
        lastMessage: {
          senderId: FRIEND_ID,
          type: 'gif',
          gifUrl: 'https://giphy.com/test.gif',
          timestamp: { toDate: () => new Date(), toMillis: () => Date.now() },
        },
      });
      render(
        <ConversationRow
          conversation={conversation}
          friendProfile={makeFriendProfile()}
          currentUserId={CURRENT_USER_ID}
          onPress={() => {}}
          onLongPress={() => {}}
        />
      );
      expect(screen.getByText('Sent a GIF')).toBeTruthy();
    });

    it('defaults type to text when type field is missing', () => {
      const conversation = makeConversation({
        readReceipts: {},
        lastMessage: {
          senderId: CURRENT_USER_ID,
          text: 'Hello',
          // No type field
          timestamp: { toDate: () => new Date(), toMillis: () => Date.now() },
        },
      });
      render(
        <ConversationRow
          conversation={conversation}
          friendProfile={makeFriendProfile()}
          currentUserId={CURRENT_USER_ID}
          onPress={() => {}}
          onLongPress={() => {}}
        />
      );
      expect(screen.getByText('Sent')).toBeTruthy();
    });
  });

  describe('UnreadBadge', () => {
    it('shows unread count number when unreadCount > 0', () => {
      const conversation = makeConversation({
        unreadCount: 3,
        lastMessage: {
          senderId: FRIEND_ID,
          text: 'hey',
          type: 'text',
          timestamp: { toDate: () => new Date(), toMillis: () => Date.now() },
        },
      });
      render(
        <ConversationRow
          conversation={conversation}
          friendProfile={makeFriendProfile()}
          currentUserId={CURRENT_USER_ID}
          onPress={() => {}}
          onLongPress={() => {}}
        />
      );
      expect(screen.getByText('3')).toBeTruthy();
    });

    it('shows "99+" when unread count exceeds 99', () => {
      const conversation = makeConversation({
        unreadCount: 150,
        lastMessage: {
          senderId: FRIEND_ID,
          text: 'hey',
          type: 'text',
          timestamp: { toDate: () => new Date(), toMillis: () => Date.now() },
        },
      });
      render(
        <ConversationRow
          conversation={conversation}
          friendProfile={makeFriendProfile()}
          currentUserId={CURRENT_USER_ID}
          onPress={() => {}}
          onLongPress={() => {}}
        />
      );
      expect(screen.getByText('99+')).toBeTruthy();
    });

    it('does not render badge when unreadCount is 0', () => {
      const conversation = makeConversation({
        unreadCount: 0,
        lastMessage: {
          senderId: FRIEND_ID,
          text: 'hey',
          type: 'text',
          timestamp: { toDate: () => new Date(), toMillis: () => Date.now() },
        },
      });
      render(
        <ConversationRow
          conversation={conversation}
          friendProfile={makeFriendProfile()}
          currentUserId={CURRENT_USER_ID}
          onPress={() => {}}
          onLongPress={() => {}}
        />
      );
      // Should not find any numeric badge text
      expect(screen.queryByText('0')).toBeNull();
    });
  });
});
