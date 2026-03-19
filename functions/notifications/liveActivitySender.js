const admin = require('firebase-admin');
const logger = require('../logger');

/**
 * Send a push-to-start Live Activity payload via Firebase Admin SDK.
 * Requires firebase-admin v13.5+ for live_activity_token support.
 *
 * This sends directly to APNS via FCM, bypassing Expo Push Service.
 * The payload starts a new Live Activity on iOS 17.2+ devices even when
 * the app is killed.
 *
 * @param {object} params
 * @param {string} params.fcmToken - FCM registration token (from @react-native-firebase/messaging)
 * @param {string} params.pushToStartToken - Push-to-start token (from ActivityKit)
 * @param {string} params.activityId - Unique ID for the pinned snap activity
 * @param {string} params.senderName - Sender's display name
 * @param {string} params.caption - Optional caption text (empty string if none)
 * @param {string} params.conversationId - Conversation ID for deep link
 * @param {string} params.thumbnailUrl - Signed URL for thumbnail (widget fetches or NSE downloads)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendPushToStartLiveActivity({
  fcmToken,
  pushToStartToken,
  activityId,
  senderName,
  caption,
  conversationId,
  thumbnailUrl,
}) {
  const message = {
    token: fcmToken,
    apns: {
      live_activity_token: pushToStartToken,
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'liveactivity',
        'apns-topic': 'com.spoodsjs.flick.push-type.liveactivity',
      },
      payload: {
        aps: {
          timestamp: Math.floor(Date.now() / 1000),
          event: 'start',
          'content-state': {},
          'attributes-type': 'PinnedSnapAttributes',
          attributes: {
            activityId: activityId,
            senderName: senderName,
            caption: caption || '',
            deepLinkUrl: `lapse://messages/${conversationId}`,
          },
          alert: {
            title: `${senderName} pinned a snap`,
            body: caption || 'Tap to view',
          },
        },
      },
    },
  };

  try {
    logger.info('sendPushToStartLiveActivity: Sending', {
      activityId,
      senderName,
      conversationId,
      hasThumbnailUrl: !!thumbnailUrl,
      fcmTokenPrefix: fcmToken ? fcmToken.substring(0, 20) + '...' : '(missing)',
      pushToStartTokenLength: pushToStartToken ? pushToStartToken.length : 0,
    });

    const response = await admin.messaging().send(message);

    logger.info('sendPushToStartLiveActivity: Success', {
      activityId,
      messageId: response,
    });

    return { success: true, messageId: response };
  } catch (error) {
    logger.error('sendPushToStartLiveActivity: Failed', {
      activityId,
      error: error.message,
      code: error.code,
    });
    return { success: false, error: error.message };
  }
}

module.exports = { sendPushToStartLiveActivity };
