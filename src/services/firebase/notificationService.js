import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { updateUserDocument } from './firestoreService';

/**
 * Configure how notifications are displayed when app is in foreground
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Initialize notification system
 * Sets up notification channel for Android and configures handlers
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const initializeNotifications = async () => {
  try {
    // Configure Android notification channel (iOS handles this automatically)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#000000',
      });
    }

    console.log('Notifications initialized successfully');
    return { success: true };
  } catch (error) {
    console.error('Error initializing notifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Request notification permissions from user
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const requestNotificationPermission = async () => {
  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // If not already granted, request permissions
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permission denied');
      return { success: false, error: 'Permission denied' };
    }

    console.log('Notification permission granted');
    return { success: true };
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get FCM/Expo push notification token for this device
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
export const getNotificationToken = async () => {
  try {
    // Check if running on physical device (required for push notifications)
    if (!Device.isDevice) {
      console.log('Must use physical device for push notifications');
      return {
        success: false,
        error: 'Push notifications only work on physical devices',
      };
    }

    // Get Expo project ID from app config
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId ||
      undefined;

    // Get Expo push token
    // For Expo Go: projectId may be undefined (works without it in some cases)
    // For development builds: projectId is required
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    const token = tokenData.data;
    console.log('Got notification token:', token.substring(0, 20) + '...');
    return { success: true, data: token };
  } catch (error) {
    console.error('Error getting notification token:', error);

    // If error is about missing projectId, provide helpful message
    if (error.message?.includes('projectId')) {
      return {
        success: false,
        error: 'Push notifications require EAS project setup. Run: eas init',
      };
    }

    return { success: false, error: error.message };
  }
};

/**
 * Store notification token in user's Firestore document
 * @param {string} userId - User ID
 * @param {string} token - FCM/Expo push token
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const storeNotificationToken = async (userId, token) => {
  try {
    const result = await updateUserDocument(userId, { fcmToken: token });

    if (result.success) {
      console.log('Notification token stored for user:', userId);
      return { success: true };
    } else {
      console.error('Failed to store notification token:', result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Error storing notification token:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Handle notification received while app is in foreground
 * @param {object} notification - Notification object from expo-notifications
 */
export const handleNotificationReceived = (notification) => {
  try {
    console.log('Notification received in foreground:', notification);

    const { title, body, data } = notification.request.content;
    console.log('Title:', title);
    console.log('Body:', body);
    console.log('Data:', data);

    // Could add custom in-app banner here if desired
    // For MVP, expo-notifications handles the display automatically
  } catch (error) {
    console.error('Error handling notification received:', error);
  }
};

/**
 * Handle notification tap (when user taps notification)
 * Extracts deep link data and navigates to appropriate screen
 * @param {object} notification - Notification object from expo-notifications
 * @returns {object} - Navigation data {type, screen, params}
 */
export const handleNotificationTapped = (notification) => {
  try {
    console.log('Notification tapped:', notification);

    const { data } = notification.request.content;
    const { type, photoId, friendshipId } = data || {};

    console.log('Notification type:', type);

    // Return navigation data based on notification type
    // The actual navigation will be handled by App.js using this data
    switch (type) {
      case 'photo_reveal':
        return {
          success: true,
          data: {
            type: 'photo_reveal',
            screen: 'Darkroom',
            params: {},
          },
        };

      case 'friend_request':
        return {
          success: true,
          data: {
            type: 'friend_request',
            screen: 'FriendRequests',
            params: { friendshipId },
          },
        };

      case 'reaction':
        return {
          success: true,
          data: {
            type: 'reaction',
            screen: 'Feed',
            params: { photoId },
          },
        };

      default:
        console.log('Unknown notification type, navigating to Feed');
        return {
          success: true,
          data: {
            type: 'unknown',
            screen: 'Feed',
            params: {},
          },
        };
    }
  } catch (error) {
    console.error('Error handling notification tapped:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if notification permissions are granted
 * @returns {Promise<{success: boolean, data?: {status: string, granted: boolean}, error?: string}>}
 */
export const checkNotificationPermissions = async () => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    const isGranted = status === 'granted';

    console.log('Notification permission status:', status, 'granted:', isGranted);
    return { success: true, data: { status, granted: isGranted } };
  } catch (error) {
    console.error('Error checking notification permissions:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Schedule a local notification (for testing purposes)
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {number} seconds - Seconds from now to trigger notification
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
export const scheduleTestNotification = async (title, body, seconds = 5) => {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        data: { type: 'test' },
      },
      trigger: { seconds },
    });

    console.log('Test notification scheduled:', notificationId);
    return { success: true, data: notificationId };
  } catch (error) {
    console.error('Error scheduling test notification:', error);
    return { success: false, error: error.message };
  }
};
