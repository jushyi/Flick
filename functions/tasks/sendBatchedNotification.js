const admin = require('firebase-admin');
const logger = require('../logger');

/**
 * Cloud Task HTTP handler for sending batched reaction notifications
 * Called by Cloud Tasks after 30-second delay to send accumulated reactions
 *
 * Idempotent: Safe to retry if task fails
 * Uses transaction to ensure only one send per batch
 *
 * @param {Object} req - HTTP request with { batchId } in body
 * @param {Object} res - HTTP response object
 */
async function sendBatchedNotificationHandler(req, res) {
  try {
    const { batchId } = req.body;

    if (!batchId) {
      logger.warn('sendBatchedNotificationHandler: Missing batchId in request');
      return res.status(400).json({ error: 'Missing batchId' });
    }

    logger.debug('sendBatchedNotificationHandler: Processing batch', { batchId });

    const db = admin.firestore();
    const batchRef = db.collection('reactionBatches').doc(batchId);

    let batchData = null;

    // Use transaction to mark batch as processing and prevent duplicate sends
    await db.runTransaction(async transaction => {
      const batchDoc = await transaction.get(batchRef);

      if (!batchDoc.exists) {
        logger.debug('sendBatchedNotificationHandler: Batch not found (already sent or deleted)', {
          batchId,
        });
        // Not an error - batch may have been cleaned up
        return;
      }

      const data = batchDoc.data();

      if (data.status === 'sent') {
        logger.debug('sendBatchedNotificationHandler: Batch already sent (idempotency)', {
          batchId,
        });
        // Already sent - idempotent behavior
        return;
      }

      if (data.status === 'processing') {
        logger.debug('sendBatchedNotificationHandler: Batch currently processing (retry)', {
          batchId,
        });
        // Another instance is processing - let it handle
        return;
      }

      // Mark as processing
      transaction.update(batchRef, {
        status: 'processing',
        processingAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      batchData = data;
    });

    // If batchData is null, transaction returned early (already sent or processing)
    if (!batchData) {
      logger.debug('sendBatchedNotificationHandler: Batch already handled', { batchId });
      return res.status(200).json({ message: 'Batch already handled' });
    }

    // Fetch photo owner data (at send time, not batch creation time)
    const { photoId, reactorId, reactions } = batchData;

    logger.debug('sendBatchedNotificationHandler: Fetching photo and user data', {
      batchId,
      photoId,
      reactorId,
    });

    // Get photo to find owner
    const photoDoc = await db.collection('photos').doc(photoId).get();

    if (!photoDoc.exists) {
      logger.warn('sendBatchedNotificationHandler: Photo not found', { batchId, photoId });
      // Mark as sent to prevent retry
      await batchRef.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        error: 'Photo not found',
      });
      return res.status(200).json({ message: 'Photo not found' });
    }

    const photoData = photoDoc.data();
    const photoOwnerId = photoData.userId;

    // Get photo owner's FCM token and preferences
    const ownerDoc = await db.collection('users').doc(photoOwnerId).get();

    if (!ownerDoc.exists) {
      logger.warn('sendBatchedNotificationHandler: Photo owner not found', {
        batchId,
        photoOwnerId,
      });
      // Mark as sent to prevent retry
      await batchRef.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        error: 'Owner not found',
      });
      return res.status(200).json({ message: 'Owner not found' });
    }

    const ownerData = ownerDoc.data();
    const fcmToken = ownerData.fcmToken;

    if (!fcmToken) {
      logger.debug('sendBatchedNotificationHandler: Photo owner has no FCM token', {
        batchId,
        photoOwnerId,
      });
      // Mark as sent to prevent retry
      await batchRef.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        error: 'No FCM token',
      });
      return res.status(200).json({ message: 'No FCM token' });
    }

    // Check notification preferences
    const prefs = ownerData.notificationPreferences || {};
    const masterEnabled = prefs.enabled !== false;
    const likesEnabled = prefs.likes !== false;

    if (!masterEnabled || !likesEnabled) {
      logger.debug('sendBatchedNotificationHandler: Notifications disabled by user preferences', {
        batchId,
        photoOwnerId,
        masterEnabled,
        likesEnabled,
      });
      // Mark as sent to prevent retry
      await batchRef.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        error: 'Notifications disabled',
      });
      return res.status(200).json({ message: 'Notifications disabled' });
    }

    // Get reactor's display name and profile photo
    const reactorDoc = await db.collection('users').doc(reactorId).get();
    const reactorData = reactorDoc.exists ? reactorDoc.data() : {};
    const reactorName = reactorData.displayName || reactorData.username || 'Someone';
    const reactorProfilePhotoURL = reactorData.profilePhotoURL || reactorData.photoURL || null;

    logger.debug('sendBatchedNotificationHandler: Sending notification', {
      batchId,
      reactorName,
      reactions,
    });

    // Call the actual notification sender
    await sendReactionPushNotification(
      photoOwnerId,
      reactorId,
      reactorName,
      reactorProfilePhotoURL,
      photoId,
      reactions,
      fcmToken
    );

    // Mark batch as sent
    await batchRef.update({
      status: 'sent',
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.debug('sendBatchedNotificationHandler: Batch sent successfully', { batchId });

    return res.status(200).json({ message: 'Notification sent' });
  } catch (error) {
    logger.error('sendBatchedNotificationHandler: Error', {
      error: error.message,
      stack: error.stack,
    });

    // Reset batch status to pending so Cloud Tasks can retry
    try {
      const { batchId } = req.body;
      if (batchId) {
        const db = admin.firestore();
        await db.collection('reactionBatches').doc(batchId).update({
          status: 'pending',
          error: error.message,
        });
      }
    } catch (resetError) {
      logger.error('sendBatchedNotificationHandler: Failed to reset batch status', {
        error: resetError.message,
      });
    }

    return res.status(500).json({ error: error.message });
  }
}

/**
 * Send reaction push notification and in-app notification
 * Extracted from original sendBatchedReactionNotification
 *
 * @param {string} photoOwnerId - Photo owner user ID
 * @param {string} reactorId - Reactor user ID
 * @param {string} reactorName - Reactor display name
 * @param {string} reactorProfilePhotoURL - Reactor profile photo URL
 * @param {string} photoId - Photo ID
 * @param {Object} reactions - Reactions object { emoji: count }
 * @param {string} fcmToken - Photo owner FCM token
 */
async function sendReactionPushNotification(
  photoOwnerId,
  reactorId,
  reactorName,
  reactorProfilePhotoURL,
  photoId,
  reactions,
  fcmToken
) {
  const { sendPushNotification } = require('../notifications/sender');
  const db = admin.firestore();

  // Format reactions for display
  const reactionSummary = formatReactionSummary(reactions);
  if (!reactionSummary) {
    logger.debug('sendReactionPushNotification: No reactions to send');
    return;
  }

  const title = 'Flick';
  const body = `${reactorName} reacted ${reactionSummary} to your photo`;

  logger.debug('sendReactionPushNotification: Sending push notification', {
    reactorName,
    reactions,
    body,
  });

  // Send push notification
  await sendPushNotification(
    fcmToken,
    title,
    body,
    {
      type: 'reaction',
      photoId: photoId,
    },
    photoOwnerId
  );

  // Write to notifications collection for in-app display
  await db.collection('notifications').add({
    recipientId: photoOwnerId,
    type: 'reaction',
    senderId: reactorId,
    senderName: reactorName,
    senderProfilePhotoURL: reactorProfilePhotoURL || null,
    photoId: photoId,
    reactions: reactions,
    message: body,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    read: false,
  });

  logger.debug('sendReactionPushNotification: Notification sent and stored');
}

/**
 * Format reactions into "emoji×count" format for notification display
 * @param {object} reactions - Object like { '😂': 2, '❤️': 1 }
 * @returns {string} - Formatted string like "😂×2 ❤️×1"
 */
function formatReactionSummary(reactions) {
  return Object.entries(reactions)
    .filter(([emoji, count]) => count > 0)
    .map(([emoji, count]) => `${emoji}×${count}`)
    .join(' ');
}

module.exports = {
  sendBatchedNotificationHandler,
  sendReactionPushNotification,
};
