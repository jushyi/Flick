/**
 * PhotoDetailScreen Unit Tests
 *
 * Tests for attribution display on reshared photos and "Add to feed" button
 * when opened from a tagged photo message context.
 *
 * Phase 7 test scaffolds (skipped/todo until implementation):
 * - Progressive loading (thumbnailDataURL, transition timing)
 * - Dark loading overlay (spinner on image load)
 * - Subscription pause/resume during cube transitions
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// ─── Mock navigation ────────────────────────────────────────────────────
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockRouteParams = {};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    setOptions: jest.fn(),
    dispatch: jest.fn(),
    reset: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  }),
  useRoute: () => ({ params: mockRouteParams }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));

// ─── Mock logger ─────────────────────────────────────────────────────────
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ─── Mock PixelIcon ──────────────────────────────────────────────────────
const MockPixelIcon = ({ name }) => {
  const { Text } = require('react-native');
  return <Text testID={`pixel-icon-${name}`}>{name}</Text>;
};
MockPixelIcon.displayName = 'MockPixelIcon';
jest.mock('../../src/components/PixelIcon', () => MockPixelIcon);

// ─── Mock StrokedNameText ────────────────────────────────────────────────
const MockStrokedNameText = ({ children, ...props }) => {
  const { Text } = require('react-native');
  return <Text {...props}>{children}</Text>;
};
MockStrokedNameText.displayName = 'MockStrokedNameText';
jest.mock('../../src/components/StrokedNameText', () => MockStrokedNameText);

// ─── Mock expo-image ─────────────────────────────────────────────────────
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return {
    Image: ({ source, ...props }) => <View testID="expo-image" {...props} />,
  };
});

// ─── Mock rn-emoji-keyboard ──────────────────────────────────────────────
const MockEmojiPicker = () => {
  const { View } = require('react-native');
  return <View testID="emoji-picker" />;
};
MockEmojiPicker.displayName = 'MockEmojiPicker';
jest.mock('rn-emoji-keyboard', () => MockEmojiPicker);

// ─── Mock photo services ────────────────────────────────────────────────
jest.mock('../../src/services/firebase/photoService', () => ({
  softDeletePhoto: jest.fn(),
  archivePhoto: jest.fn(),
  restorePhoto: jest.fn(),
  updatePhotoTags: jest.fn(),
  updateCaption: jest.fn(),
  subscribePhoto: jest.fn(() => jest.fn()),
}));

// ─── Mock addTaggedPhotoToFeed ──────────────────────────────────────────
const mockAddTaggedPhotoToFeed = jest.fn(() =>
  Promise.resolve({ success: true, newPhotoId: 'new-photo-id' })
);
jest.mock('../../src/services/firebase/photoTagService', () => ({
  addTaggedPhotoToFeed: (...args) => mockAddTaggedPhotoToFeed(...args),
}));

// ─── Mock DropdownMenu ──────────────────────────────────────────────────
const MockDropdownMenu = () => {
  const { View } = require('react-native');
  return <View testID="dropdown-menu" />;
};
MockDropdownMenu.displayName = 'MockDropdownMenu';
jest.mock('../../src/components/DropdownMenu', () => MockDropdownMenu);

// ─── Mock TagFriendsModal and TaggedPeopleModal ─────────────────────────
jest.mock('../../src/components', () => ({
  TagFriendsModal: props => null,
  TaggedPeopleModal: props => null,
}));

// ─── Mock CommentsBottomSheet ───────────────────────────────────────────
const MockCommentsBottomSheet = () => {
  const { View } = require('react-native');
  return <View testID="comments-bottom-sheet" />;
};
MockCommentsBottomSheet.displayName = 'MockCommentsBottomSheet';
jest.mock('../../src/components/comments/CommentsBottomSheet', () => MockCommentsBottomSheet);

// ─── Mock timeUtils ──────────────────────────────────────────────────────
jest.mock('../../src/utils/timeUtils', () => ({
  getTimeAgo: jest.fn(() => '2h ago'),
}));

// ─── Mock imageUtils ─────────────────────────────────────────────────────
jest.mock('../../src/utils/imageUtils', () => ({
  profileCacheKey: jest.fn((prefix, url) => `${prefix}-cache`),
}));

// ─── Mock safe area ──────────────────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

// ─── Mock usePhotoDetailModal ────────────────────────────────────────────
jest.mock('../../src/hooks/usePhotoDetailModal', () => ({
  usePhotoDetailModal: () => ({
    showProgressBar: false,
    currentPhoto: mockCurrentPhoto,
    imageURL: 'https://example.com/photo.jpg',
    capturedAt: { _seconds: Date.now() / 1000 },
    displayName: 'Test User',
    profilePhotoURL: 'https://example.com/avatar.jpg',
    nameColor: null,
    currentIndex: 0,
    totalPhotos: 1,
    handleTapNavigation: jest.fn(),
    translateY: { interpolate: jest.fn(() => 0) },
    opacity: { interpolate: jest.fn(() => 1) },
    panResponder: { panHandlers: {} },
    openProgress: { interpolate: jest.fn(() => 1) },
    dismissScale: 1,
    suckTranslateX: 0,
    animatedBorderRadius: 0,
    sourceTransform: null,
    groupedReactions: {},
    orderedEmojis: [],
    getUserReactionCount: jest.fn(() => 0),
    handleEmojiPress: jest.fn(),
    showEmojiPicker: false,
    setShowEmojiPicker: jest.fn(),
    handleOpenEmojiPicker: jest.fn(),
    handleEmojiPickerSelect: jest.fn(),
    newlyAddedEmoji: null,
    handleClose: jest.fn(),
    updateCommentsVisible: jest.fn(),
  }),
}));

// ─── Mock PhotoDetailContext ─────────────────────────────────────────────
let mockCurrentPhoto = {
  id: 'photo-1',
  userId: 'other-user',
  imageURL: 'https://example.com/photo.jpg',
  caption: 'Test caption',
  commentCount: 0,
  taggedUserIds: [],
  user: { nameColor: null },
};

const mockContextUserId = 'current-user-123';

const mockContextAvatarPress = jest.fn();

jest.mock('../../src/context/PhotoDetailContext', () => ({
  usePhotoDetail: () => ({
    currentPhoto: mockCurrentPhoto,
    photos: [mockCurrentPhoto],
    currentIndex: 0,
    mode: 'feed',
    isOwnStory: false,
    hasNextFriend: false,
    hasPreviousFriend: false,
    currentUserId: mockContextUserId,
    sourceRect: null,
    initialShowComments: false,
    targetCommentId: null,
    showComments: false,
    setShowComments: jest.fn(),
    handleReactionToggle: jest.fn(),
    handlePhotoChange: jest.fn(),
    handleRequestNextFriend: jest.fn(),
    handleRequestPreviousFriend: jest.fn(),
    handleCancelFriendTransition: jest.fn(),
    handleAvatarPress: mockContextAvatarPress,
    handleClose: jest.fn(),
    handlePhotoStateChanged: jest.fn(),
    updateCurrentPhoto: jest.fn(),
    updatePhotoAtIndex: jest.fn(),
    getCallbacks: jest.fn(() => ({})),
  }),
}));

const PhotoDetailScreen = require('../../src/screens/PhotoDetailScreen').default;

describe('PhotoDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset route params
    Object.keys(mockRouteParams).forEach(key => delete mockRouteParams[key]);
    // Reset current photo
    mockCurrentPhoto = {
      id: 'photo-1',
      userId: 'other-user',
      imageURL: 'https://example.com/photo.jpg',
      caption: 'Test caption',
      commentCount: 0,
      taggedUserIds: [],
      user: { nameColor: null },
    };
  });

  // ─── Attribution Display ─────────────────────────────────────────────

  describe('Attribution display', () => {
    it('renders attribution text when photo has attribution field', () => {
      mockCurrentPhoto = {
        ...mockCurrentPhoto,
        attribution: {
          photographerUsername: 'alice',
          photographerId: 'uid1',
          photographerDisplayName: 'Alice',
        },
      };

      render(<PhotoDetailScreen />);
      expect(screen.getByText('Photo by @alice')).toBeTruthy();
    });

    it('does NOT render attribution when photo has no attribution', () => {
      render(<PhotoDetailScreen />);
      expect(screen.queryByText(/Photo by @/)).toBeNull();
    });

    it('navigates to photographer profile via contextAvatarPress when attribution tapped', () => {
      mockCurrentPhoto = {
        ...mockCurrentPhoto,
        attribution: {
          photographerUsername: 'alice',
          photographerId: 'uid1',
          photographerDisplayName: 'Alice',
        },
      };

      render(<PhotoDetailScreen />);
      fireEvent.press(screen.getByText('Photo by @alice'));
      expect(mockContextAvatarPress).toHaveBeenCalledWith('uid1', 'Alice');
    });
  });

  // ─── Add to Feed Button ──────────────────────────────────────────────

  describe('Add to feed button', () => {
    it("shows 'Add to feed' button when taggedPhotoContext is present and user is not photo owner", () => {
      mockRouteParams.taggedPhotoContext = {
        messageId: 'msg-1',
        conversationId: 'conv-1',
        photoId: 'photo-1',
        addedToFeedBy: {},
      };
      mockCurrentPhoto.userId = 'other-user';

      render(<PhotoDetailScreen />);
      expect(screen.getByText('Add to feed')).toBeTruthy();
    });

    it("does NOT show 'Add to feed' button when user is the photo owner", () => {
      mockRouteParams.taggedPhotoContext = {
        messageId: 'msg-1',
        conversationId: 'conv-1',
        photoId: 'photo-1',
        addedToFeedBy: {},
      };
      mockCurrentPhoto.userId = mockContextUserId;

      render(<PhotoDetailScreen />);
      expect(screen.queryByText('Add to feed')).toBeNull();
    });

    it("does NOT show 'Add to feed' button when no taggedPhotoContext", () => {
      // No taggedPhotoContext in route params
      render(<PhotoDetailScreen />);
      expect(screen.queryByText('Add to feed')).toBeNull();
      expect(screen.queryByText('Added to feed')).toBeNull();
    });

    it("shows 'Added to feed' disabled state when addedToFeedBy includes current user", () => {
      mockRouteParams.taggedPhotoContext = {
        messageId: 'msg-1',
        conversationId: 'conv-1',
        photoId: 'photo-1',
        addedToFeedBy: { [mockContextUserId]: { newPhotoId: 'new-1' } },
      };
      mockCurrentPhoto.userId = 'other-user';

      render(<PhotoDetailScreen />);
      expect(screen.getByText('Added to feed')).toBeTruthy();
    });
  });

  // ─── Phase 7: Progressive Loading ──────────────────────────────────────

  describe('progressive loading', () => {
    it.todo('renders placeholder prop with thumbnailDataURL when available');
    it.todo('sets transition={200} when thumbnailDataURL exists');
    it.todo('sets transition={0} when thumbnailDataURL is absent');
  });

  // ─── Phase 7: Dark Loading Overlay ─────────────────────────────────────

  describe('dark loading overlay', () => {
    it.todo('shows dark overlay with spinner when imageLoading is true');
    it.todo('hides dark overlay when image finishes loading');
    it.todo('shows dark overlay immediately on photo change');
  });

  // ─── Phase 7: Subscription Pause/Resume ────────────────────────────────

  describe('subscription pause/resume', () => {
    it.todo('pauses subscription at start of cube transition');
    it.todo('resumes subscription when contextPhoto.id changes');
    it.todo('cleans up subscription on unmount');
  });
});
