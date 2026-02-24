/**
 * FeedPhotoCard Component Unit Tests
 *
 * Tests for the attribution display on reshared photos in the feed.
 * Attribution shows "Photo by @username" below name/timestamp and above caption.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

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

// Mock PixelIcon to render testable output
const MockPixelIcon = ({ name, size, color }) => {
  const { Text } = require('react-native');
  return <Text testID={`pixel-icon-${name}`}>{name}</Text>;
};
MockPixelIcon.displayName = 'MockPixelIcon';
jest.mock('../../src/components/PixelIcon', () => MockPixelIcon);

// Mock StrokedNameText to render children
const MockStrokedNameText = ({ children, ...props }) => {
  const { Text } = require('react-native');
  return <Text {...props}>{children}</Text>;
};
MockStrokedNameText.displayName = 'MockStrokedNameText';
jest.mock('../../src/components/StrokedNameText', () => MockStrokedNameText);

// Mock expo-image
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return {
    Image: ({ source, ...props }) => <View testID="expo-image" {...props} />,
  };
});

// Mock CommentPreview
const MockCommentPreview = () => {
  const { View } = require('react-native');
  return <View testID="comment-preview" />;
};
MockCommentPreview.displayName = 'MockCommentPreview';
jest.mock('../../src/components/comments/CommentPreview', () => MockCommentPreview);

// Mock getPreviewComments
jest.mock('../../src/services/firebase/commentService', () => ({
  getPreviewComments: jest.fn(() => Promise.resolve({ success: true, previewComments: [] })),
}));

// Mock timeUtils
jest.mock('../../src/utils/timeUtils', () => ({
  getTimeAgo: jest.fn(() => '2h ago'),
}));

// Mock imageUtils
jest.mock('../../src/utils/imageUtils', () => ({
  profileCacheKey: jest.fn((prefix, url) => `${prefix}-cache`),
}));

const FeedPhotoCard = require('../../src/components/FeedPhotoCard').default;

// Helper to create a base photo object
const createPhoto = (overrides = {}) => ({
  id: 'photo-1',
  imageURL: 'https://example.com/photo.jpg',
  capturedAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
  reactions: {},
  reactionCount: 0,
  commentCount: 0,
  userId: 'user-1',
  user: {
    displayName: 'Test User',
    profilePhotoURL: 'https://example.com/avatar.jpg',
  },
  ...overrides,
});

describe('FeedPhotoCard', () => {
  const defaultProps = {
    photo: createPhoto(),
    onPress: jest.fn(),
    onCommentPress: jest.fn(),
    onAvatarPress: jest.fn(),
    currentUserId: 'current-user',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Attribution Display ─────────────────────────────────────────────

  describe('Attribution display', () => {
    it('renders attribution text when photo has attribution field', () => {
      const photo = createPhoto({
        attribution: {
          photographerUsername: 'alice',
          photographerId: 'uid1',
          photographerDisplayName: 'Alice',
        },
      });

      render(<FeedPhotoCard {...defaultProps} photo={photo} />);
      expect(screen.getByText('Photo by @alice')).toBeTruthy();
    });

    it('does NOT render attribution when photo has no attribution field', () => {
      const photo = createPhoto(); // no attribution

      render(<FeedPhotoCard {...defaultProps} photo={photo} />);
      expect(screen.queryByText(/Photo by @/)).toBeNull();
    });

    it('calls onAvatarPress with photographer ID when attribution tapped', () => {
      const onAvatarPress = jest.fn();
      const photo = createPhoto({
        attribution: {
          photographerUsername: 'alice',
          photographerId: 'uid1',
          photographerDisplayName: 'Alice',
        },
      });

      render(<FeedPhotoCard {...defaultProps} photo={photo} onAvatarPress={onAvatarPress} />);
      fireEvent.press(screen.getByText('Photo by @alice'));
      expect(onAvatarPress).toHaveBeenCalledWith('uid1', 'Alice');
    });

    it('renders attribution between info row and caption', () => {
      const photo = createPhoto({
        caption: 'My photo caption',
        attribution: {
          photographerUsername: 'bob',
          photographerId: 'uid2',
          photographerDisplayName: 'Bob',
        },
      });

      const { toJSON } = render(<FeedPhotoCard {...defaultProps} photo={photo} />);
      const tree = JSON.stringify(toJSON());

      // Attribution text contains "Photo by @" and the username, and should appear before caption
      const attributionIndex = tree.indexOf('Photo by @');
      const captionIndex = tree.indexOf('My photo caption');
      expect(attributionIndex).toBeGreaterThan(-1);
      expect(captionIndex).toBeGreaterThan(-1);
      expect(attributionIndex).toBeLessThan(captionIndex);
    });

    it('renders camera icon next to attribution text', () => {
      const photo = createPhoto({
        attribution: {
          photographerUsername: 'alice',
          photographerId: 'uid1',
          photographerDisplayName: 'Alice',
        },
      });

      render(<FeedPhotoCard {...defaultProps} photo={photo} />);
      expect(screen.getByTestId('pixel-icon-camera')).toBeTruthy();
    });
  });
});
