/**
 * Live Activity Service Unit Tests
 *
 * Tests for liveActivityService including:
 * - startPinnedSnapActivity: native module bridge, deep link URL, Platform guards
 * - endPinnedSnapActivity: native module bridge, Platform guards
 * - endAllPinnedActivities: native module bridge, Platform guards
 * - Error handling for all functions
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

// Create mock native module functions at module level
const mockStartActivity = jest.fn(() => Promise.resolve('native-activity-123'));
const mockEndActivity = jest.fn(() => Promise.resolve());
const mockEndAllActivities = jest.fn(() => Promise.resolve());

// Mock the native module
jest.mock('../../modules/live-activity-manager', () => ({
  __esModule: true,
  default: {
    startActivity: (...args) => mockStartActivity(...args),
    endActivity: (...args) => mockEndActivity(...args),
    endAllActivities: (...args) => mockEndAllActivities(...args),
  },
}));

// Default to iOS platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn(obj => obj.ios),
  },
}));

describe('liveActivityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStartActivity.mockResolvedValue('native-activity-123');
    mockEndActivity.mockResolvedValue(undefined);
    mockEndAllActivities.mockResolvedValue(undefined);
  });

  // ==========================================================================
  // iOS (default platform) tests
  // ==========================================================================
  describe('startPinnedSnapActivity (iOS)', () => {
    let startPinnedSnapActivity;

    beforeAll(() => {
      // Re-require with iOS platform (default mock)
      jest.isolateModules(() => {
        const service = require('../../src/services/liveActivityService');
        startPinnedSnapActivity = service.startPinnedSnapActivity;
      });
    });

    it('should call native module with correct params including deep link URL', async () => {
      const result = await startPinnedSnapActivity({
        activityId: 'snap-001',
        senderName: 'Alice',
        caption: 'Hello world',
        conversationId: 'conv-123',
        friendId: 'friend-456',
        thumbnailUri: 'file://thumb.jpg',
      });

      expect(result.success).toBe(true);
      expect(result.nativeActivityId).toBe('native-activity-123');

      expect(mockStartActivity).toHaveBeenCalledWith(
        'snap-001',
        'Alice',
        'Hello world',
        'lapse://messages/conv-123',
        'file://thumb.jpg'
      );
    });

    it('should construct deep link as lapse://messages/{conversationId}', async () => {
      await startPinnedSnapActivity({
        activityId: 'snap-002',
        senderName: 'Bob',
        caption: null,
        conversationId: 'conv-789',
        friendId: 'friend-101',
        thumbnailUri: 'file://thumb2.jpg',
      });

      // Verify the deep link URL pattern
      const deepLinkArg = mockStartActivity.mock.calls[0][3];
      expect(deepLinkArg).toBe('lapse://messages/conv-789');
    });

    it('should pass null caption when caption is undefined', async () => {
      await startPinnedSnapActivity({
        activityId: 'snap-003',
        senderName: 'Charlie',
        caption: undefined,
        conversationId: 'conv-999',
        friendId: 'friend-202',
        thumbnailUri: 'file://thumb3.jpg',
      });

      const captionArg = mockStartActivity.mock.calls[0][2];
      expect(captionArg).toBeNull();
    });

    it('should return { success: false } when native module throws', async () => {
      mockStartActivity.mockRejectedValueOnce(new Error('ActivityKit not authorized'));

      const result = await startPinnedSnapActivity({
        activityId: 'snap-err',
        senderName: 'Error User',
        caption: null,
        conversationId: 'conv-err',
        friendId: 'friend-err',
        thumbnailUri: 'file://thumb-err.jpg',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('ActivityKit not authorized');
    });
  });

  describe('endPinnedSnapActivity (iOS)', () => {
    let endPinnedSnapActivity;

    beforeAll(() => {
      jest.isolateModules(() => {
        const service = require('../../src/services/liveActivityService');
        endPinnedSnapActivity = service.endPinnedSnapActivity;
      });
    });

    it('should call native endActivity with activityId', async () => {
      const result = await endPinnedSnapActivity('snap-end-001');

      expect(result.success).toBe(true);
      expect(mockEndActivity).toHaveBeenCalledWith('snap-end-001');
    });

    it('should return { success: false } when native module throws', async () => {
      mockEndActivity.mockRejectedValueOnce(new Error('Activity not found'));

      const result = await endPinnedSnapActivity('snap-end-err');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Activity not found');
    });
  });

  describe('endAllPinnedActivities (iOS)', () => {
    let endAllPinnedActivities;

    beforeAll(() => {
      jest.isolateModules(() => {
        const service = require('../../src/services/liveActivityService');
        endAllPinnedActivities = service.endAllPinnedActivities;
      });
    });

    it('should call native endAllActivities', async () => {
      const result = await endAllPinnedActivities();

      expect(result.success).toBe(true);
      expect(mockEndAllActivities).toHaveBeenCalled();
    });

    it('should return { success: false } when native module throws', async () => {
      mockEndAllActivities.mockRejectedValueOnce(new Error('Failed'));

      const result = await endAllPinnedActivities();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed');
    });
  });

  // ==========================================================================
  // Android platform tests (must use isolateModules to re-evaluate Platform.OS)
  // ==========================================================================
  describe('Android platform guards', () => {
    it('startPinnedSnapActivity returns { success: false } on Android', async () => {
      let startFn;
      jest.isolateModules(() => {
        jest.doMock('react-native', () => ({
          Platform: {
            OS: 'android',
            select: jest.fn(obj => obj.android),
          },
        }));
        const service = require('../../src/services/liveActivityService');
        startFn = service.startPinnedSnapActivity;
      });

      const result = await startFn({
        activityId: 'snap-android',
        senderName: 'Android User',
        caption: null,
        conversationId: 'conv-android',
        friendId: 'friend-android',
        thumbnailUri: 'file://thumb-android.jpg',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not supported');
      expect(mockStartActivity).not.toHaveBeenCalled();
    });

    it('endPinnedSnapActivity returns { success: false } on Android (no crash)', async () => {
      let endFn;
      jest.isolateModules(() => {
        jest.doMock('react-native', () => ({
          Platform: {
            OS: 'android',
            select: jest.fn(obj => obj.android),
          },
        }));
        const service = require('../../src/services/liveActivityService');
        endFn = service.endPinnedSnapActivity;
      });

      const result = await endFn('snap-android-end');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not supported');
      expect(mockEndActivity).not.toHaveBeenCalled();
    });

    it('endAllPinnedActivities returns { success: false } on Android (no crash)', async () => {
      let endAllFn;
      jest.isolateModules(() => {
        jest.doMock('react-native', () => ({
          Platform: {
            OS: 'android',
            select: jest.fn(obj => obj.android),
          },
        }));
        const service = require('../../src/services/liveActivityService');
        endAllFn = service.endAllPinnedActivities;
      });

      const result = await endAllFn();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not supported');
      expect(mockEndAllActivities).not.toHaveBeenCalled();
    });
  });
});
