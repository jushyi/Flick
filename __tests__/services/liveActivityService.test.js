/**
 * Live Activity Service Unit Tests
 *
 * Tests for liveActivityService including:
 * - startPinnedSnapActivity: native module call, deep link URL, error handling
 * - endPinnedSnapActivity: end by activity ID, error handling
 * - endAllPinnedActivities: end all, error handling
 * - Platform guards: Android returns { success: false } without crash
 */

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

// Create mock functions at module level
const mockStartActivity = jest.fn(() => Promise.resolve('native-activity-id-123'));
const mockEndActivity = jest.fn(() => Promise.resolve());
const mockEndAllActivities = jest.fn(() => Promise.resolve());
const mockRemoveFromStack = jest.fn(() => Promise.resolve());

// Mock the native module (named exports, not default)
jest.mock('../../modules/live-activity-manager', () => ({
  __esModule: true,
  startActivity: (...args) => mockStartActivity(...args),
  endActivity: (...args) => mockEndActivity(...args),
  endAllActivities: (...args) => mockEndAllActivities(...args),
  removeFromStack: (...args) => mockRemoveFromStack(...args),
}));

// Helper to reload module with specific platform
const loadServiceWithPlatform = platform => {
  jest.resetModules();

  jest.doMock('react-native', () => ({
    Platform: { OS: platform },
  }));

  // Re-mock logger after resetModules
  jest.doMock('../../src/utils/logger', () => ({
    __esModule: true,
    default: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  }));

  // Mock the native module with named exports (not default)
  jest.doMock('../../modules/live-activity-manager', () => ({
    __esModule: true,
    startActivity: (...args) => mockStartActivity(...args),
    endActivity: (...args) => mockEndActivity(...args),
    endAllActivities: (...args) => mockEndAllActivities(...args),
    removeFromStack: (...args) => mockRemoveFromStack(...args),
  }));

  return require('../../src/services/liveActivityService');
};

describe('liveActivityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStartActivity.mockResolvedValue('native-activity-id-123');
    mockEndActivity.mockResolvedValue(undefined);
    mockEndAllActivities.mockResolvedValue(undefined);
    mockRemoveFromStack.mockResolvedValue(undefined);
  });

  // ==========================================================================
  // startPinnedSnapActivity - iOS
  // ==========================================================================
  describe('startPinnedSnapActivity (iOS)', () => {
    let service;

    beforeAll(() => {
      service = loadServiceWithPlatform('ios');
    });

    it('should call native module with correct params including deep link URL', async () => {
      const result = await service.startPinnedSnapActivity({
        activityId: 'snap-123',
        senderName: 'Alice',
        caption: 'Hello!',
        conversationId: 'conv-456',
        friendId: 'friend-789',
        thumbnailUri: 'file://thumb.jpg',
      });

      expect(result.success).toBe(true);
      expect(result.nativeActivityId).toBe('native-activity-id-123');

      expect(mockStartActivity).toHaveBeenCalledWith(
        'snap-123',
        'Alice',
        'Hello!',
        'lapse://messages/conv-456',
        'file://thumb.jpg'
      );
    });

    it('should construct deep link as lapse://messages/{conversationId}', async () => {
      await service.startPinnedSnapActivity({
        activityId: 'snap-abc',
        senderName: 'Bob',
        caption: null,
        conversationId: 'conv-xyz',
        friendId: 'friend-123',
        thumbnailUri: 'file://thumb2.jpg',
      });

      const deepLinkArg = mockStartActivity.mock.calls[0][3];
      expect(deepLinkArg).toBe('lapse://messages/conv-xyz');
    });

    it('should pass null caption when caption is empty', async () => {
      await service.startPinnedSnapActivity({
        activityId: 'snap-nocap',
        senderName: 'Charlie',
        caption: '',
        conversationId: 'conv-999',
        friendId: 'friend-111',
        thumbnailUri: 'file://thumb3.jpg',
      });

      const captionArg = mockStartActivity.mock.calls[0][2];
      expect(captionArg).toBeNull();
    });

    it('should return { success: false } when native module throws', async () => {
      mockStartActivity.mockRejectedValueOnce(new Error('ActivityKit failed'));

      const result = await service.startPinnedSnapActivity({
        activityId: 'snap-err',
        senderName: 'Dave',
        caption: 'test',
        conversationId: 'conv-err',
        friendId: 'friend-err',
        thumbnailUri: 'file://thumb-err.jpg',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('ActivityKit failed');
    });
  });

  // ==========================================================================
  // startPinnedSnapActivity - Android
  // ==========================================================================
  describe('startPinnedSnapActivity (Android)', () => {
    let service;

    beforeAll(() => {
      service = loadServiceWithPlatform('android');
    });

    it('should return { success: false } on Android without crashing', async () => {
      const result = await service.startPinnedSnapActivity({
        activityId: 'snap-android',
        senderName: 'Eve',
        caption: 'test',
        conversationId: 'conv-android',
        friendId: 'friend-android',
        thumbnailUri: 'file://thumb-android.jpg',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not supported');
      expect(mockStartActivity).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // endPinnedSnapActivity
  // ==========================================================================
  describe('endPinnedSnapActivity', () => {
    let service;

    beforeAll(() => {
      service = loadServiceWithPlatform('ios');
    });

    it('should call native endActivity with activityId', async () => {
      const result = await service.endPinnedSnapActivity('snap-end-123');

      expect(result.success).toBe(true);
      expect(mockEndActivity).toHaveBeenCalledWith('snap-end-123');
    });

    it('should return { success: false } when native module throws', async () => {
      mockEndActivity.mockRejectedValueOnce(new Error('End failed'));

      const result = await service.endPinnedSnapActivity('snap-end-err');

      expect(result.success).toBe(false);
      expect(result.error).toBe('End failed');
    });
  });

  // ==========================================================================
  // endPinnedSnapActivity - Android
  // ==========================================================================
  describe('endPinnedSnapActivity (Android)', () => {
    let service;

    beforeAll(() => {
      service = loadServiceWithPlatform('android');
    });

    it('should not crash on Android and return { success: false }', async () => {
      const result = await service.endPinnedSnapActivity('snap-android-end');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not supported');
      expect(mockEndActivity).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // removePinnedSnap
  // ==========================================================================
  describe('removePinnedSnap', () => {
    let service;

    beforeAll(() => {
      service = loadServiceWithPlatform('ios');
    });

    it('should call native removeFromStack with snapActivityId', async () => {
      const result = await service.removePinnedSnap('snap-remove-123');

      expect(result.success).toBe(true);
      expect(mockRemoveFromStack).toHaveBeenCalledWith('snap-remove-123');
    });

    it('should return { success: false } when native module throws', async () => {
      mockRemoveFromStack.mockRejectedValueOnce(new Error('Remove failed'));

      const result = await service.removePinnedSnap('snap-remove-err');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Remove failed');
    });
  });

  // ==========================================================================
  // removePinnedSnap - Android
  // ==========================================================================
  describe('removePinnedSnap (Android)', () => {
    let service;

    beforeAll(() => {
      service = loadServiceWithPlatform('android');
    });

    it('should not crash on Android and return { success: false }', async () => {
      const result = await service.removePinnedSnap('snap-android-remove');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not supported');
      expect(mockRemoveFromStack).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // endAllPinnedActivities
  // ==========================================================================
  describe('endAllPinnedActivities', () => {
    let service;

    beforeAll(() => {
      service = loadServiceWithPlatform('ios');
    });

    it('should call native endAllActivities', async () => {
      const result = await service.endAllPinnedActivities();

      expect(result.success).toBe(true);
      expect(mockEndAllActivities).toHaveBeenCalled();
    });

    it('should return { success: false } when native module throws', async () => {
      mockEndAllActivities.mockRejectedValueOnce(new Error('EndAll failed'));

      const result = await service.endAllPinnedActivities();

      expect(result.success).toBe(false);
      expect(result.error).toBe('EndAll failed');
    });
  });
});
