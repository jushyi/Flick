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
  limit,
  getDocs,
  writeBatch,
} from '@react-native-firebase/firestore';
import logger from '../../utils/logger';
import { secureStorage, STORAGE_KEYS } from '../secureStorageService';
import { withTrace } from './performanceService';

const db = getFirestore();

/**
 * Configure how notifications are displayed when app is in foreground
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // Suppress system banner — custom InAppNotificationBanner used instead
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
    logger.info('Got notification token', {
      tokenPrefix: token.substring(0, 25) + '...',
      projectId: projectId || 'none',
    });
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
  return withTrace('notif/register_token', async () => {
    try {
      // Check if token changed from what we have locally (detects bundle ID switches, reinstalls)
      const previousToken = await secureStorage.getItem(STORAGE_KEYS.FCM_TOKEN);
      const tokenChanged = previousToken && previousToken !== token;

      if (tokenChanged) {
        logger.warn('Notification token CHANGED - replacing stale token', {
          userId,
          oldTokenPrefix: previousToken.substring(0, 25) + '...',
          newTokenPrefix: token.substring(0, 25) + '...',
        });
      }

      // Use React Native Firebase Firestore directly (shares auth state with RN Firebase Auth)
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        fcmToken: token,
        updatedAt: serverTimestamp(),
      });

      logger.info('Notification token stored in Firestore', {
        userId,
        tokenPrefix: token.substring(0, 25) + '...',
        wasRefreshed: tokenChanged,
      });

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
  });
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
 * Returns structured banner data for the InAppNotificationBanner component
 * @param {object} notification - Notification object from expo-notifications
 * @returns {{success: boolean, data?: object, error?: string}} Banner data with title, body, avatarUrl, notificationType, notificationData
 */
export const handleNotificationReceived = notification => {
  try {
    const { title, body, data } = notification.request.content;
    const { senderProfilePhotoURL, senderName, type } = data || {};

    logger.debug('Notification received in foreground', { title, body, type });

    return {
      success: true,
      data: {
        title: title || senderName || 'New notification',
        body: body || '',
        avatarUrl: senderProfilePhotoURL || null,
        notificationType: type,
        notificationData: data || {},
      },
    };
  } catch (error) {
    logger.error('Error handling notification received', error);
    return { success: false, error: error.message };
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
    const {
      type,
      photoId,
      friendshipId,
      userId,
      taggerId,
      commentId,
      conversationId,
      senderId,
      senderName,
      senderProfilePhotoURL,
    } = data || {};

    logger.debug('Notification tapped', {
      type,
      photoId,
      friendshipId,
      userId,
      taggerId,
      commentId,
      conversationId,
    });

    // Return navigation data based on notification type
    // The actual navigation will be handled by App.js using this data
    switch (type) {
      case 'photo_reveal':
        // Opens darkroom via Camera tab - simple deep link to view ready photos
        return {
          success: true,
          data: {
            type: 'photo_reveal',
            screen: 'Camera',
            params: {
              openDarkroom: true,
            },
          },
        };

      case 'friend_request':
        return {
          success: true,
          data: {
            type: 'friend_request',
            screen: 'FriendsList',
            params: { friendshipId },
          },
        };

      case 'friend_accepted':
        return {
          success: true,
          data: {
            type: 'friend_accepted',
            screen: 'OtherUserProfile',
            params: { userId },
          },
        };

      case 'reaction':
        return {
          success: true,
          data: {
            type: 'reaction',
            screen: 'Activity',
            params: {
              photoId,
              shouldOpenPhoto: true,
              notifType: 'reaction',
            },
          },
        };

      case 'comment':
        return {
          success: true,
          data: {
            type: 'comment',
            screen: 'Activity',
            params: {
              photoId,
              commentId,
              shouldOpenPhoto: true,
              notifType: 'comment',
            },
          },
        };

      case 'mention':
        return {
          success: true,
          data: {
            type: 'mention',
            screen: 'Activity',
            params: {
              photoId,
              commentId,
              shouldOpenPhoto: true,
              notifType: 'mention',
            },
          },
        };

      case 'reply':
        return {
          success: true,
          data: {
            type: 'reply',
            screen: 'Activity',
            params: {
              photoId,
              commentId,
              shouldOpenPhoto: true,
              notifType: 'reply',
            },
          },
        };

      case 'tagged':
        // Navigate to Activity screen for tag notifications
        return {
          success: true,
          data: {
            type: 'tagged',
            screen: 'Activity',
            params: {
              photoId,
              shouldOpenPhoto: true,
              notifType: 'tagged',
            },
          },
        };

      case 'direct_message':
        return {
          success: true,
          data: {
            type: 'direct_message',
            screen: 'Conversation',
            params: {
              conversationId: conversationId,
              friendId: senderId,
              friendProfile: {
                uid: senderId,
                displayName: senderName || 'Unknown',
                photoURL: senderProfilePhotoURL || null,
              },
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
 * Mark notification permission onboarding step as completed
 * @param {string} userId - User ID
 * @param {boolean} completed - Whether step is completed (default: true)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const markNotificationPermissionCompleted = async (userId, completed = true) => {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid user ID' };
    }

    logger.debug('notificationService.markNotificationPermissionCompleted', {
      userId,
      completed,
    });

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      notificationPermissionCompleted: completed,
    });

    logger.info('notificationService.markNotificationPermissionCompleted: Success');
    return { success: true };
  } catch (error) {
    logger.error('notificationService.markNotificationPermissionCompleted: Error', error);
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

    // Query unread notifications in batches of 500 (Firestore writeBatch limit)
    // Loop until no unread notifications remain
    const BATCH_LIMIT = 500;
    let totalMarked = 0;

    while (true) {
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('recipientId', '==', userId),
        where('read', '==', false),
        limit(BATCH_LIMIT) // Process up to 500 per batch to stay within writeBatch limits
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        break;
      }

      const batch = writeBatch(db);
      snapshot.docs.forEach(docSnap => {
        batch.update(docSnap.ref, { read: true });
      });

      await batch.commit();
      totalMarked += snapshot.docs.length;

      // If fewer than BATCH_LIMIT returned, no more remain
      if (snapshot.docs.length < BATCH_LIMIT) {
        break;
      }
    }

    if (totalMarked === 0) {
      logger.debug('markNotificationsAsRead: No unread notifications', { userId });
    } else {
      logger.info('markNotificationsAsRead: Marked notifications as read', {
        userId,
        count: totalMarked,
      });
    }

    return { success: true, count: totalMarked };
  } catch (error) {
    logger.error('markNotificationsAsRead: Failed to mark notifications as read', {
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Mark a single notification as read
 * @param {string} notificationId - The notification document ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const markSingleNotificationAsRead = async notificationId => {
  try {
    if (!notificationId) {
      return { success: false, error: 'Invalid notification ID' };
    }

    const notifRef = doc(db, 'notifications', notificationId);
    await updateDoc(notifRef, { read: true });

    logger.debug('markSingleNotificationAsRead: Notification marked as read', {
      notificationId,
    });

    return { success: true };
  } catch (error) {
    logger.error('markSingleNotificationAsRead: Failed', {
      notificationId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Mark notifications as read based on push notification payload data.
 * Called when the user taps a system push notification or in-app banner so the
 * notification is marked read without requiring a second tap in ActivityScreen.
 *
 * @param {string} userId - The current user's UID (recipient)
 * @param {object} pushData - The push notification data payload (type, photoId, friendshipId, …)
 * @returns {Promise<{success: boolean, count?: number, error?: string}>}
 */
export const markNotificationReadFromPushData = async (userId, pushData) => {
  if (!userId || !pushData?.type) {
    return { success: false, error: 'Missing userId or type' };
  }
  try {
    const { type, photoId, friendshipId } = pushData;

    // Reuse the existing recipientId + read==false index — no new composite index needed
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return { success: true, count: 0 };

    // Filter in memory for the specific notification that was tapped
    const toMark = snapshot.docs.filter(docSnap => {
      const data = docSnap.data();
      if (data.type !== type) return false;
      if (photoId && data.photoId !== photoId) return false;
      if (friendshipId && data.friendshipId !== friendshipId) return false;
      return true;
    });

    if (toMark.length === 0) return { success: true, count: 0 };

    const batch = writeBatch(db);
    toMark.forEach(docSnap => batch.update(docSnap.ref, { read: true }));
    await batch.commit();

    logger.info('markNotificationReadFromPushData: Marked as read', { type, count: toMark.length });
    return { success: true, count: toMark.length };
  } catch (error) {
    logger.error('markNotificationReadFromPushData: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};
