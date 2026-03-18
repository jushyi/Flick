/**
 * FeedScreen Unit Tests
 *
 * Test scaffold for Phase 7 story card pagination.
 * All tests are skipped (it.todo) until implementation in Plans 01-03.
 */

import React from 'react';
// eslint-disable-next-line no-unused-vars -- scaffold: will be used when tests are implemented
import { render, screen, fireEvent } from '@testing-library/react-native';

// ─── Mock navigation ────────────────────────────────────────────────────
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    setOptions: jest.fn(),
    dispatch: jest.fn(),
    reset: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  }),
  useRoute: () => ({ params: {} }),
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

// ─── Mock safe area ──────────────────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const RN = require('react-native');
  const MockSafeAreaView = function MockSafeAreaView(props) {
    return React.createElement(RN.View, null, props.children);
  };
  MockSafeAreaView.displayName = 'MockSafeAreaView';
  return {
    SafeAreaView: MockSafeAreaView,
    useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  };
});

// ─── Mock expo-image ─────────────────────────────────────────────────────
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return {
    Image: props => <View testID="expo-image" {...props} />,
  };
});

// ─── Mock AuthContext ────────────────────────────────────────────────────
const mockUser = { uid: 'test-user-123' };
const mockUserProfile = {
  uid: 'test-user-123',
  username: 'testuser',
  displayName: 'Test User',
  photoURL: 'https://example.com/avatar.jpg',
  friends: ['friend-1', 'friend-2', 'friend-3'],
};

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    userProfile: mockUserProfile,
  }),
}));

// ─── Mock PhotoDetailContext ─────────────────────────────────────────────
jest.mock('../../src/context/PhotoDetailContext', () => ({
  usePhotoDetailActions: () => ({
    openPhotoDetail: jest.fn(),
    setCallbacks: jest.fn(),
    updatePhotoAtIndex: jest.fn(),
    updateCurrentPhoto: jest.fn(),
  }),
}));

// ─── Mock useFeedPhotos ──────────────────────────────────────────────────
const mockUseFeedPhotos = {
  photos: [],
  loading: false,
  refreshing: false,
  loadingMore: false,
  error: null,
  loadMorePhotos: jest.fn(),
  refreshFeed: jest.fn(),
  updatePhotoInState: jest.fn(),
};

jest.mock('../../src/hooks/useFeedPhotos', () => ({
  __esModule: true,
  default: () => mockUseFeedPhotos,
}));

// ─── Mock useViewedStories ──────────────────────────────────────────────
jest.mock('../../src/hooks/useViewedStories', () => ({
  useViewedStories: () => ({
    markAsViewed: jest.fn(),
    markPhotosAsViewed: jest.fn(),
    getFirstUnviewedIndex: jest.fn(() => 0),
    hasViewedAllPhotos: jest.fn(() => false),
    reloadViewedState: jest.fn(),
    loading: false,
    viewedPhotoCount: 0,
  }),
}));

// ─── Mock useScreenTrace ────────────────────────────────────────────────
jest.mock('../../src/hooks/useScreenTrace', () => ({
  useScreenTrace: () => ({
    markLoaded: jest.fn(),
  }),
}));

// ─── Mock feedService ───────────────────────────────────────────────────
const mockGetFriendStoriesData = jest.fn(() =>
  Promise.resolve({ success: true, friendStories: [], totalFriendCount: 0 })
);
const mockGetUserStoriesData = jest.fn(() => Promise.resolve({ success: true, photos: [] }));
const mockGetRandomFriendPhotos = jest.fn(() => Promise.resolve({ success: true, photos: [] }));

jest.mock('../../src/services/firebase/feedService', () => ({
  toggleReaction: jest.fn(),
  getFriendStoriesData: (...args) => mockGetFriendStoriesData(...args),
  getUserStoriesData: (...args) => mockGetUserStoriesData(...args),
  getRandomFriendPhotos: (...args) => mockGetRandomFriendPhotos(...args),
}));

// ─── Mock friendshipService ─────────────────────────────────────────────
jest.mock('../../src/services/firebase/friendshipService', () => ({
  getFriendUserIds: jest.fn(() =>
    Promise.resolve({ success: true, friendUserIds: ['friend-1', 'friend-2'] })
  ),
}));

// ─── Mock Components ────────────────────────────────────────────────────
jest.mock('../../src/components/PixelIcon', () => {
  const React = require('react');
  const RN = require('react-native');
  const MockPixelIcon = function MockPixelIcon(props) {
    return React.createElement(RN.Text, { testID: `pixel-icon-${props.name}` }, props.name);
  };
  MockPixelIcon.displayName = 'MockPixelIcon';
  return MockPixelIcon;
});

jest.mock('../../src/components/PixelSpinner', () => {
  const React = require('react');
  const RN = require('react-native');
  const MockPixelSpinner = function MockPixelSpinner() {
    return React.createElement(RN.View, { testID: 'pixel-spinner' });
  };
  MockPixelSpinner.displayName = 'MockPixelSpinner';
  return MockPixelSpinner;
});

jest.mock('../../src/components/FeedPhotoCard', () => {
  const React = require('react');
  const RN = require('react-native');
  const MockFeedPhotoCard = function MockFeedPhotoCard(props) {
    return React.createElement(
      RN.View,
      { testID: `feed-photo-card-${props.photo?.id}` },
      React.createElement(RN.Text, null, props.photo?.caption)
    );
  };
  MockFeedPhotoCard.displayName = 'MockFeedPhotoCard';
  return MockFeedPhotoCard;
});

jest.mock('../../src/components/FeedLoadingSkeleton', () => {
  const React = require('react');
  const RN = require('react-native');
  const MockFeedLoadingSkeleton = function MockFeedLoadingSkeleton() {
    return React.createElement(RN.View, { testID: 'feed-loading-skeleton' });
  };
  MockFeedLoadingSkeleton.displayName = 'MockFeedLoadingSkeleton';
  return MockFeedLoadingSkeleton;
});

jest.mock('../../src/components', () => {
  const React = require('react');
  const RN = require('react-native');
  const MockFriendStoryCard = function MockFriendStoryCard(props) {
    return React.createElement(
      RN.View,
      { testID: `friend-story-card-${props.friend?.friendId}` },
      React.createElement(RN.Text, null, props.friend?.username)
    );
  };
  MockFriendStoryCard.displayName = 'MockFriendStoryCard';
  return { FriendStoryCard: MockFriendStoryCard };
});

jest.mock('../../src/components/MeStoryCard', () => {
  const React = require('react');
  const RN = require('react-native');
  const MockMeStoryCard = function MockMeStoryCard() {
    return React.createElement(RN.View, { testID: 'me-story-card' });
  };
  MockMeStoryCard.displayName = 'MockMeStoryCard';
  return { MeStoryCard: MockMeStoryCard };
});

jest.mock('../../src/components/AddFriendsPromptCard', () => {
  const React = require('react');
  const RN = require('react-native');
  const MockAddFriendsPromptCard = function MockAddFriendsPromptCard() {
    return React.createElement(RN.View, { testID: 'add-friends-prompt' });
  };
  MockAddFriendsPromptCard.displayName = 'MockAddFriendsPromptCard';
  return MockAddFriendsPromptCard;
});

jest.mock('../../src/components/TakeFirstPhotoCard', () => {
  const React = require('react');
  const RN = require('react-native');
  const MockTakeFirstPhotoCard = function MockTakeFirstPhotoCard() {
    return React.createElement(RN.View, { testID: 'take-first-photo' });
  };
  MockTakeFirstPhotoCard.displayName = 'MockTakeFirstPhotoCard';
  return MockTakeFirstPhotoCard;
});

// ─── Mock imageUtils ─────────────────────────────────────────────────────
jest.mock('../../src/utils/imageUtils', () => ({
  profileCacheKey: jest.fn((prefix, url) => `${prefix}-cache`),
}));

// ─── Mock timeUtils ─────────────────────────────────────────────────────
jest.mock('../../src/utils/timeUtils', () => ({
  getTimeAgo: jest.fn(() => '2h ago'),
}));

describe('FeedScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('story card pagination', () => {
    it.todo('renders only STORY_BATCH_SIZE friends initially');
    it.todo('shows "More" button when more friends exist beyond batch');
    it.todo('does not show "More" button when all friends are visible');
    it.todo('tapping "More" reveals next batch of friend story cards');
    it.todo('stories mode sequence only includes visible friends');
  });
});
