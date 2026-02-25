/**
 * Test Factories
 *
 * Factory functions for creating test data with sensible defaults.
 * All factories accept optional overrides for customization.
 */

/**
 * Create a test user document
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} User document
 */
const createTestUser = (overrides = {}) => ({
  uid: 'test-user-123',
  phoneNumber: '+11234567890',
  displayName: 'Test User',
  username: 'testuser',
  bio: 'Test bio',
  profilePhotoURL: 'https://example.com/photo.jpg',
  createdAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
  fcmToken: 'ExponentPushToken[test-token]',
  profileSetupCompleted: true,
  ...overrides,
});

/**
 * Create a test photo document
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Photo document
 */
const createTestPhoto = (overrides = {}) => {
  const now = Date.now();
  return {
    id: 'photo-123',
    userId: 'test-user-123',
    imageURL: 'https://storage.example.com/photos/photo-123.jpg',
    capturedAt: { _seconds: now / 1000, _nanoseconds: 0 },
    revealedAt: null,
    status: 'developing', // 'developing' | 'revealed' | 'triaged'
    photoState: null, // null | 'journal' | 'archive'
    visibility: 'friends-only',
    month: new Date().toISOString().slice(0, 7), // YYYY-MM
    reactions: {},
    reactionCount: 0,
    ...overrides,
  };
};

/**
 * Create a revealed photo (ready for triage)
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Revealed photo document
 */
const createRevealedPhoto = (overrides = {}) => {
  const now = Date.now();
  return createTestPhoto({
    status: 'revealed',
    revealedAt: { _seconds: now / 1000, _nanoseconds: 0 },
    ...overrides,
  });
};

/**
 * Create a triaged photo (in journal)
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Triaged journal photo document
 */
const createJournaledPhoto = (overrides = {}) => {
  const now = Date.now();
  return createTestPhoto({
    status: 'triaged',
    photoState: 'journal',
    revealedAt: { _seconds: (now - 3600000) / 1000, _nanoseconds: 0 }, // 1 hour ago
    triagedAt: { seconds: now / 1000, toDate: () => new Date(now) }, // When photo was triaged
    ...overrides,
  });
};

/**
 * Create an archived photo
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Archived photo document
 */
const createArchivedPhoto = (overrides = {}) => {
  const now = Date.now();
  return createTestPhoto({
    status: 'triaged',
    photoState: 'archive',
    revealedAt: { _seconds: (now - 3600000) / 1000, _nanoseconds: 0 },
    ...overrides,
  });
};

/**
 * Create a test friendship document
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Friendship document
 */
const createTestFriendship = (overrides = {}) => {
  const inputUser1 = overrides.user1Id || 'user-a';
  const inputUser2 = overrides.user2Id || 'user-b';

  // Ensure user1Id is alphabetically first (deterministic ID pattern)
  const [sortedUser1, sortedUser2] = [inputUser1, inputUser2].sort();

  // Build base object without user IDs (they'll be added at the end)
  const base = {
    status: 'accepted', // 'pending' | 'accepted'
    requestedBy: sortedUser1,
    createdAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
    acceptedAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
    ...overrides,
  };

  // Override user IDs with sorted values (ensures deterministic order)
  return {
    ...base,
    user1Id: sortedUser1,
    user2Id: sortedUser2,
  };
};

/**
 * Create a pending friend request
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Pending friendship document
 */
const createPendingFriendRequest = (overrides = {}) => {
  return createTestFriendship({
    status: 'pending',
    acceptedAt: null,
    ...overrides,
  });
};

/**
 * Create a test darkroom document
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Darkroom document
 */
const createTestDarkroom = (overrides = {}) => {
  const now = Date.now();
  // Default: next reveal in 2 minutes
  return {
    userId: 'test-user-123',
    nextRevealAt: createTimestamp(now + 2 * 60 * 1000),
    lastRevealedAt: null,
    createdAt: createTimestamp(now),
    ...overrides,
  };
};

/**
 * Create a darkroom that's ready to reveal
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Ready darkroom document
 */
const createReadyDarkroom = (overrides = {}) => {
  const now = Date.now();
  // Next reveal is in the past (ready now)
  return createTestDarkroom({
    nextRevealAt: createTimestamp(now - 60000), // 1 min ago
    lastRevealedAt: createTimestamp(now - 3600000), // 1 hour ago
    ...overrides,
  });
};

/**
 * Create a test notification document
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Notification document
 */
const createTestNotification = (overrides = {}) => ({
  id: 'notification-123',
  userId: 'test-user-123',
  type: 'friend_request', // 'friend_request' | 'photo_reveal' | 'reaction'
  title: 'New Friend Request',
  body: 'Test User sent you a friend request',
  data: {},
  read: false,
  createdAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
  ...overrides,
});

/**
 * Create test reactions for a photo
 * @param {Object} overrides - Reaction data to merge
 * @returns {Object} Reactions object
 */
const createTestReactions = (overrides = {}) => ({
  'user-a': {
    heart: 2,
    fire: 1,
  },
  'user-b': {
    heart: 1,
  },
  ...overrides,
});

/**
 * Generate a friendship ID from two user IDs
 * (Matches the production generateFriendshipId function)
 * @param {string} userId1
 * @param {string} userId2
 * @returns {string} Deterministic friendship ID
 */
const generateFriendshipId = (userId1, userId2) => {
  return [userId1, userId2].sort().join('_');
};

/**
 * Create a mock Firestore timestamp
 * @param {Date|number} dateOrMs - Date object or milliseconds
 * @returns {Object} Firestore timestamp-like object
 */
const createTimestamp = (dateOrMs = Date.now()) => {
  const ms = typeof dateOrMs === 'number' ? dateOrMs : dateOrMs.getTime();
  return {
    _seconds: Math.floor(ms / 1000),
    _nanoseconds: 0,
    toDate: () => new Date(ms),
    toMillis: () => ms,
  };
};

/**
 * Create a test comment document
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Comment document
 */
const createTestComment = (overrides = {}) => ({
  id: 'comment-123',
  photoId: 'photo-123',
  userId: 'test-user-123',
  text: 'Test comment',
  parentId: null,
  mentionedCommentId: null,
  createdAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
  likes: 0,
  ...overrides,
});

/**
 * Create a test album document
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Album document
 */
const createTestAlbum = (overrides = {}) => ({
  id: 'album-123',
  userId: 'test-user-123',
  name: 'Test Album',
  photoIds: [],
  coverPhotoId: null,
  createdAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
  updatedAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
  ...overrides,
});

/**
 * Create a test mention object
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Mention object
 */
const createTestMention = (overrides = {}) => ({
  uid: 'mention-user-123',
  displayName: 'Mentioned User',
  username: 'mentioneduser',
  profilePhotoURL: 'https://example.com/mention-photo.jpg',
  ...overrides,
});

/**
 * Create a test block document
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Block document
 */
const createTestBlock = (overrides = {}) => ({
  id: 'block-123',
  blockerId: 'test-user-123',
  blockedId: 'blocked-user-456',
  createdAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
  ...overrides,
});

module.exports = {
  createTestUser,
  createTestPhoto,
  createRevealedPhoto,
  createJournaledPhoto,
  createArchivedPhoto,
  createTestFriendship,
  createPendingFriendRequest,
  createTestDarkroom,
  createReadyDarkroom,
  createTestNotification,
  createTestReactions,
  generateFriendshipId,
  createTimestamp,
  createTestComment,
  createTestAlbum,
  createTestMention,
  createTestBlock,
};
