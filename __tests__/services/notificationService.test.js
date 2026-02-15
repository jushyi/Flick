/**
 * Notification Service Unit Tests
 *
 * Tests for notification permissions, token management, notification handling,
 * and mark-as-read operations.
 */

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock performanceService - withTrace just executes the callback in dev
jest.mock('../../src/services/firebase/performanceService', () => ({
  withTrace: jest.fn((name, fn) => fn({ putMetric: jest.fn(), putAttribute: jest.fn() })),
}));

// Mock secureStorageService
const mockSecureStorageSetItem = jest.fn(() => Promise.resolve(true));
const mockSecureStorageGetItem = jest.fn(() => Promise.resolve(null));
const mockSecureStorageDeleteItem = jest.fn(() => Promise.resolve(true));

jest.mock('../../src/services/secureStorageService', () => ({
  secureStorage: {
    setItem: (...args) => mockSecureStorageSetItem(...args),
    getItem: (...args) => mockSecureStorageGetItem(...args),
    deleteItem: (...args) => mockSecureStorageDeleteItem(...args),
  },
  STORAGE_KEYS: {
    FCM_TOKEN: 'fcm_token',
  },
}));

// Mock expo-device
jest.mock('expo-device', () => ({
  isDevice: true,
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      eas: {
        projectId: 'test-project-id',
      },
    },
  },
  easConfig: {
    projectId: 'test-project-id',
  },
}));

// Mock react-native Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

// Mock expo-notifications
const mockSetNotificationHandler = jest.fn();
const mockSetNotificationChannelAsync = jest.fn(() => Promise.resolve());
const mockGetPermissionsAsync = jest.fn(() =>
  Promise.resolve({ status: 'granted', canAskAgain: true, granted: true })
);
const mockRequestPermissionsAsync = jest.fn(() =>
  Promise.resolve({ status: 'granted', canAskAgain: true, granted: true })
);
const mockGetExpoPushTokenAsync = jest.fn(() =>
  Promise.resolve({ data: 'ExponentPushToken[test-token]' })
);
const mockScheduleNotificationAsync = jest.fn(() => Promise.resolve('notification-id'));
const mockAddNotificationReceivedListener = jest.fn(() => ({ remove: jest.fn() }));
const mockAddNotificationResponseReceivedListener = jest.fn(() => ({ remove: jest.fn() }));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: mockSetNotificationHandler,
  setNotificationChannelAsync: mockSetNotificationChannelAsync,
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  getExpoPushTokenAsync: mockGetExpoPushTokenAsync,
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  addNotificationReceivedListener: mockAddNotificationReceivedListener,
  addNotificationResponseReceivedListener: mockAddNotificationResponseReceivedListener,
  AndroidImportance: { MAX: 5 },
}));

// Firestore mocks
const mockUpdateDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockWriteBatch = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn(() => Promise.resolve());
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockLimit = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (...args) => mockDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  serverTimestamp: () => ({ _serverTimestamp: true }),
  collection: (...args) => mockCollection(...args),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  limit: (...args) => mockLimit(...args),
  getDocs: (...args) => mockGetDocs(...args),
  writeBatch: () => ({
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  }),
}));

// Import service after mocks
const {
  initializeNotifications,
  requestNotificationPermission,
  getNotificationToken,
  storeNotificationToken,
  getLocalNotificationToken,
  clearLocalNotificationToken,
  handleNotificationReceived,
  handleNotificationTapped,
  checkNotificationPermissions,
  scheduleTestNotification,
  markNotificationPermissionCompleted,
  markNotificationsAsRead,
  markSingleNotificationAsRead,
} = require('../../src/services/firebase/notificationService');

describe('notificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Also reset mock implementations to clear any unconsumed mockResolvedValueOnce queues
    mockGetDocs.mockReset();
    mockDoc.mockReturnValue({ _doc: true });
    mockCollection.mockReturnValue({ _collection: true });
    mockQuery.mockReturnValue({ _query: true });
    mockBatchCommit.mockResolvedValue();
  });

  // ===========================================================================
  // initializeNotifications tests
  // ===========================================================================
  describe('initializeNotifications', () => {
    it('should initialize successfully on iOS (no channel setup)', async () => {
      const result = await initializeNotifications();

      expect(result.success).toBe(true);
      // On iOS, setNotificationChannelAsync should not be called
      expect(mockSetNotificationChannelAsync).not.toHaveBeenCalled();
    });

    it('should set up notification channel on Android', async () => {
      // Temporarily change Platform.OS to android
      const { Platform } = require('react-native');
      const originalOS = Platform.OS;
      Platform.OS = 'android';

      const result = await initializeNotifications();

      expect(result.success).toBe(true);
      expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
        'default',
        expect.objectContaining({
          name: 'default',
          importance: 5,
        })
      );

      Platform.OS = originalOS;
    });

    it('should return error when initialization fails', async () => {
      // Temporarily change Platform.OS to android to trigger channel setup
      const { Platform } = require('react-native');
      const originalOS = Platform.OS;
      Platform.OS = 'android';

      mockSetNotificationChannelAsync.mockRejectedValueOnce(new Error('Channel setup failed'));

      const result = await initializeNotifications();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Channel setup failed');

      Platform.OS = originalOS;
    });
  });

  // ===========================================================================
  // requestNotificationPermission tests
  // ===========================================================================
  describe('requestNotificationPermission', () => {
    it('should return success when permission is already granted', async () => {
      mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });

      const result = await requestNotificationPermission();

      expect(result.success).toBe(true);
      // Should not request again if already granted
      expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('should request permission when not already granted', async () => {
      mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
      mockRequestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });

      const result = await requestNotificationPermission();

      expect(result.success).toBe(true);
      expect(mockRequestPermissionsAsync).toHaveBeenCalled();
    });

    it('should return error when permission is denied', async () => {
      mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
      mockRequestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

      const result = await requestNotificationPermission();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });

    it('should return error when getPermissionsAsync fails', async () => {
      mockGetPermissionsAsync.mockRejectedValueOnce(new Error('Permission check failed'));

      const result = await requestNotificationPermission();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission check failed');
    });
  });

  // ===========================================================================
  // getNotificationToken tests
  // ===========================================================================
  describe('getNotificationToken', () => {
    it('should return token successfully on physical device', async () => {
      mockGetExpoPushTokenAsync.mockResolvedValueOnce({
        data: 'ExponentPushToken[abc123]',
      });

      const result = await getNotificationToken();

      expect(result.success).toBe(true);
      expect(result.data).toBe('ExponentPushToken[abc123]');
    });

    it('should return error on non-physical device', async () => {
      // Mock Device.isDevice as false
      jest.resetModules();

      // We can't easily reset the module-level import, but we can test the
      // error path by making getExpoPushTokenAsync fail
      mockGetExpoPushTokenAsync.mockRejectedValueOnce(new Error('Not a device'));

      const result = await getNotificationToken();

      expect(result.success).toBe(false);
    });

    it('should return error with helpful message for projectId issues', async () => {
      mockGetExpoPushTokenAsync.mockRejectedValueOnce(
        new Error('No projectId found in app config')
      );

      const result = await getNotificationToken();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Push notifications require EAS project setup. Run: eas init');
    });

    it('should return generic error for other failures', async () => {
      mockGetExpoPushTokenAsync.mockRejectedValueOnce(new Error('Some other error'));

      const result = await getNotificationToken();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Some other error');
    });
  });

  // ===========================================================================
  // storeNotificationToken tests
  // ===========================================================================
  describe('storeNotificationToken', () => {
    it('should store token in Firestore and SecureStore', async () => {
      mockUpdateDoc.mockResolvedValueOnce();
      mockSecureStorageSetItem.mockResolvedValueOnce(true);

      const result = await storeNotificationToken('user-123', 'ExponentPushToken[abc]');

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          fcmToken: 'ExponentPushToken[abc]',
        })
      );
      expect(mockSecureStorageSetItem).toHaveBeenCalledWith('fcm_token', 'ExponentPushToken[abc]');
    });

    it('should succeed even when SecureStore fails', async () => {
      mockUpdateDoc.mockResolvedValueOnce();
      mockSecureStorageSetItem.mockResolvedValueOnce(false);

      const result = await storeNotificationToken('user-123', 'ExponentPushToken[abc]');

      expect(result.success).toBe(true);
    });

    it('should return error when Firestore updateDoc fails', async () => {
      mockUpdateDoc.mockRejectedValueOnce(new Error('Firestore error'));

      const result = await storeNotificationToken('user-123', 'ExponentPushToken[abc]');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Firestore error');
    });
  });

  // ===========================================================================
  // getLocalNotificationToken tests
  // ===========================================================================
  describe('getLocalNotificationToken', () => {
    it('should return token from SecureStore', async () => {
      mockSecureStorageGetItem.mockResolvedValueOnce('ExponentPushToken[stored]');

      const token = await getLocalNotificationToken();

      expect(token).toBe('ExponentPushToken[stored]');
      expect(mockSecureStorageGetItem).toHaveBeenCalledWith('fcm_token');
    });

    it('should return null when no token stored', async () => {
      mockSecureStorageGetItem.mockResolvedValueOnce(null);

      const token = await getLocalNotificationToken();

      expect(token).toBeNull();
    });

    it('should return null when SecureStore fails', async () => {
      mockSecureStorageGetItem.mockRejectedValueOnce(new Error('SecureStore error'));

      const token = await getLocalNotificationToken();

      expect(token).toBeNull();
    });
  });

  // ===========================================================================
  // clearLocalNotificationToken tests
  // ===========================================================================
  describe('clearLocalNotificationToken', () => {
    it('should clear token from SecureStore', async () => {
      mockSecureStorageDeleteItem.mockResolvedValueOnce(true);

      const result = await clearLocalNotificationToken();

      expect(result).toBe(true);
      expect(mockSecureStorageDeleteItem).toHaveBeenCalledWith('fcm_token');
    });

    it('should return false when SecureStore delete fails', async () => {
      mockSecureStorageDeleteItem.mockRejectedValueOnce(new Error('Delete error'));

      const result = await clearLocalNotificationToken();

      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // handleNotificationReceived tests
  // ===========================================================================
  describe('handleNotificationReceived', () => {
    it('should extract banner data from notification', () => {
      const notification = {
        request: {
          content: {
            title: 'New Friend',
            body: 'John sent you a request',
            data: {
              type: 'friend_request',
              senderProfilePhotoURL: 'https://example.com/photo.jpg',
              senderName: 'John',
            },
          },
        },
      };

      const result = handleNotificationReceived(notification);

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('New Friend');
      expect(result.data.body).toBe('John sent you a request');
      expect(result.data.avatarUrl).toBe('https://example.com/photo.jpg');
      expect(result.data.notificationType).toBe('friend_request');
    });

    it('should use senderName as fallback title when title is missing', () => {
      const notification = {
        request: {
          content: {
            title: null,
            body: 'Some body',
            data: {
              senderName: 'Jane',
            },
          },
        },
      };

      const result = handleNotificationReceived(notification);

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Jane');
    });

    it('should use default title when title and senderName are missing', () => {
      const notification = {
        request: {
          content: {
            title: null,
            body: null,
            data: {},
          },
        },
      };

      const result = handleNotificationReceived(notification);

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('New notification');
      expect(result.data.body).toBe('');
      expect(result.data.avatarUrl).toBeNull();
    });

    it('should handle missing data gracefully', () => {
      const notification = {
        request: {
          content: {
            title: 'Test',
            body: 'Test body',
            data: undefined,
          },
        },
      };

      const result = handleNotificationReceived(notification);

      expect(result.success).toBe(true);
      expect(result.data.notificationData).toEqual({});
    });

    it('should return error for malformed notification', () => {
      const result = handleNotificationReceived({});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ===========================================================================
  // handleNotificationTapped tests
  // ===========================================================================
  describe('handleNotificationTapped', () => {
    it('should navigate to Camera for photo_reveal', () => {
      const notification = {
        request: {
          content: {
            data: { type: 'photo_reveal' },
          },
        },
      };

      const result = handleNotificationTapped(notification);

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('photo_reveal');
      expect(result.data.screen).toBe('Camera');
      expect(result.data.params.openDarkroom).toBe(true);
    });

    it('should navigate to FriendsList for friend_request', () => {
      const notification = {
        request: {
          content: {
            data: { type: 'friend_request', friendshipId: 'friend-123' },
          },
        },
      };

      const result = handleNotificationTapped(notification);

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('friend_request');
      expect(result.data.screen).toBe('FriendsList');
      expect(result.data.params.friendshipId).toBe('friend-123');
    });

    it('should navigate to OtherUserProfile for friend_accepted', () => {
      const notification = {
        request: {
          content: {
            data: { type: 'friend_accepted', userId: 'user-abc' },
          },
        },
      };

      const result = handleNotificationTapped(notification);

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('friend_accepted');
      expect(result.data.screen).toBe('OtherUserProfile');
      expect(result.data.params.userId).toBe('user-abc');
    });

    it('should navigate to Activity for reaction', () => {
      const notification = {
        request: {
          content: {
            data: { type: 'reaction', photoId: 'photo-123' },
          },
        },
      };

      const result = handleNotificationTapped(notification);

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('reaction');
      expect(result.data.screen).toBe('Activity');
      expect(result.data.params.photoId).toBe('photo-123');
      expect(result.data.params.shouldOpenPhoto).toBe(true);
    });

    it('should navigate to Activity for comment', () => {
      const notification = {
        request: {
          content: {
            data: { type: 'comment', photoId: 'photo-456' },
          },
        },
      };

      const result = handleNotificationTapped(notification);

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('comment');
      expect(result.data.screen).toBe('Activity');
      expect(result.data.params.photoId).toBe('photo-456');
      expect(result.data.params.shouldOpenPhoto).toBe(true);
    });

    it('should navigate to Activity for mention', () => {
      const notification = {
        request: {
          content: {
            data: { type: 'mention', photoId: 'photo-789' },
          },
        },
      };

      const result = handleNotificationTapped(notification);

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('mention');
      expect(result.data.screen).toBe('Activity');
      expect(result.data.params.photoId).toBe('photo-789');
      expect(result.data.params.shouldOpenPhoto).toBe(true);
    });

    it('should fall through to default for unknown story type', () => {
      const notification = {
        request: {
          content: {
            data: { type: 'story', userId: 'user-456' },
          },
        },
      };

      const result = handleNotificationTapped(notification);

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('unknown');
      expect(result.data.screen).toBe('Feed');
    });

    it('should navigate to Activity for tagged', () => {
      const notification = {
        request: {
          content: {
            data: {
              type: 'tagged',
              taggerId: 'tagger-123',
              photoId: 'photo-tagged',
            },
          },
        },
      };

      const result = handleNotificationTapped(notification);

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('tagged');
      expect(result.data.screen).toBe('Activity');
      expect(result.data.params.photoId).toBe('photo-tagged');
      expect(result.data.params.shouldOpenPhoto).toBe(true);
    });

    it('should navigate to Feed for unknown notification type', () => {
      const notification = {
        request: {
          content: {
            data: { type: 'unknown_type' },
          },
        },
      };

      const result = handleNotificationTapped(notification);

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('unknown');
      expect(result.data.screen).toBe('Feed');
    });

    it('should handle missing data gracefully', () => {
      const notification = {
        request: {
          content: {
            data: undefined,
          },
        },
      };

      const result = handleNotificationTapped(notification);

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('unknown');
      expect(result.data.screen).toBe('Feed');
    });

    it('should return error for malformed notification', () => {
      const result = handleNotificationTapped({});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ===========================================================================
  // checkNotificationPermissions tests
  // ===========================================================================
  describe('checkNotificationPermissions', () => {
    it('should return granted status', async () => {
      mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });

      const result = await checkNotificationPermissions();

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('granted');
      expect(result.data.granted).toBe(true);
    });

    it('should return denied status', async () => {
      mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

      const result = await checkNotificationPermissions();

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('denied');
      expect(result.data.granted).toBe(false);
    });

    it('should return error when check fails', async () => {
      mockGetPermissionsAsync.mockRejectedValueOnce(new Error('Check failed'));

      const result = await checkNotificationPermissions();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Check failed');
    });
  });

  // ===========================================================================
  // scheduleTestNotification tests
  // ===========================================================================
  describe('scheduleTestNotification', () => {
    it('should schedule notification and return id', async () => {
      mockScheduleNotificationAsync.mockResolvedValueOnce('notif-id-123');

      const result = await scheduleTestNotification('Test Title', 'Test Body', 10);

      expect(result.success).toBe(true);
      expect(result.data).toBe('notif-id-123');
      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Test Title',
            body: 'Test Body',
            data: { type: 'test' },
          }),
          trigger: { seconds: 10 },
        })
      );
    });

    it('should use default 5 seconds when seconds not provided', async () => {
      mockScheduleNotificationAsync.mockResolvedValueOnce('notif-id-456');

      const result = await scheduleTestNotification('Title', 'Body');

      expect(result.success).toBe(true);
      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: { seconds: 5 },
        })
      );
    });

    it('should return error when scheduling fails', async () => {
      mockScheduleNotificationAsync.mockRejectedValueOnce(new Error('Schedule failed'));

      const result = await scheduleTestNotification('Title', 'Body');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Schedule failed');
    });
  });

  // ===========================================================================
  // markNotificationPermissionCompleted tests
  // ===========================================================================
  describe('markNotificationPermissionCompleted', () => {
    it('should mark permission step as completed', async () => {
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await markNotificationPermissionCompleted('user-123');

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          notificationPermissionCompleted: true,
        })
      );
    });

    it('should mark permission step as not completed', async () => {
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await markNotificationPermissionCompleted('user-123', false);

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          notificationPermissionCompleted: false,
        })
      );
    });

    it('should return error when userId is empty', async () => {
      const result = await markNotificationPermissionCompleted('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user ID');
    });

    it('should return error when Firestore fails', async () => {
      mockUpdateDoc.mockRejectedValueOnce(new Error('Update failed'));

      const result = await markNotificationPermissionCompleted('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  // ===========================================================================
  // markNotificationsAsRead tests
  // ===========================================================================
  describe('markNotificationsAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      const mockDocs = [
        { ref: { id: 'notif-1' } },
        { ref: { id: 'notif-2' } },
        { ref: { id: 'notif-3' } },
      ];
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: mockDocs,
      });
      // Second call returns empty (no more unread)
      mockGetDocs.mockResolvedValueOnce({
        empty: true,
        docs: [],
      });

      const result = await markNotificationsAsRead('user-123');

      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
      expect(mockBatchUpdate).toHaveBeenCalledTimes(3);
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('should return count 0 when no unread notifications', async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: true,
        docs: [],
      });

      const result = await markNotificationsAsRead('user-123');

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
    });

    it('should return error when userId is empty', async () => {
      const result = await markNotificationsAsRead('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user ID');
    });

    it('should return error when userId is null', async () => {
      const result = await markNotificationsAsRead(null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid user ID');
    });

    it('should return error when Firestore query fails', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Query failed'));

      const result = await markNotificationsAsRead('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Query failed');
    });

    it('should query with correct filters', async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: true,
        docs: [],
      });

      await markNotificationsAsRead('user-123');

      expect(mockWhere).toHaveBeenCalledWith('recipientId', '==', 'user-123');
      expect(mockWhere).toHaveBeenCalledWith('read', '==', false);
      expect(mockLimit).toHaveBeenCalledWith(500);
    });
  });

  // ===========================================================================
  // markSingleNotificationAsRead tests
  // ===========================================================================
  describe('markSingleNotificationAsRead', () => {
    it('should mark single notification as read', async () => {
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await markSingleNotificationAsRead('notif-123');

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { read: true });
    });

    it('should return error when notificationId is empty', async () => {
      const result = await markSingleNotificationAsRead('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid notification ID');
    });

    it('should return error when notificationId is null', async () => {
      const result = await markSingleNotificationAsRead(null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid notification ID');
    });

    it('should return error when Firestore updateDoc fails', async () => {
      mockUpdateDoc.mockRejectedValueOnce(new Error('Update failed'));

      const result = await markSingleNotificationAsRead('notif-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });
});
