/**
 * Pinned Notification Service Unit Tests
 *
 * Tests for pinnedNotificationService including:
 * - dismissPinnedSnapNotification: platform guard, matching, error handling
 * - trackPinnedSnap: storage, deduplication
 * - clearPinnedSnap: removal from tracking list
 * - checkAndRedeliverPinnedSnaps: re-delivery logic, deduplication, platform guard
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

// Mock expo-notifications
const mockGetPresentedNotificationsAsync = jest.fn(() => Promise.resolve([]));
const mockDismissNotificationAsync = jest.fn(() => Promise.resolve());
const mockScheduleNotificationAsync = jest.fn(() => Promise.resolve('notif-id'));

jest.mock('expo-notifications', () => ({
  getPresentedNotificationsAsync: (...args) => mockGetPresentedNotificationsAsync(...args),
  dismissNotificationAsync: (...args) => mockDismissNotificationAsync(...args),
  scheduleNotificationAsync: (...args) => mockScheduleNotificationAsync(...args),
}));

// Mock AsyncStorage
const mockGetItem = jest.fn(() => Promise.resolve(null));
const mockSetItem = jest.fn(() => Promise.resolve());

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args) => mockGetItem(...args),
  setItem: (...args) => mockSetItem(...args),
}));

// Mock Platform — default to iOS
let mockPlatformOS = 'ios';
jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

const {
  dismissPinnedSnapNotification,
  trackPinnedSnap,
  clearPinnedSnap,
  checkAndRedeliverPinnedSnaps,
} = require('../../src/services/pinnedNotificationService');

describe('pinnedNotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformOS = 'ios';
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue();
    mockGetPresentedNotificationsAsync.mockResolvedValue([]);
    mockDismissNotificationAsync.mockResolvedValue();
    mockScheduleNotificationAsync.mockResolvedValue('notif-id');
  });

  // ============================================================================
  // dismissPinnedSnapNotification
  // ============================================================================
  describe('dismissPinnedSnapNotification', () => {
    it('returns early on Android (no API calls)', async () => {
      mockPlatformOS = 'android';

      await dismissPinnedSnapNotification('activity-123');

      expect(mockGetPresentedNotificationsAsync).not.toHaveBeenCalled();
      expect(mockDismissNotificationAsync).not.toHaveBeenCalled();
    });

    it('returns early when pinnedActivityId is null', async () => {
      await dismissPinnedSnapNotification(null);

      expect(mockGetPresentedNotificationsAsync).not.toHaveBeenCalled();
    });

    it('returns early when pinnedActivityId is undefined', async () => {
      await dismissPinnedSnapNotification(undefined);

      expect(mockGetPresentedNotificationsAsync).not.toHaveBeenCalled();
    });

    it('finds and dismisses matching notification by pinnedActivityId in data', async () => {
      const targetId = 'activity-abc';
      mockGetPresentedNotificationsAsync.mockResolvedValue([
        {
          request: {
            identifier: 'notif-1',
            content: { data: { pinnedActivityId: targetId } },
          },
        },
        {
          request: {
            identifier: 'notif-2',
            content: { data: { pinnedActivityId: 'other-id' } },
          },
        },
      ]);

      await dismissPinnedSnapNotification(targetId);

      expect(mockDismissNotificationAsync).toHaveBeenCalledTimes(1);
      expect(mockDismissNotificationAsync).toHaveBeenCalledWith('notif-1');
    });

    it('does not dismiss non-matching notifications', async () => {
      mockGetPresentedNotificationsAsync.mockResolvedValue([
        {
          request: {
            identifier: 'notif-1',
            content: { data: { pinnedActivityId: 'other-id' } },
          },
        },
      ]);

      await dismissPinnedSnapNotification('activity-xyz');

      expect(mockDismissNotificationAsync).not.toHaveBeenCalled();
    });

    it('handles empty presented notifications list gracefully', async () => {
      mockGetPresentedNotificationsAsync.mockResolvedValue([]);

      await dismissPinnedSnapNotification('activity-123');

      expect(mockDismissNotificationAsync).not.toHaveBeenCalled();
    });

    it('catches and logs errors from getPresentedNotificationsAsync', async () => {
      const mockLogger = require('../../src/utils/logger').default;
      mockGetPresentedNotificationsAsync.mockRejectedValue(new Error('API failed'));

      await dismissPinnedSnapNotification('activity-123');

      // Should not throw
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to dismiss'),
        expect.objectContaining({ pinnedActivityId: 'activity-123' })
      );
    });

    it('clears the snap from tracking after dismissal', async () => {
      mockGetPresentedNotificationsAsync.mockResolvedValue([
        {
          request: {
            identifier: 'notif-1',
            content: { data: { pinnedActivityId: 'activity-123' } },
          },
        },
      ]);

      const existingList = [
        { pinnedActivityId: 'activity-123', conversationId: 'conv-1' },
        { pinnedActivityId: 'activity-456', conversationId: 'conv-2' },
      ];
      mockGetItem.mockResolvedValue(JSON.stringify(existingList));

      await dismissPinnedSnapNotification('activity-123');

      // Should have called setItem to remove the dismissed snap
      expect(mockSetItem).toHaveBeenCalledWith(
        'pinned_snaps_active',
        expect.not.stringContaining('activity-123')
      );
    });
  });

  // ============================================================================
  // trackPinnedSnap
  // ============================================================================
  describe('trackPinnedSnap', () => {
    it('stores metadata in AsyncStorage under pinned_snaps_active key', async () => {
      mockGetItem.mockResolvedValue(null);

      await trackPinnedSnap('activity-123', {
        conversationId: 'conv-1',
        senderName: 'Alice',
        caption: 'Check this out',
        pinnedThumbnailUrl: 'https://example.com/thumb.jpg',
      });

      expect(mockSetItem).toHaveBeenCalledWith(
        'pinned_snaps_active',
        expect.stringContaining('activity-123')
      );

      const storedValue = JSON.parse(mockSetItem.mock.calls[0][1]);
      expect(storedValue).toHaveLength(1);
      expect(storedValue[0]).toMatchObject({
        pinnedActivityId: 'activity-123',
        conversationId: 'conv-1',
        senderName: 'Alice',
        caption: 'Check this out',
        pinnedThumbnailUrl: 'https://example.com/thumb.jpg',
      });
      expect(storedValue[0].trackedAt).toBeDefined();
    });

    it('deduplicates by pinnedActivityId', async () => {
      const existingList = [
        {
          pinnedActivityId: 'activity-123',
          conversationId: 'conv-1',
          senderName: 'Alice',
          caption: '',
          pinnedThumbnailUrl: '',
          trackedAt: '2026-03-05T00:00:00Z',
        },
      ];
      mockGetItem.mockResolvedValue(JSON.stringify(existingList));

      await trackPinnedSnap('activity-123', {
        conversationId: 'conv-1',
        senderName: 'Alice',
      });

      // setItem should NOT be called because it already exists
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it('returns early on Android', async () => {
      mockPlatformOS = 'android';

      await trackPinnedSnap('activity-123', { conversationId: 'conv-1' });

      expect(mockGetItem).not.toHaveBeenCalled();
      expect(mockSetItem).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // clearPinnedSnap
  // ============================================================================
  describe('clearPinnedSnap', () => {
    it('removes the specified snap from tracking list', async () => {
      const existingList = [
        { pinnedActivityId: 'activity-123', conversationId: 'conv-1' },
        { pinnedActivityId: 'activity-456', conversationId: 'conv-2' },
      ];
      mockGetItem.mockResolvedValue(JSON.stringify(existingList));

      await clearPinnedSnap('activity-123');

      expect(mockSetItem).toHaveBeenCalledTimes(1);
      const storedValue = JSON.parse(mockSetItem.mock.calls[0][1]);
      expect(storedValue).toHaveLength(1);
      expect(storedValue[0].pinnedActivityId).toBe('activity-456');
    });

    it('handles empty storage gracefully', async () => {
      mockGetItem.mockResolvedValue(null);

      await clearPinnedSnap('activity-123');

      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it('returns early on Android', async () => {
      mockPlatformOS = 'android';

      await clearPinnedSnap('activity-123');

      expect(mockGetItem).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // checkAndRedeliverPinnedSnaps
  // ============================================================================
  describe('checkAndRedeliverPinnedSnaps', () => {
    it('schedules local notification for tracked snaps missing from presented list', async () => {
      const trackedSnaps = [
        {
          pinnedActivityId: 'activity-123',
          conversationId: 'conv-1',
          senderName: 'Alice',
          caption: 'Look at this!',
          pinnedThumbnailUrl: '',
          trackedAt: '2026-03-05T00:00:00Z',
        },
      ];
      mockGetItem.mockResolvedValue(JSON.stringify(trackedSnaps));
      mockGetPresentedNotificationsAsync.mockResolvedValue([]); // No notifications presented

      await checkAndRedeliverPinnedSnaps();

      expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Alice',
          body: 'Look at this!',
          data: {
            type: 'snap',
            conversationId: 'conv-1',
            pinnedActivityId: 'activity-123',
            pinned: 'true',
          },
        },
        trigger: null,
      });
    });

    it('does NOT re-deliver snaps that are already presented', async () => {
      const trackedSnaps = [
        {
          pinnedActivityId: 'activity-123',
          conversationId: 'conv-1',
          senderName: 'Alice',
          caption: '',
          pinnedThumbnailUrl: '',
          trackedAt: '2026-03-05T00:00:00Z',
        },
      ];
      mockGetItem.mockResolvedValue(JSON.stringify(trackedSnaps));
      mockGetPresentedNotificationsAsync.mockResolvedValue([
        {
          request: {
            identifier: 'notif-1',
            content: { data: { pinnedActivityId: 'activity-123' } },
          },
        },
      ]);

      await checkAndRedeliverPinnedSnaps();

      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('returns early on Android', async () => {
      mockPlatformOS = 'android';

      await checkAndRedeliverPinnedSnaps();

      expect(mockGetItem).not.toHaveBeenCalled();
      expect(mockGetPresentedNotificationsAsync).not.toHaveBeenCalled();
    });

    it('handles empty tracking list gracefully', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify([]));

      await checkAndRedeliverPinnedSnaps();

      expect(mockGetPresentedNotificationsAsync).not.toHaveBeenCalled();
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('handles null storage value gracefully', async () => {
      mockGetItem.mockResolvedValue(null);

      await checkAndRedeliverPinnedSnaps();

      expect(mockGetPresentedNotificationsAsync).not.toHaveBeenCalled();
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('only re-delivers missing snaps, not ones still presented', async () => {
      const trackedSnaps = [
        {
          pinnedActivityId: 'activity-111',
          conversationId: 'conv-1',
          senderName: 'Alice',
          caption: '',
          trackedAt: '2026-03-05T00:00:00Z',
        },
        {
          pinnedActivityId: 'activity-222',
          conversationId: 'conv-2',
          senderName: 'Bob',
          caption: 'Hey',
          trackedAt: '2026-03-05T00:00:00Z',
        },
      ];
      mockGetItem.mockResolvedValue(JSON.stringify(trackedSnaps));
      mockGetPresentedNotificationsAsync.mockResolvedValue([
        {
          request: {
            identifier: 'notif-1',
            content: { data: { pinnedActivityId: 'activity-111' } },
          },
        },
      ]);

      await checkAndRedeliverPinnedSnaps();

      // Only activity-222 should be re-delivered (activity-111 is still presented)
      expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Bob',
            data: expect.objectContaining({
              pinnedActivityId: 'activity-222',
            }),
          }),
        })
      );
    });
  });
});
