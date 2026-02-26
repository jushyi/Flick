/**
 * Live Activity Service — JS bridge to native LiveActivityManager module
 *
 * Provides functions to start, end, and manage Live Activities for pinned snaps.
 * iOS-only: all functions are no-ops on Android (return { success: false } or do nothing).
 * The native module is lazy-loaded to avoid crashes on Android.
 *
 * Deep link URL pattern: lapse://messages/{conversationId}
 * This matches the existing navigation config in AppNavigator (messages/:conversationId).
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
 * Start a Live Activity for a pinned snap on the recipient's lock screen.
 *
 * @param {Object} params
 * @param {string} params.activityId - Unique identifier (usually the snap message ID)
 * @param {string} params.senderName - Display name of the sender
 * @param {string|null} params.caption - Optional caption text
 * @param {string} params.conversationId - Conversation document ID (for deep link)
 * @param {string} params.friendId - Recipient user ID
 * @param {string} params.thumbnailUri - Local file URI for the snap thumbnail
 * @returns {Promise<{success: boolean, nativeActivityId?: string, error?: string}>}
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
    // Deep link URL matching existing conversation navigation pattern
    const deepLinkUrl = `lapse://messages/${conversationId}`;

    const nativeActivityId = await LiveActivityManager.startActivity(
      activityId,
      senderName,
      caption || null,
      deepLinkUrl,
      thumbnailUri
    );

    logger.info('liveActivityService: Activity started', {
      activityId,
      nativeActivityId,
      conversationId,
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
 * End a specific Live Activity by its activity ID.
 *
 * @param {string} activityId - The activity ID used when starting the activity
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const endPinnedSnapActivity = async activityId => {
  if (Platform.OS !== 'ios' || !LiveActivityManager) {
    return { success: false, error: 'Not supported' };
  }

  try {
    await LiveActivityManager.endActivity(activityId);
    logger.info('liveActivityService: Activity ended', { activityId });
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
    logger.info('liveActivityService: All activities ended');
    return { success: true };
  } catch (error) {
    logger.error('liveActivityService: Failed to end all activities', {
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};
