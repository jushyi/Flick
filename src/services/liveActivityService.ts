/**
 * Live Activity Service
 *
 * JS bridge to the native LiveActivityManager Expo module.
 * Provides functions to start, end, and manage pinned snap Live Activities
 * on the iOS lock screen.
 *
 * iOS-only: All functions return safe fallback values on Android.
 * Uses Platform guard and lazy native module loading to avoid crashes.
 */

import { Platform } from 'react-native';

import { NativeModulesProxy, EventEmitter } from 'expo-modules-core';
import messaging from '@react-native-firebase/messaging';

import { supabase } from '../lib/supabase';
import logger from '../utils/logger';

// Lazy-load the native module to avoid crash on Android
let LiveActivityManager = null;
if (Platform.OS === 'ios') {
  try {
    LiveActivityManager = require('../../modules/live-activity-manager');
  } catch (e) {
    logger.warn('liveActivityService: Native module not available', { error: e.message });
  }
}

/**
 * Start a pinned snap Live Activity on the recipient's iOS lock screen.
 *
 * @param {Object} params
 * @param {string} params.activityId - Unique ID for this activity (usually the snap ID)
 * @param {string} params.senderName - Display name of the sender
 * @param {string|null} params.caption - Optional caption text
 * @param {string} params.conversationId - Conversation ID for deep link
 * @param {string} params.friendId - Recipient user ID (unused here, for caller context)
 * @param {string} params.thumbnailUri - Local file URI of the compressed thumbnail image
 * @returns {Promise<{success: boolean, nativeActivityId?: string|null, error?: string}>}
 */
export const startPinnedSnapActivity = async ({
  activityId,
  senderName,
  caption,
  conversationId,
  friendId,
  thumbnailUri,
}) => {
  logger.info('liveActivityService: DEBUG module check', {
    hasManager: !!LiveActivityManager,
    managerKeys: LiveActivityManager ? Object.keys(LiveActivityManager) : [],
    hasStartActivity: LiveActivityManager ? typeof LiveActivityManager.startActivity : 'N/A',
  });

  if (Platform.OS !== 'ios' || !LiveActivityManager) {
    logger.error('liveActivityService: NOT SUPPORTED', {
      platform: Platform.OS,
      hasManager: !!LiveActivityManager,
    });
    return { success: false, error: 'Not supported' };
  }

  try {
    const deepLinkUrl = `lapse://messages/${conversationId}`;

    logger.info('liveActivityService: Calling native startActivity', {
      activityId,
      senderName,
      deepLinkUrl,
      thumbnailUri: thumbnailUri ? 'present' : 'empty',
    });

    const nativeActivityId = await LiveActivityManager.startActivity(
      activityId,
      senderName,
      caption || null,
      deepLinkUrl,
      thumbnailUri
    );

    logger.info('liveActivityService: Native returned', {
      activityId,
      nativeActivityId,
      type: typeof nativeActivityId,
    });

    return { success: true, nativeActivityId };
  } catch (error) {
    logger.error('liveActivityService: NATIVE THREW ERROR', {
      activityId,
      error: error.message,
      code: error.code,
      full: String(error),
    });
    return { success: false, error: error.message };
  }
};

/**
 * Remove a single pinned snap from the stacked Live Activity.
 * If this was the last entry in the stack, the Live Activity ends.
 *
 * @param {string} snapActivityId - The snap message ID to remove
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const removePinnedSnap = async snapActivityId => {
  if (Platform.OS !== 'ios' || !LiveActivityManager) {
    return { success: false, error: 'Not supported' };
  }

  try {
    await LiveActivityManager.removeFromStack(snapActivityId);

    logger.info('liveActivityService: Removed snap from stack', { snapActivityId });

    return { success: true };
  } catch (error) {
    logger.error('liveActivityService: Failed to remove snap from stack', {
      snapActivityId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * End a specific pinned snap Live Activity.
 *
 * @param {string} activityId - The activity ID used when starting
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const endPinnedSnapActivity = async activityId => {
  if (Platform.OS !== 'ios' || !LiveActivityManager) {
    return { success: false, error: 'Not supported' };
  }

  try {
    await LiveActivityManager.endActivity(activityId);

    logger.info('liveActivityService: Ended pinned snap activity', { activityId });

    return { success: true };
  } catch (error) {
    logger.error('liveActivityService: Failed to end activity', {
      activityId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * End all active pinned snap Live Activities.
 *
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const endAllPinnedActivities = async () => {
  if (Platform.OS !== 'ios' || !LiveActivityManager) {
    return { success: false, error: 'Not supported' };
  }

  try {
    await LiveActivityManager.endAllActivities();

    logger.info('liveActivityService: Ended all pinned snap activities');

    return { success: true };
  } catch (error) {
    logger.error('liveActivityService: Failed to end all activities', {
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Get the activityId values of all currently running pinned snap Live Activities.
 * Used by the foreground-resume fallback to check which pinned snaps already have activities.
 *
 * @returns {Promise<string[]>} Array of activityId strings (snap IDs)
 */
export const getActiveActivityIds = async () => {
  if (Platform.OS !== 'ios' || !LiveActivityManager) {
    return [];
  }

  try {
    const ids = await LiveActivityManager.getActiveActivityIds();
    return ids || [];
  } catch (error) {
    logger.warn('liveActivityService: Failed to get active activity IDs', {
      error: error.message,
    });
    return [];
  }
};

/**
 * Get the FCM registration token (different from Expo push token).
 * Required by Firebase Admin SDK for push-to-start delivery.
 * @returns {Promise<string|null>} FCM registration token or null
 */
export const getFCMRegistrationToken = async () => {
  if (Platform.OS !== 'ios') return null;
  try {
    // Ensure notification permission is granted before requesting token
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    if (!enabled) return null;

    const fcmToken = await messaging().getToken();
    return fcmToken;
  } catch (error) {
    logger.warn('liveActivityService: Failed to get FCM token', { error: error.message });
    return null;
  }
};

/**
 * Start observing push-to-start token updates and store tokens in Firestore.
 * Call on authenticated app startup (iOS only).
 * Stores both pushToStartToken and fcmRegistrationToken in user document.
 *
 * @param {string} userId - Authenticated user's UID
 * @returns {object|null} Event subscription (call .remove() to unsubscribe)
 */
export const registerPushToStartToken = async userId => {
  if (Platform.OS !== 'ios' || !LiveActivityManager) {
    return null;
  }

  try {
    // Get and store FCM registration token in Supabase
    const fcmToken = await getFCMRegistrationToken();
    if (fcmToken) {
      const { error: fcmError } = await supabase
        .from('users')
        .update({ fcm_registration_token: fcmToken })
        .eq('id', userId);
      if (fcmError) {
        logger.error('liveActivityService: Failed to store FCM registration token', {
          error: fcmError.message,
        });
      } else {
        logger.info('liveActivityService: Stored FCM registration token', { userId });
      }
    }

    // Start observing push-to-start token (native side stores it)
    await LiveActivityManager.observePushToStartToken();

    // Try to get token immediately (may already be available)
    await _pollAndStorePushToStartToken(userId);

    // Also keep the event listener as backup
    const emitter = new EventEmitter(NativeModulesProxy.LiveActivityManager);
    const subscription = emitter.addListener('onPushToStartToken', async event => {
      logger.info('liveActivityService: onPushToStartToken EVENT RECEIVED', {
        tokenLength: event.token?.length,
      });
      try {
        const { error: tokenError } = await supabase
          .from('users')
          .update({ push_to_start_token: event.token })
          .eq('id', userId);
        if (tokenError) {
          logger.error('liveActivityService: Failed to store push-to-start token', {
            error: tokenError.message,
          });
        } else {
          logger.info('liveActivityService: Stored push-to-start token via event');
        }
      } catch (error) {
        logger.error('liveActivityService: Failed to store push-to-start token', {
          error: error.message,
        });
      }
    });

    return subscription;
  } catch (error) {
    logger.error('liveActivityService: Push-to-start registration FAILED', {
      error: error.message,
    });
    return null;
  }
};

/**
 * Poll the native module for the push-to-start token and store in Firestore.
 * Retries a few times since the token may arrive shortly after observation starts.
 */
const _pollAndStorePushToStartToken = async userId => {
  for (let i = 0; i < 5; i++) {
    const token = await LiveActivityManager.getPushToStartToken();
    if (token) {
      logger.info('liveActivityService: Got push-to-start token via poll', {
        attempt: i + 1,
        tokenLength: token.length,
      });
      const { error: pollError } = await supabase
        .from('users')
        .update({ push_to_start_token: token })
        .eq('id', userId);
      if (pollError) {
        logger.error('liveActivityService: Failed to store push-to-start token via poll', {
          error: pollError.message,
        });
      } else {
        logger.info('liveActivityService: Stored push-to-start token in Supabase');
      }
      return;
    }
    // Wait 2 seconds between polls
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  logger.info('liveActivityService: No push-to-start token after 5 polls (10s)');
};
