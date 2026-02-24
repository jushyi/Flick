const { Expo } = require('expo-server-sdk');
const logger = require('../logger');
const { storePendingReceipt } = require('./receipts');

// Initialize Expo client with optional access token from env
// Access token enables higher rate limits for production apps
const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
});

/**
 * Send a push notification to a single device via Expo Push Service
 * Uses expo-server-sdk for automatic rate limiting and retry logic
 *
 * @param {string} token - User's Expo Push Token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data payload for deep linking
 * @param {string|null} userId - User ID for receipt tracking (optional, enables token cleanup)
 * @returns {Promise<object>} - { success, tickets } or { success: false, error }
 */
async function sendPushNotification(token, title, body, data = {}, userId = null) {
  try {
    // Validate token format using SDK helper
    if (!Expo.isExpoPushToken(token)) {
      logger.error('sendPushNotification: Invalid Expo Push Token', { token });
      return { success: false, error: 'Invalid token format' };
    }

    // Create message with proper structure
    const message = {
      to: token,
      sound: 'default',
      title: title,
      body: body,
      data: data,
      priority: 'high',
      channelId: 'default',
    };

    // Send notification via Expo Push Service
    // sendPushNotificationsAsync handles rate limiting automatically
    const tickets = await expo.sendPushNotificationsAsync([message]);

    // Log ticket result at info level for production visibility
    const ticket = tickets.length > 0 ? tickets[0] : null;
    if (ticket && ticket.status === 'ok') {
      logger.info('sendPushNotification: Ticket OK', {
        userId,
        tokenPrefix: token.substring(0, 30) + '...',
        ticketId: ticket.id,
        type: data.type || 'unknown',
      });
    } else if (ticket && ticket.status === 'error') {
      logger.warn('sendPushNotification: Ticket ERROR', {
        userId,
        tokenPrefix: token.substring(0, 30) + '...',
        status: ticket.status,
        message: ticket.message,
        details: ticket.details,
        type: data.type || 'unknown',
      });
    } else {
      logger.warn('sendPushNotification: Unexpected ticket response', {
        userId,
        tokenPrefix: token.substring(0, 30) + '...',
        tickets,
      });
    }

    // Store pending receipt for later checking (if userId provided)
    // Only store if ticket has id and status is 'ok'
    if (userId && ticket) {
      if (ticket.status === 'ok' && ticket.id) {
        // Fire and forget - don't block on receipt storage
        storePendingReceipt(ticket.id, userId, token).catch(() => {
          // Errors already logged in storePendingReceipt
        });
      }
    }

    return { success: true, tickets };
  } catch (error) {
    logger.error('sendPushNotification: Error sending notification', {
      error: error.message,
    });
    return { success: false, error: error.message };
  }
}

/**
 * Send push notifications to multiple devices in batches
 * Uses expo-server-sdk chunking for optimal batch sizes
 *
 * @param {Array<object>} messages - Array of message objects with { to, title, body, data }
 * @returns {Promise<Array>} - Array of tickets from all chunks
 */
async function sendBatchNotifications(messages) {
  try {
    // Filter out messages with invalid tokens
    const validMessages = messages.filter(msg => {
      if (!Expo.isExpoPushToken(msg.to)) {
        logger.warn('sendBatchNotifications: Skipping invalid token', {
          token: msg.to,
        });
        return false;
      }
      return true;
    });

    if (validMessages.length === 0) {
      logger.warn('sendBatchNotifications: No valid tokens to send');
      return [];
    }

    // Add default properties to each message
    const fullMessages = validMessages.map(msg => ({
      ...msg,
      sound: msg.sound || 'default',
      priority: msg.priority || 'high',
      channelId: msg.channelId || 'default',
    }));

    // Use SDK's chunking for proper batch sizes (max 100 per chunk)
    const chunks = expo.chunkPushNotifications(fullMessages);
    const allTickets = [];

    logger.info('sendBatchNotifications: Sending batches', {
      totalMessages: validMessages.length,
      chunks: chunks.length,
    });

    // Send each chunk
    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        allTickets.push(...tickets);
      } catch (chunkError) {
        logger.error('sendBatchNotifications: Chunk send failed', {
          error: chunkError.message,
        });
        // Continue with other chunks even if one fails
      }
    }

    logger.debug('sendBatchNotifications: All batches sent', {
      totalTickets: allTickets.length,
    });

    return allTickets;
  } catch (error) {
    logger.error('sendBatchNotifications: Error', { error: error.message });
    return [];
  }
}

module.exports = {
  sendPushNotification,
  sendBatchNotifications,
  expo, // Export for testing/advanced usage
};
