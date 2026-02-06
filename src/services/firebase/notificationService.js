/**
 * Notification Service
 *
 * Handles push notification permissions, token management, and notification
 * handling. Uses Expo Push Notifications with Firebase Cloud Functions.
 *
 * Key functions:
 * - initializeNotifications: Set up notification channels
 * - requestNotificationPermission: Request iOS notification permissions
 * - getNotificationToken: Get Expo push token
 * - storeNotificationToken: Save token to Firestore and SecureStore
 * - handleNotificationTapped: Extract deep link data from tap
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  getFirestore,
  doc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
} from '@react-native-firebase/firestore';
import logger from '../../utils/logger';
import { secureStorage, STORAGE_KEYS } from '../secureStorageService';

const db = getFirestore();

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

    logger.info('Notifications initialized successfully');
    return { success: true };
  } catch (error) {
    logger.error('Error initializing notifications', error);
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
      logger.warn('Notification permission denied');
      return { success: false, error: 'Permission denied' };
    }

    logger.info('Notification permission granted');
    return { success: true };
  } catch (error) {
    logger.error('Error requesting notification permission', error);
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
      logger.info('Must use physical device for push notifications');
      return {
        success: false,
        error: 'Push notifications only work on physical devices',
      };
    }

    // Get Expo project ID from app config
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId || undefined;

    // Get Expo push token
    // For Expo Go: projectId may be undefined (works without it in some cases)
    // For development builds: projectId is required
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    const token = tokenData.data;
    logger.debug('Got notification token', { tokenPrefix: token.substring(0, 20) });
    return { success: true, data: token };
  } catch (error) {
    logger.error('Error getting notification token', error);

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
 * Store notification token in user's Firestore document and locally in SecureStore
 * @param {string} userId - User ID
 * @param {string} token - FCM/Expo push token
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const storeNotificationToken = async (userId, token) => {
  try {
    // Use React Native Firebase Firestore directly (shares auth state with RN Firebase Auth)
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      fcmToken: token,
      updatedAt: serverTimestamp(),
    });

    logger.info('Notification token stored in Firestore', { userId });

    // Also store locally in SecureStore for offline access and logout cleanup
    const localStored = await secureStorage.setItem(STORAGE_KEYS.FCM_TOKEN, token);
    if (localStored) {
      logger.info('Notification token stored in SecureStore', { userId });
    } else {
      logger.warn('Failed to store notification token in SecureStore', { userId });
    }

    return { success: true };
  } catch (error) {
    logger.error('Error storing notification token', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Get notification token from local SecureStore
 * Useful for checking if token exists without network call
 * @returns {Promise<string|null>} Token or null if not found
 */
export const getLocalNotificationToken = async () => {
  try {
    const token = await secureStorage.getItem(STORAGE_KEYS.FCM_TOKEN);
    logger.debug('getLocalNotificationToken: Retrieved token', {
      hasToken: !!token,
    });
    return token;
  } catch (error) {
    logger.error('Error getting local notification token', { error: error.message });
    return null;
  }
};

/**
 * Clear notification token from local SecureStore
 * Used during logout cleanup
 * @returns {Promise<boolean>} Success status
 */
export const clearLocalNotificationToken = async () => {
  try {
    const result = await secureStorage.deleteItem(STORAGE_KEYS.FCM_TOKEN);
    logger.debug('clearLocalNotificationToken: Token cleared', { success: result });
    return result;
  } catch (error) {
    logger.error('Error clearing local notification token', { error: error.message });
    return false;
  }
};

/**
 * Handle notification received while app is in foreground
 * @param {object} notification - Notification object from expo-notifications
 */
export const handleNotificationReceived = notification => {
  try {
    logger.debug('Notification received in foreground', {
      title: notification.request.content.title,
      body: notification.request.content.body,
      data: notification.request.content.data,
    });

    // Could add custom in-app banner here if desired
    // For MVP, expo-notifications handles the display automatically
  } catch (error) {
    logger.error('Error handling notification received', error);
  }
};

/**
 * Handle notification tap (when user taps notification)
 * Extracts deep link data and navigates to appropriate screen
 * @param {object} notification - Notification object from expo-notifications
 * @returns {object} - Navigation data {type, screen, params}
 */
export const handleNotificationTapped = notification => {
  try {
    const { data } = notification.request.content;
    const { type, photoId, friendshipId, revealAll, revealedCount, userId } = data || {};

    logger.debug('Notification tapped', {
      type,
      photoId,
      friendshipId,
      revealAll,
      revealedCount,
      userId,
    });

    // Return navigation data based on notification type
    // The actual navigation will be handled by App.js using this data
    switch (type) {
      case 'photo_reveal':
        // Include revealAll and revealedCount for auto-reveal behavior
        // Values come as strings from push notification data, convert to proper types
        return {
          success: true,
          data: {
            type: 'photo_reveal',
            screen: 'Camera',
            params: {
              openDarkroom: true,
              revealAll: revealAll === 'true' || revealAll === true,
              revealedCount: parseInt(revealedCount, 10) || 0,
            },
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

      case 'story':
        // Navigate to Feed with params to highlight the poster's story
        return {
          success: true,
          data: {
            type: 'story',
            screen: 'Feed',
            params: {
              highlightUserId: userId, // User whose story to show
              openStory: true, // Signal to auto-open their story
            },
          },
        };

      default:
        logger.warn('Unknown notification type, navigating to Feed', { type });
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
    logger.error('Error handling notification tapped', error);
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

    logger.debug('Notification permission status', { status, granted: isGranted });
    return { success: true, data: { status, granted: isGranted } };
  } catch (error) {
    logger.error('Error checking notification permissions', error);
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

    logger.debug('Test notification scheduled', { notificationId });
    return { success: true, data: notificationId };
  } catch (error) {
    logger.error('Error scheduling test notification', error);
    return { success: false, error: error.message };
  }
};

/**
 * Mark all unread notifications as read for a user
 * @param {string} userId - User ID whose notifications to mark as read
 * @returns {Promise<{success: boolean, count?: number, error?: string}>}
 */
export const markNotificationsAsRead = async userId => {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid user ID' };
    }

    // Query all unread notifications for this user
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientId', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      logger.debug('markNotificationsAsRead: No unread notifications', { userId });
      return { success: true, count: 0 };
    }

    // Batch update all unread notifications
    const batch = writeBatch(db);
    snapshot.docs.forEach(docSnap => {
      batch.update(docSnap.ref, { read: true });
    });

    await batch.commit();

    logger.info('markNotificationsAsRead: Marked notifications as read', {
      userId,
      count: snapshot.docs.length,
    });

    return { success: true, count: snapshot.docs.length };
  } catch (error) {
    logger.error('markNotificationsAsRead: Failed to mark notifications as read', {
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};
