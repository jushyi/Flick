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

import logger from '../utils/logger';

// Lazy-load the native module to avoid crash on Android
let LiveActivityManager = null;
if (Platform.OS === 'ios') {
  try {
    LiveActivityManager = require('../../modules/live-activity-manager').default;
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
  if (Platform.OS !== 'ios' || !LiveActivityManager) {
    return { success: false, error: 'Not supported' };
  }

  try {
    const deepLinkUrl = `lapse://messages/${conversationId}`;

    const nativeActivityId = await LiveActivityManager.startActivity(
      activityId,
      senderName,
      caption || null,
      deepLinkUrl,
      thumbnailUri
    );

    logger.info('liveActivityService: Started pinned snap activity', {
      activityId,
      senderName,
      conversationId,
      nativeActivityId,
    });

    return { success: true, nativeActivityId };
  } catch (error) {
    logger.error('liveActivityService: Failed to start activity', {
      activityId,
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
