const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { initializeApp, getApps, getApp } = require('firebase-admin/app');
const { initializeFirestore } = require('firebase-admin/firestore');
const logger = require('./logger');
const nodemailer = require('nodemailer');
const {
  validateOrNull,
  DarkroomDocSchema,
  PhotoDocSchema,
  FriendshipDocSchema,
  UserDocSchema,
  SignedUrlRequestSchema,
} = require('./validation');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

// Initialize Firebase Admin SDK with preferRest for faster cold starts
const app = getApps().length > 0 ? getApp() : initializeApp();
const db = initializeFirestore(app, { preferRest: true });

/**
 * Varied notification templates for tagged photos (single tag)
 * Makes notifications feel human and not robotic
 */
const TAG_NOTIFICATION_TEMPLATES = [
  '{name} tagged you in a photo',
  "You're in {name}'s latest snap",
  '{name} included you in a moment',
  "You made it into {name}'s photo",
  '{name} captured you!',
];

/**
 * Varied notification templates for batch tags (multiple photos)
 * Used when someone tags user in multiple photos within debounce window
 */
const TAG_BATCH_TEMPLATES = [
  '{name} tagged you in {count} photos',
  "You're in {count} of {name}'s snaps",
  '{name} included you in {count} moments',
];

// Track pending tags for debouncing: { "taggerId_taggedId": { timeout, photoIds, taggerName, taggerProfilePhotoURL, taggedUserId, fcmToken } }
const pendingTags = {};

// Tag debounce window in milliseconds (30 seconds - longer than reactions since tagging is slower)
const TAG_DEBOUNCE_MS = 30000;

/**
 * Pick a random template from an array
 * @param {string[]} templates - Array of template strings
 * @returns {string} - Random template
 */
function getRandomTemplate(templates) {
  const index = Math.floor(Math.random() * templates.length);
  return templates[index];
}

// Reaction batch window in milliseconds (30 seconds)
const REACTION_BATCH_WINDOW_MS = 30000;

// Abuse prevention limits
const MAX_MENTIONS_PER_COMMENT = 10;
const MAX_TAGS_PER_PHOTO = 20;
const MAX_NOTIFICATION_TEXT = 50;

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

/**
 * Get configured email transporter for sending emails via Gmail SMTP
 * Credentials stored in environment variables (functions/.env):
 * - SMTP_EMAIL: Gmail address for SMTP auth
 * - SMTP_PASSWORD: Gmail app password
 * - SUPPORT_EMAIL: Destination email for reports
 * @returns {nodemailer.Transporter} - Configured nodemailer transporter
 */
function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

/**
 * Check if a notification should be sent based on user preferences
 * @param {string} userId - User ID to check preferences for
 * @param {string} notificationType - Type of notification ('likes', 'comments', 'follows', 'friendRequests', 'mentions')
 * @returns {Promise<boolean>} - True if notification should be sent
 */
async function shouldSendNotification(userId, notificationType) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return false;

  const prefs = userDoc.data().notificationPreferences || {};
  // Default to true if preferences not set
  const masterEnabled = prefs.enabled !== false;
  const typeEnabled = prefs[notificationType] !== false;

  return masterEnabled && typeEnabled;
}

/**
 * Reveal all developing photos for a user and schedule next reveal
 * @param {string} userId - User ID
 * @param {Timestamp} now - Current timestamp
 * @returns {Promise<object>} - Result of reveal operation
 */
async function revealUserPhotos(userId, now) {
  // Guard: validate userId is non-empty string
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    logger.warn('revealUserPhotos: Invalid userId', { userId });
    return { userId, success: false, error: 'Invalid userId' };
  }

  logger.info(`revealUserPhotos: Processing user ${userId}`);

  // Query developing photos for this user
  const photosSnapshot = await db
    .collection('photos')
    .where('userId', '==', userId)
    .where('status', '==', 'developing')
    .get();

  if (photosSnapshot.empty) {
    logger.info(`revealUserPhotos: No developing photos for user ${userId}`);
  } else {
    logger.info(`revealUserPhotos: Revealing ${photosSnapshot.size} photos for user ${userId}`);

    // Update all photos to revealed
    const batch = db.batch();
    photosSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'revealed',
        revealedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  // Calculate next reveal time (0-5 minutes from now)
  const randomMinutes = Math.floor(Math.random() * 6); // 0-5 minutes
  const nextRevealMs = now.toMillis() + randomMinutes * 60 * 1000;
  const nextRevealAt = admin.firestore.Timestamp.fromMillis(nextRevealMs);

  // Update darkroom with new reveal time
  // This update triggers sendPhotoRevealNotification via onUpdate
  await db.collection('darkrooms').doc(userId).update({
    nextRevealAt: nextRevealAt,
    lastRevealedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info(
    `revealUserPhotos: User ${userId} - ${photosSnapshot.size} photos revealed, next reveal at ${nextRevealAt.toDate()}`
  );

  return {
    userId,
    success: true,
    photosRevealed: photosSnapshot.size,
    nextRevealAt: nextRevealAt.toDate(),
  };
}

/**
 * Cloud Function: HTTP handler for batched notification sends
 * Triggered by Cloud Tasks after 30-second delay
 * Idempotent handler for sending accumulated reaction notifications
 */
const { sendBatchedNotificationHandler } = require('./tasks/sendBatchedNotification');
exports.sendBatchedNotification = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .https.onRequest(sendBatchedNotificationHandler);

/**
 * Cloud Function: Process darkroom reveals on schedule
 * Runs every 2 minutes to check all darkrooms and reveal overdue photos
 * This ensures photos reveal at scheduled time even when app is closed
 */
exports.processDarkroomReveals = functions
  .runWith({ memory: '512MB', timeoutSeconds: 120 })
  .pubsub.schedule('every 2 minutes')
  .onRun(async context => {
    try {
      const now = admin.firestore.Timestamp.now();
      logger.info('processDarkroomReveals: Starting scheduled reveal check at', now.toDate());

      // Query all darkrooms where nextRevealAt has passed
      const darkroomsSnapshot = await db
        .collection('darkrooms')
        .where('nextRevealAt', '<=', now)
        .get();

      if (darkroomsSnapshot.empty) {
        logger.info('processDarkroomReveals: No darkrooms ready to reveal');
        return null;
      }

      logger.info(
        `processDarkroomReveals: Found ${darkroomsSnapshot.size} darkrooms ready to reveal`
      );

      // Process each darkroom
      const results = await Promise.all(
        darkroomsSnapshot.docs.map(async darkroomDoc => {
          const userId = darkroomDoc.id;
          try {
            return await revealUserPhotos(userId, now);
          } catch (error) {
            logger.error(`processDarkroomReveals: Error for user ${userId}:`, error);
            return { userId, success: false, error: error.message };
          }
        })
      );

      const successCount = results.filter(r => r.success).length;
      const revealedCount = results.reduce((sum, r) => sum + (r.photosRevealed || 0), 0);
      logger.info(
        `processDarkroomReveals: Completed. ${successCount}/${darkroomsSnapshot.size} users processed, ${revealedCount} photos revealed`
      );

      return {
        processed: darkroomsSnapshot.size,
        successful: successCount,
        photosRevealed: revealedCount,
      };
    } catch (error) {
      logger.error('processDarkroomReveals: Fatal error:', error);
      return null;
    }
  });

/**
 * Cloud Function: Check push notification receipts and clean up invalid tokens
 * Runs every 15 minutes to match Expo's recommended receipt check timing
 *
 * Flow:
 * 1. Get all pending receipts from Firestore
 * 2. Chunk receipt IDs for Expo API
 * 3. Check each receipt's delivery status
 * 4. Remove invalid tokens when DeviceNotRegistered error detected
 * 5. Clean up processed receipts
 */
exports.checkPushReceipts = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .pubsub.schedule('every 15 minutes')
  .onRun(async context => {
    const { expo } = require('./notifications/sender');
    const {
      getPendingReceipts,
      deletePendingReceipt,
      removeInvalidToken,
    } = require('./notifications/receipts');
    try {
      logger.info('checkPushReceipts: Starting receipt check');

      // Get all pending receipts from Firestore
      const pendingReceipts = await getPendingReceipts();

      if (pendingReceipts.length === 0) {
        logger.info('checkPushReceipts: No pending receipts');
        return null;
      }

      logger.info('checkPushReceipts: Found pending receipts', {
        count: pendingReceipts.length,
      });

      // Create lookup map for quick access to receipt data
      const receiptMap = {};
      for (const receipt of pendingReceipts) {
        receiptMap[receipt.ticketId] = receipt;
      }

      // Extract receipt IDs
      const receiptIds = pendingReceipts.map(r => r.ticketId);

      // Chunk receipt IDs for Expo API (handles batching automatically)
      const chunks = expo.chunkPushNotificationReceiptIds(receiptIds);

      let checkedCount = 0;
      let removedTokens = 0;
      let errorCount = 0;

      // Process each chunk
      for (const chunk of chunks) {
        try {
          const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

          // Process each receipt in the response
          for (const [ticketId, receipt] of Object.entries(receipts)) {
            const pendingData = receiptMap[ticketId];

            if (receipt.status === 'ok') {
              // Notification delivered successfully - clean up
              await deletePendingReceipt(ticketId);
              checkedCount++;
            } else if (receipt.status === 'error') {
              const { message, details } = receipt;

              logger.warn('checkPushReceipts: Receipt error', {
                ticketId,
                message,
                details,
                userId: pendingData?.userId,
              });

              // Check if device is no longer registered
              if (details?.error === 'DeviceNotRegistered') {
                if (pendingData?.userId) {
                  await removeInvalidToken(pendingData.userId);
                  removedTokens++;
                }
              }

              // Clean up receipt regardless of error type
              await deletePendingReceipt(ticketId);
              errorCount++;
            }
          }
        } catch (chunkError) {
          logger.error('checkPushReceipts: Chunk fetch failed', {
            error: chunkError.message,
          });
          // Continue with next chunk - let next run handle failed ones
        }
      }

      logger.info('checkPushReceipts: Complete', {
        checked: checkedCount + errorCount,
        removed: removedTokens,
        errors: errorCount,
      });

      return { checked: checkedCount + errorCount, removed: removedTokens, errors: errorCount };
    } catch (error) {
      logger.error('checkPushReceipts: Fatal error', { error: error.message });
      return null;
    }
  });

/**
 * Cloud Function: Send notification when photos are revealed in darkroom
 * Triggered when darkroom document is updated with new revealedAt timestamp
 *
 * IMPORTANT: Uses lastNotifiedAt to ensure only ONE notification per reveal batch.
 * This prevents spam when the scheduled function runs frequently.
 */
exports.sendPhotoRevealNotification = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .firestore.document('darkrooms/{userId}')
  .onUpdate(async (change, context) => {
    const { sendPushNotification } = require('./notifications/sender');
    try {
      const userId = context.params.userId;
      const before = change.before.data();
      const after = change.after.data();

      // Guard: validate document data exists
      if (!after || typeof after !== 'object') {
        logger.warn('sendPhotoRevealNotification: Invalid after data', { userId });
        return null;
      }
      if (!before || typeof before !== 'object') {
        logger.warn('sendPhotoRevealNotification: Invalid before data', { userId });
        return null;
      }

      // Check if this is a reveal event (lastRevealedAt changed)
      const lastRevealedAtBefore = before.lastRevealedAt?.toMillis() || 0;
      const lastRevealedAtAfter = after.lastRevealedAt?.toMillis() || 0;
      const wasRevealed = lastRevealedAtAfter > lastRevealedAtBefore;

      if (!wasRevealed) {
        logger.debug('sendPhotoRevealNotification: No new reveal, skipping notification');
        return null;
      }

      // Check if we already notified for this batch (lastNotifiedAt >= lastRevealedAt)
      const lastNotifiedAt = after.lastNotifiedAt?.toMillis() || 0;
      if (lastNotifiedAt >= lastRevealedAtAfter) {
        logger.debug('sendPhotoRevealNotification: Already notified for this batch, skipping');
        return null;
      }

      // Count photos revealed in THIS batch (revealedAt within 5 seconds of lastRevealedAt)
      // This tolerance accounts for batch commit timing differences
      const toleranceMs = 5000;
      const batchStartTime = lastRevealedAtAfter - toleranceMs;
      const batchEndTime = lastRevealedAtAfter + toleranceMs;

      const photosSnapshot = await db
        .collection('photos')
        .where('userId', '==', userId)
        .where('status', '==', 'revealed')
        .get();

      // Filter photos by revealedAt timestamp within the batch window
      const photosInBatch = photosSnapshot.docs.filter(doc => {
        const revealedAt = doc.data().revealedAt?.toMillis() || 0;
        return revealedAt >= batchStartTime && revealedAt <= batchEndTime;
      });

      const photosRevealed = photosInBatch.length;

      if (photosRevealed === 0) {
        logger.debug(
          'sendPhotoRevealNotification: No photos revealed in this batch, skipping notification'
        );
        // Still update lastNotifiedAt to prevent future checks for this batch
        await db.collection('darkrooms').doc(userId).update({
          lastNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return null;
      }

      // Get user's FCM token
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        logger.error('sendPhotoRevealNotification: User not found:', userId);
        return null;
      }

      const userData = userDoc.data();
      const fcmToken = userData.fcmToken;

      if (!fcmToken) {
        logger.debug('sendPhotoRevealNotification: User has no FCM token, skipping:', userId);
        return null;
      }

      // Send notification with simple, direct messaging
      const title = 'Photos Ready!';
      const body =
        photosRevealed === 1
          ? 'Your photo is ready to reveal!'
          : `Your ${photosRevealed} photos are ready to reveal!`;

      const result = await sendPushNotification(
        fcmToken,
        title,
        body,
        {
          type: 'photo_reveal',
        },
        userId
      );

      // Update lastNotifiedAt AFTER successfully sending notification
      await db.collection('darkrooms').doc(userId).update({
        lastNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.debug('sendPhotoRevealNotification: Notification sent to', userId, {
        photosRevealed,
        result,
      });
      return result;
    } catch (error) {
      logger.error('sendPhotoRevealNotification: Error:', error);
      return null;
    }
  });

/**
 * Cloud Function: Send notification when friend request is received
 * Triggered when friendship document is created with status 'pending'
 */
exports.sendFriendRequestNotification = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .firestore.document('friendships/{friendshipId}')
  .onCreate(async (snap, context) => {
    const { sendPushNotification } = require('./notifications/sender');
    try {
      const friendshipId = context.params.friendshipId;
      const friendshipData = snap.data();

      // Guard: validate friendshipData exists and has required shape
      if (!friendshipData || typeof friendshipData !== 'object') {
        logger.warn('sendFriendRequestNotification: Invalid friendship data', { friendshipId });
        return null;
      }

      // Guard: verify required IDs are present and valid
      const { requestedBy, user1Id, user2Id } = friendshipData;
      if (!requestedBy || !user1Id || !user2Id) {
        logger.warn('sendFriendRequestNotification: Missing required user IDs', {
          friendshipId,
          hasRequestedBy: !!requestedBy,
          hasUser1Id: !!user1Id,
          hasUser2Id: !!user2Id,
        });
        return null;
      }

      // Guard: verify IDs are different (not self-friendship)
      if (user1Id === user2Id) {
        logger.warn('sendFriendRequestNotification: Self-friendship detected', {
          friendshipId,
          user1Id,
          user2Id,
        });
        return null;
      }

      // Only send notification for pending friend requests
      if (friendshipData.status !== 'pending') {
        logger.debug(
          'sendFriendRequestNotification: Friendship not pending, skipping notification'
        );
        return null;
      }

      // Use IDs already validated above
      const recipientId = user1Id === requestedBy ? user2Id : user1Id;

      // Get recipient's FCM token
      const recipientDoc = await db.collection('users').doc(recipientId).get();

      if (!recipientDoc.exists) {
        logger.error('sendFriendRequestNotification: Recipient not found:', recipientId);
        return null;
      }

      const recipientData = recipientDoc.data();
      const fcmToken = recipientData.fcmToken;

      if (!fcmToken) {
        logger.debug(
          'sendFriendRequestNotification: Recipient has no FCM token, skipping:',
          recipientId
        );
        return null;
      }

      // Check notification preferences (enabled AND friendRequests)
      const prefs = recipientData.notificationPreferences || {};
      const masterEnabled = prefs.enabled !== false;
      const friendRequestsEnabled = prefs.friendRequests !== false;

      if (!masterEnabled || !friendRequestsEnabled) {
        logger.debug('sendFriendRequestNotification: Notifications disabled by user preferences', {
          recipientId,
          masterEnabled,
          friendRequestsEnabled,
        });
        return null;
      }

      // Get sender's display name
      const senderDoc = await db.collection('users').doc(requestedBy).get();

      const senderName = senderDoc.exists
        ? senderDoc.data().displayName || senderDoc.data().username
        : 'Someone';

      // Send notification
      const title = '👋 Friend Request';
      const body = `${senderName} sent you a friend request`;

      const result = await sendPushNotification(
        fcmToken,
        title,
        body,
        {
          type: 'friend_request',
          friendshipId: friendshipId,
        },
        recipientId
      );

      logger.debug('sendFriendRequestNotification: Notification sent to:', recipientId, result);
      return result;
    } catch (error) {
      logger.error('sendFriendRequestNotification: Error:', error);
      return null;
    }
  });

/**
 * Cloud Function: Send notification when friend request is accepted
 * Triggered when friendship document is updated with status changing to 'accepted'
 */
exports.sendFriendAcceptedNotification = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .firestore.document('friendships/{friendshipId}')
  .onUpdate(async (change, context) => {
    const { sendPushNotification } = require('./notifications/sender');
    try {
      const friendshipId = context.params.friendshipId;
      const before = change.before.data();
      const after = change.after.data();

      // Guard: validate document data exists
      if (!after || typeof after !== 'object') {
        logger.warn('sendFriendAcceptedNotification: Invalid after data', { friendshipId });
        return null;
      }
      if (!before || typeof before !== 'object') {
        logger.warn('sendFriendAcceptedNotification: Invalid before data', { friendshipId });
        return null;
      }

      // Check if status changed from 'pending' to 'accepted'
      if (before.status === after.status || after.status !== 'accepted') {
        logger.debug(
          'sendFriendAcceptedNotification: Not a pending->accepted transition, skipping'
        );
        return null;
      }

      // Guard: verify required IDs are present and valid
      const { requestedBy, user1Id, user2Id } = after;
      if (!requestedBy || !user1Id || !user2Id) {
        logger.warn('sendFriendAcceptedNotification: Missing required user IDs', {
          friendshipId,
          hasRequestedBy: !!requestedBy,
          hasUser1Id: !!user1Id,
          hasUser2Id: !!user2Id,
        });
        return null;
      }

      // The original requester receives this notification
      const recipientId = requestedBy;

      // The acceptor is the other user (not the original requester)
      const acceptorId = user1Id === requestedBy ? user2Id : user1Id;

      // Check recipient's notification preferences
      const recipientDoc = await db.collection('users').doc(recipientId).get();

      if (!recipientDoc.exists) {
        logger.error('sendFriendAcceptedNotification: Recipient not found:', recipientId);
        return null;
      }

      const recipientData = recipientDoc.data();
      const fcmToken = recipientData.fcmToken;

      if (!fcmToken) {
        logger.debug(
          'sendFriendAcceptedNotification: Recipient has no FCM token, skipping:',
          recipientId
        );
        return null;
      }

      // Check notification preferences (enabled AND follows)
      const prefs = recipientData.notificationPreferences || {};
      const masterEnabled = prefs.enabled !== false;
      const followsEnabled = prefs.follows !== false;

      if (!masterEnabled || !followsEnabled) {
        logger.debug('sendFriendAcceptedNotification: Notifications disabled by user preferences', {
          recipientId,
          masterEnabled,
          followsEnabled,
        });
        return null;
      }

      // Get acceptor's display name
      const acceptorDoc = await db.collection('users').doc(acceptorId).get();

      const acceptorName = acceptorDoc.exists
        ? acceptorDoc.data().displayName || acceptorDoc.data().username
        : 'Someone';

      const acceptorProfilePhotoURL = acceptorDoc.exists
        ? acceptorDoc.data().profilePhotoURL || acceptorDoc.data().photoURL
        : null;

      // Send notification
      const title = '🎉 Friend Request Accepted';
      const body = `${acceptorName} accepted your friend request`;

      const result = await sendPushNotification(
        fcmToken,
        title,
        body,
        {
          type: 'friend_accepted',
          friendshipId: friendshipId,
          userId: acceptorId, // ID of person who accepted request
        },
        recipientId
      );

      // Write to notifications collection for in-app display
      await db.collection('notifications').add({
        recipientId: recipientId,
        type: 'friend_accepted',
        senderId: acceptorId,
        senderName: acceptorName,
        senderProfilePhotoURL: acceptorProfilePhotoURL || null,
        friendshipId: friendshipId,
        message: body,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      });

      logger.debug('sendFriendAcceptedNotification: Notification sent to:', recipientId, result);
      return result;
    } catch (error) {
      logger.error('sendFriendAcceptedNotification: Error:', error);
      return null;
    }
  });

/**
 * Cloud Function: Send notification when someone reacts to user's photo
 * Triggered when photo document is updated with new reactions
 *
 * BATCHING: Uses Firestore-based batching for stateless aggregation
 * - Reactions stored in Firestore reactionBatches collection
 * - Cloud Tasks schedule delayed sends after 30-second window
 * - Multiple instances safely merge reactions via transactions
 */
exports.sendReactionNotification = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .firestore.document('photos/{photoId}')
  .onUpdate(async (change, context) => {
    const { addReactionToBatch } = require('./notifications/batching');

    try {
      const photoId = context.params.photoId;
      const before = change.before.data();
      const after = change.after.data();

      // Guard: validate document data exists
      if (!after || typeof after !== 'object') {
        logger.warn('sendReactionNotification: Invalid after data', { photoId });
        return null;
      }
      if (!before || typeof before !== 'object') {
        logger.warn('sendReactionNotification: Invalid before data', { photoId });
        return null;
      }

      // Guard: ensure after has required fields for reaction processing
      if (!after.userId) {
        logger.warn('sendReactionNotification: Missing userId in photo data', { photoId });
        return null;
      }

      // Validate reaction count is a number
      if (
        typeof after.reactionCount !== 'number' ||
        typeof (before.reactionCount || 0) !== 'number'
      ) {
        logger.warn('sendReactionNotification: Invalid reaction count type', { photoId });
        return null;
      }

      // Check if reactions were added (reactionCount increased)
      if (!after.reactionCount || after.reactionCount <= (before.reactionCount || 0)) {
        logger.debug('sendReactionNotification: No new reactions, skipping');
        return null;
      }

      // Get photo owner's ID
      const photoOwnerId = after.userId;

      // Determine who added reactions and what changed (the DIFF)
      const beforeReactions = before.reactions || {};
      const afterReactions = after.reactions || {};

      let reactorId = null;
      let reactionDiff = {}; // Only the new reactions added in this update

      for (const [userId, emojis] of Object.entries(afterReactions)) {
        // Skip if this is the photo owner (don't notify yourself)
        if (userId === photoOwnerId) continue;

        // Check if this user's reactions changed
        const beforeUserReactions = beforeReactions[userId] || {};
        const afterUserReactions = emojis;

        for (const [emoji, count] of Object.entries(afterUserReactions)) {
          const beforeCount = beforeUserReactions[emoji] || 0;
          if (count > beforeCount) {
            reactorId = userId;
            const diff = count - beforeCount;
            reactionDiff[emoji] = (reactionDiff[emoji] || 0) + diff;
          }
        }

        // Only process one reactor per update (the one who changed)
        if (reactorId) break;
      }

      // If no reactor found or reactor is the owner, skip
      if (!reactorId || reactorId === photoOwnerId) {
        logger.debug('sendReactionNotification: No valid reactor found, skipping');
        return null;
      }

      // Generate unique key for this photo+reactor combination
      const pendingKey = `${photoId}_${reactorId}`;

      logger.debug('sendReactionNotification: Processing reaction update', {
        photoId,
        reactorId,
        reactionDiff,
        pendingKey,
      });

      // Add reaction to Firestore batch (replaces in-memory batching)
      await addReactionToBatch(photoId, reactorId, reactionDiff);

      logger.debug('sendReactionNotification: Added to Firestore batch', {
        photoId,
        reactorId,
        pendingKey,
      });

      return null;
    } catch (error) {
      logger.error('sendReactionNotification: Error:', error);
      return null;
    }
  });

/**
 * Send the batched tag notification after debounce window expires
 * @param {string} pendingKey - Key in pendingTags object
 */
async function sendBatchedTagNotification(pendingKey) {
  const { sendPushNotification } = require('./notifications/sender');
  const pending = pendingTags[pendingKey];
  if (!pending) {
    logger.debug('sendBatchedTagNotification: No pending entry found for', pendingKey);
    return;
  }

  const { photoIds, taggerId, taggerName, taggerProfilePhotoURL, taggedUserId, fcmToken } = pending;

  // Delete pending entry immediately to prevent duplicate sends
  delete pendingTags[pendingKey];

  if (photoIds.length === 0) {
    logger.debug('sendBatchedTagNotification: No photos to notify for', pendingKey);
    return;
  }

  // Choose template based on count (single vs batch)
  const count = photoIds.length;
  let message;
  if (count === 1) {
    const template = getRandomTemplate(TAG_NOTIFICATION_TEMPLATES);
    message = template.replace('{name}', taggerName);
  } else {
    const template = getRandomTemplate(TAG_BATCH_TEMPLATES);
    message = template.replace('{name}', taggerName).replace('{count}', String(count));
  }

  const title = '📸 You were tagged';

  logger.debug('sendBatchedTagNotification: Sending notification', {
    pendingKey,
    taggerName,
    photoCount: count,
    message,
  });

  // Send push notification
  const result = await sendPushNotification(
    fcmToken,
    title,
    message,
    {
      type: 'tagged',
      photoId: photoIds[0], // First photo for deep link
      taggerId: taggerId,
      photoIds: JSON.stringify(photoIds),
    },
    taggedUserId
  );

  // Write to notifications collection for in-app display
  await db.collection('notifications').add({
    recipientId: taggedUserId,
    type: 'tagged',
    senderId: taggerId,
    senderName: taggerName,
    senderProfilePhotoURL: taggerProfilePhotoURL || null,
    photoId: photoIds[0], // First photo for deep link
    photoIds: photoIds, // All photos in batch
    photoCount: count,
    message: message,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    read: false,
  });

  logger.debug('sendBatchedTagNotification: Notification sent and stored', {
    pendingKey,
    result,
  });
}

/**
/**
 * Cloud Function: Send notification when someone is tagged in a photo
 * Triggered when photo document is updated with new taggedUserIds
 * Sends notifications immediately (no debouncing)
 */
exports.sendTaggedPhotoNotification = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .firestore.document('photos/{photoId}')
  .onUpdate(async (change, context) => {
    const { sendPushNotification } = require('./notifications/sender');

    try {
      const photoId = context.params.photoId;
      const before = change.before.data();
      const after = change.after.data();

      // Guard: validate document data exists
      if (!after || typeof after !== 'object') {
        logger.warn('sendTaggedPhotoNotification: Invalid after data', { photoId });
        return null;
      }
      if (!before || typeof before !== 'object') {
        logger.warn('sendTaggedPhotoNotification: Invalid before data', { photoId });
        return null;
      }

      // Guard: ensure photo has required userId field
      if (!after.userId) {
        logger.warn('sendTaggedPhotoNotification: Missing userId in photo data', { photoId });
        return null;
      }

      // Guard: skip if photo was deleted
      if (after.photoState === 'deleted') {
        logger.debug('sendTaggedPhotoNotification: Photo is deleted, skipping', { photoId });
        return null;
      }

      // Validate taggedUserIds
      if (after.taggedUserIds && !Array.isArray(after.taggedUserIds)) {
        logger.warn('sendTaggedPhotoNotification: taggedUserIds is not an array', { photoId });
        return null;
      }

      const taggerId = after.userId;

      // Filter and validate tagged user IDs
      const rawAfterTags = (after.taggedUserIds || []).slice(0, MAX_TAGS_PER_PHOTO);
      const validAfterTags = [...new Set(rawAfterTags)].filter(
        id => typeof id === 'string' && id.length > 0 && id !== taggerId
      );

      // Find newly added user IDs (in after but not in before)
      const beforeTaggedUserIds = before.taggedUserIds || [];
      const newlyTaggedUserIds = validAfterTags.filter(id => !beforeTaggedUserIds.includes(id));

      if (newlyTaggedUserIds.length === 0) {
        logger.debug('sendTaggedPhotoNotification: No new tags, skipping', { photoId });
        return null;
      }

      logger.info('sendTaggedPhotoNotification: Processing new tags', {
        photoId,
        taggerId,
        newlyTaggedUserIds,
      });

      // Get tagger's info for notification
      const taggerDoc = await db.collection('users').doc(taggerId).get();
      if (!taggerDoc.exists) {
        logger.error('sendTaggedPhotoNotification: Tagger not found:', taggerId);
        return null;
      }

      const taggerData = taggerDoc.data();
      const taggerName = taggerData.displayName || taggerData.username || 'Someone';
      const taggerProfilePhotoURL = taggerData.profilePhotoURL || taggerData.photoURL || null;

      // Send immediate notification to each newly tagged user
      for (const taggedUserId of newlyTaggedUserIds) {
        try {
          // Get tagged user's FCM token and preferences
          const taggedUserDoc = await db.collection('users').doc(taggedUserId).get();
          if (!taggedUserDoc.exists) {
            logger.debug('sendTaggedPhotoNotification: Tagged user not found', { taggedUserId });
            continue;
          }

          const taggedUserData = taggedUserDoc.data();
          const fcmToken = taggedUserData.fcmToken;

          if (!fcmToken) {
            logger.debug('sendTaggedPhotoNotification: Tagged user has no FCM token', {
              taggedUserId,
            });
            continue;
          }

          // Check notification preferences
          const prefs = taggedUserData.notificationPreferences || {};
          const masterEnabled = prefs.enabled !== false;
          const tagsEnabled = prefs.tags !== false;

          if (!masterEnabled || !tagsEnabled) {
            logger.debug('sendTaggedPhotoNotification: Notifications disabled by preferences', {
              taggedUserId,
              masterEnabled,
              tagsEnabled,
            });
            continue;
          }

          // Send push notification immediately
          const title = '🏷️ Tagged in Photo';
          const body = `${taggerName} tagged you in a photo`;

          await sendPushNotification(
            fcmToken,
            title,
            body,
            {
              type: 'tagged',
              photoId: photoId,
              taggerId: taggerId,
            },
            taggedUserId
          );

          // Write to notifications collection for in-app display
          await db.collection('notifications').add({
            recipientId: taggedUserId,
            type: 'tagged',
            senderId: taggerId,
            senderName: taggerName,
            senderProfilePhotoURL: taggerProfilePhotoURL || null,
            photoId: photoId,
            message: body,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
          });

          logger.info('sendTaggedPhotoNotification: Notification sent', {
            photoId,
            taggerId,
            taggedUserId,
          });
        } catch (error) {
          logger.error('sendTaggedPhotoNotification: Error sending to user', {
            taggedUserId,
            error: error.message,
          });
          // Continue to next user even if one fails
        }
      }

      return null;
    } catch (error) {
      logger.error('sendTaggedPhotoNotification: Error:', error);
      return null;
    }
  });
exports.getSignedPhotoUrl = onCall({ memory: '256MiB', timeoutSeconds: 30 }, async request => {
  const userId = request.auth?.uid;

  // Guard: Require authentication
  if (!userId) {
    logger.warn('getSignedPhotoUrl: Unauthenticated request rejected');
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Validate request data
  const validationResult = SignedUrlRequestSchema.safeParse(request.data);
  if (!validationResult.success) {
    logger.warn('getSignedPhotoUrl: Invalid request data', {
      errors: validationResult.error.errors,
      userId,
    });
    throw new HttpsError('invalid-argument', 'Invalid request: photoPath is required');
  }

  const { photoPath } = validationResult.data;

  // === Access validation: check ownership or friendship ===
  const pathParts = photoPath.split('/');
  if (pathParts.length < 2 || pathParts[0] !== 'photos') {
    // Could be profile-photos - handle that case
    if (pathParts[0] !== 'profile-photos') {
      throw new HttpsError('invalid-argument', 'Invalid photo path');
    }
    // profile-photos: any authenticated user can access, skip friendship check
    logger.debug('getSignedPhotoUrl: Profile photo access allowed', { userId, photoPath });
  } else {
    const photoOwnerId = pathParts[1];
    if (userId !== photoOwnerId) {
      // Not the owner — check friendship
      const id1 = userId < photoOwnerId ? userId : photoOwnerId;
      const id2 = userId < photoOwnerId ? photoOwnerId : userId;
      const friendshipDoc = await db.collection('friendships').doc(`${id1}_${id2}`).get();

      if (!friendshipDoc.exists || friendshipDoc.data().status !== 'accepted') {
        logger.warn('getSignedPhotoUrl: Access denied', { userId, photoOwnerId });
        throw new HttpsError('permission-denied', 'You do not have access to this photo');
      }
      logger.debug('getSignedPhotoUrl: Friend access allowed', { userId, photoOwnerId });
    } else {
      logger.debug('getSignedPhotoUrl: Owner access allowed', { userId });
    }
  }

  logger.info('getSignedPhotoUrl: Generating signed URL', { userId, photoPath });

  try {
    const { getStorage } = require('firebase-admin/storage');
    const bucket = getStorage().bucket();
    const file = bucket.file(photoPath);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      logger.warn('getSignedPhotoUrl: File not found', { photoPath, userId });
      throw new HttpsError('not-found', 'Photo not found');
    }

    // Generate signed URL with 24-hour expiration
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    logger.info('getSignedPhotoUrl: Signed URL generated', { userId, photoPath });
    return { url };
  } catch (error) {
    // Re-throw HttpsErrors as-is
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error('getSignedPhotoUrl: Failed to generate signed URL', {
      error: error.message,
      userId,
      photoPath,
    });
    throw new HttpsError('internal', 'Failed to generate signed URL');
  }
});

/**
 * Cloud Function: Send notification when someone comments on a photo
 * Triggered when a new comment is created in the comments subcollection
 *
 * Sends two types of notifications:
 * 1. Comment notification to photo owner (respects comments preference)
 * 2. @mention notifications to mentioned users (respects mentions preference)
 *
 * Skips self-comments (commenter is photo owner).
 * For replies: skips comment notification to photo owner (Part 1)
 * but still processes @mention notifications (Part 2).
 */
exports.sendCommentNotification = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .firestore.document('photos/{photoId}/comments/{commentId}')
  .onCreate(async (snap, context) => {
    const { sendPushNotification } = require('./notifications/sender');
    const { photoId, commentId } = context.params;
    const comment = snap.data();

    try {
      // Guard: validate comment data
      if (!comment || typeof comment !== 'object') {
        logger.warn('sendCommentNotification: Invalid comment data', { photoId, commentId });
        return null;
      }

      // Track if this is a reply (replies skip Part 1 but still process Part 2 @mentions)
      const isReply = !!comment.parentId;

      // Get photo to find owner
      const photoDoc = await db.collection('photos').doc(photoId).get();

      if (!photoDoc.exists) {
        logger.warn('sendCommentNotification: Photo not found', { photoId });
        return null;
      }

      const photo = photoDoc.data();
      const photoOwnerId = photo.userId;

      // Get commenter's info for notification
      const commenterDoc = await db.collection('users').doc(comment.userId).get();

      const commenterData = commenterDoc.exists ? commenterDoc.data() : {};
      const commenterName = commenterData.displayName || commenterData.username || 'Someone';
      const commenterProfilePhotoURL =
        commenterData.profilePhotoURL || commenterData.photoURL || null;

      // Build comment preview for notification body (UTF-8 safe truncation)
      let commentPreview;
      if (comment.text && comment.text.trim()) {
        const codePoints = [...(comment.text || '')];
        const truncatedText = codePoints.slice(0, MAX_NOTIFICATION_TEXT).join('');
        commentPreview = truncatedText + (codePoints.length > MAX_NOTIFICATION_TEXT ? '...' : '');
      } else if (comment.mediaType === 'gif') {
        commentPreview = 'sent a GIF';
      } else if (comment.mediaType === 'image') {
        commentPreview = 'sent a photo';
      } else {
        commentPreview = 'commented';
      }

      let commentNotificationSent = false;

      // ========== PART 1: Send comment notification to photo owner ==========
      // Skip for replies — owner was already notified of the top-level comment
      if (!isReply) {
        // Don't notify if commenter is the photo owner (self-comment)
        if (comment.userId !== photoOwnerId) {
          // Get photo owner's data
          const ownerDoc = await db.collection('users').doc(photoOwnerId).get();

          if (ownerDoc.exists && ownerDoc.data().fcmToken) {
            const ownerData = ownerDoc.data();

            // Check notification preferences (enabled AND comments)
            const prefs = ownerData.notificationPreferences || {};
            const masterEnabled = prefs.enabled !== false;
            const commentsEnabled = prefs.comments !== false;

            if (masterEnabled && commentsEnabled) {
              // Send notification via Expo Push API
              const title = '💬 New Comment';
              const pushBody = `${commenterName} commented on your photo: ${commentPreview}`;
              const inAppMessage = `commented on your photo: ${commentPreview}`;

              await sendPushNotification(
                ownerData.fcmToken,
                title,
                pushBody,
                {
                  type: 'comment',
                  photoId,
                  commentId,
                  screen: 'Feed',
                },
                photoOwnerId
              );

              // Write to notifications collection for in-app display
              await db.collection('notifications').add({
                recipientId: photoOwnerId,
                type: 'comment',
                senderId: comment.userId,
                senderName: commenterName,
                senderProfilePhotoURL: commenterProfilePhotoURL,
                photoId: photoId,
                commentId: commentId,
                message: inAppMessage,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
              });

              commentNotificationSent = true;
              logger.info('sendCommentNotification: Comment notification sent', {
                photoId,
                commentId,
                to: photoOwnerId,
                commenter: comment.userId,
              });
            } else {
              logger.debug(
                'sendCommentNotification: Comment notifications disabled by user preferences',
                {
                  photoOwnerId,
                  masterEnabled,
                  commentsEnabled,
                }
              );
            }
          } else {
            logger.debug('sendCommentNotification: No FCM token for photo owner', {
              photoOwnerId,
            });
          }
        }
      }

      // ========== PART 2: Send @mention notifications ==========
      // Extract @mentions from comment text (capped to prevent abuse)
      const mentions = (comment.text || '').match(/@(\w+)/g) || [];
      const cappedMentions = mentions.slice(0, MAX_MENTIONS_PER_COMMENT);

      if (mentions.length > MAX_MENTIONS_PER_COMMENT) {
        logger.warn('sendCommentNotification: Mentions capped', {
          total: mentions.length,
          capped: MAX_MENTIONS_PER_COMMENT,
        });
      }

      if (cappedMentions.length > 0) {
        // Get unique usernames (without @ prefix)
        const uniqueUsernames = [...new Set(cappedMentions.map(m => m.substring(1).toLowerCase()))];

        logger.debug('sendCommentNotification: Processing mentions', {
          photoId,
          commentId,
          uniqueUsernames,
        });

        for (const username of uniqueUsernames) {
          try {
            // Query users collection for matching username (case-insensitive)
            // Note: Firestore doesn't support case-insensitive queries directly,
            // so we store usernames in lowercase or use a lowercased field
            const usersSnapshot = await db
              .collection('users')
              .where('username', '==', username)
              .limit(1)
              .get();

            if (usersSnapshot.empty) {
              logger.debug('sendCommentNotification: Mentioned user not found', { username });
              continue;
            }

            const mentionedUserDoc = usersSnapshot.docs[0];
            const mentionedUserId = mentionedUserDoc.id;
            const mentionedUserData = mentionedUserDoc.data();

            // Skip if mentioned user is the commenter (don't self-notify)
            if (mentionedUserId === comment.userId) {
              logger.debug('sendCommentNotification: Skipping self-mention', { mentionedUserId });
              continue;
            }

            // Skip if mentioned user is photo owner AND already notified via Part 1
            // For replies, the owner was NOT notified in Part 1, so they should get the @mention
            if (mentionedUserId === photoOwnerId && commentNotificationSent) {
              logger.debug(
                'sendCommentNotification: Skipping mention - already notified as owner',
                {
                  mentionedUserId,
                }
              );
              continue;
            }

            // Check mentioned user's notification preferences
            const prefs = mentionedUserData.notificationPreferences || {};
            const masterEnabled = prefs.enabled !== false;
            const mentionsEnabled = prefs.mentions !== false;

            if (!masterEnabled || !mentionsEnabled) {
              logger.debug(
                'sendCommentNotification: Mention notifications disabled by user preferences',
                {
                  mentionedUserId,
                  masterEnabled,
                  mentionsEnabled,
                }
              );
              continue;
            }

            // Check for FCM token
            const fcmToken = mentionedUserData.fcmToken;
            if (!fcmToken) {
              logger.debug('sendCommentNotification: No FCM token for mentioned user', {
                mentionedUserId,
              });
              continue;
            }

            // Send mention notification
            const mentionTitle = '💬 You were mentioned';
            const mentionBody = `${commenterName} mentioned you in a comment`;

            await sendPushNotification(
              fcmToken,
              mentionTitle,
              mentionBody,
              {
                type: 'mention',
                photoId,
                commentId,
              },
              mentionedUserId
            );

            // Write to notifications collection for in-app display
            await db.collection('notifications').add({
              recipientId: mentionedUserId,
              type: 'mention',
              senderId: comment.userId,
              senderName: commenterName,
              senderProfilePhotoURL: commenterProfilePhotoURL,
              photoId: photoId,
              commentId: commentId,
              message: mentionBody,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              read: false,
            });

            logger.info('sendCommentNotification: Mention notification sent', {
              photoId,
              commentId,
              to: mentionedUserId,
              mentionedUsername: username,
            });
          } catch (mentionError) {
            logger.error('sendCommentNotification: Failed to process mention', {
              username,
              error: mentionError.message,
            });
            // Continue with other mentions
          }
        }
      }

      return { commentNotificationSent, mentionsProcessed: cappedMentions.length };
    } catch (error) {
      logger.error('sendCommentNotification: Failed', {
        error: error.message,
        photoId,
        commentId,
      });
      return null;
    }
  });

/**
 * Delete user account and all associated data
 * Called after user re-authenticates via phone verification
 * Order: Storage files -> Photos -> Friendships -> Darkroom -> User -> Auth
 *
 * IMPORTANT: Auth user must be deleted LAST to maintain permissions during cleanup
 */
exports.deleteUserAccount = onCall({ memory: '512MiB', timeoutSeconds: 300 }, async request => {
  // Require authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated to delete account');
  }

  const userId = request.auth.uid;
  logger.info('deleteUserAccount: Starting deletion', { userId });

  try {
    const { getStorage } = require('firebase-admin/storage');
    const bucket = getStorage().bucket();

    // Helper: commit operations in batches respecting 400-op limit
    const BATCH_LIMIT = 400;
    const commitInBatches = async (ops, label) => {
      for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
        const chunk = ops.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();
        for (const op of chunk) {
          if (op.type === 'delete') {
            batch.delete(op.ref);
          } else if (op.type === 'update') {
            batch.update(op.ref, op.data);
          }
        }
        await batch.commit();
      }
      if (ops.length > 0) {
        logger.info(`deleteUserAccount: ${label}`, { count: ops.length });
      }
    };

    // Step 1: Collect photo references and Storage paths for later cleanup
    const photosSnapshot = await db.collection('photos').where('userId', '==', userId).get();
    logger.info('deleteUserAccount: Found photos to delete', { count: photosSnapshot.size });

    const storagePaths = [];
    for (const doc of photosSnapshot.docs) {
      const photoData = doc.data();
      if (photoData.imageURL) {
        try {
          const decodedUrl = decodeURIComponent(photoData.imageURL);
          const pathMatch = decodedUrl.match(/\/o\/(.+?)\?/);
          if (pathMatch) {
            storagePaths.push(pathMatch[1]);
          }
        } catch (parseError) {
          logger.warn('deleteUserAccount: Failed to parse imageURL', {
            error: parseError.message,
          });
        }
      }
    }

    // Step 2: Delete all photos from Firestore (batch with size limit)
    const photoOps = photosSnapshot.docs.map(doc => ({ ref: doc.ref, type: 'delete' }));
    await commitInBatches(photoOps, 'Deleted photo documents');

    // Step 3: Storage cleanup (best-effort AFTER Firestore photo batch succeeds)
    for (const path of storagePaths) {
      try {
        await bucket.file(path).delete();
        logger.debug('deleteUserAccount: Deleted storage file', { path });
      } catch (storageError) {
        logger.error('deleteUserAccount: Storage cleanup failed - orphaned file', {
          path,
          userId,
          error: storageError.message,
        });
        // Continue — Firestore data already cleaned up
      }
    }

    // Step 4: Delete friendships (both directions, batched)
    const friendships1 = await db.collection('friendships').where('user1Id', '==', userId).get();
    const friendships2 = await db.collection('friendships').where('user2Id', '==', userId).get();
    const friendshipOps = [
      ...friendships1.docs.map(doc => ({ ref: doc.ref, type: 'delete' })),
      ...friendships2.docs.map(doc => ({ ref: doc.ref, type: 'delete' })),
    ];
    await commitInBatches(friendshipOps, 'Deleted friendships');

    // Step 5: Delete darkroom and user documents in a single batch
    const cleanupOps = [];
    const darkroomRef = db.doc(`darkrooms/${userId}`);
    const darkroomDoc = await darkroomRef.get();
    if (darkroomDoc.exists) {
      cleanupOps.push({ ref: darkroomRef, type: 'delete' });
    }

    const userRef = db.doc(`users/${userId}`);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      cleanupOps.push({ ref: userRef, type: 'delete' });
    }
    await commitInBatches(cleanupOps, 'Deleted user and darkroom documents');

    // Step 6: Delete Firebase Auth user (LAST - after all data cleanup)
    await admin.auth().deleteUser(userId);
    logger.info('deleteUserAccount: Deleted auth user, account deletion complete', { userId });

    return { success: true };
  } catch (error) {
    logger.error('deleteUserAccount: Failed', { userId, error: error.message });
    throw new HttpsError('internal', 'Account deletion failed. Please try again later.');
  }
});

/**
 * Cloud Function: Get mutual friend suggestions
 * Computes friends-of-friends for the authenticated user
 * Uses admin SDK to bypass security rules (users can't read other users' friendships)
 */
exports.getMutualFriendSuggestions = onCall(
  { memory: '512MiB', timeoutSeconds: 120 },
  async request => {
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
      // Step 1: Get all friendships involving this user
      const [snap1, snap2] = await Promise.all([
        db.collection('friendships').where('user1Id', '==', userId).get(),
        db.collection('friendships').where('user2Id', '==', userId).get(),
      ]);

      // Step 2: Build friendIds (accepted) and excludeIds (all connected + self)
      const friendIds = new Set();
      const excludeIds = new Set([userId]);

      const processDocs = docs => {
        docs.forEach(docSnap => {
          const data = docSnap.data();
          const otherId = data.user1Id === userId ? data.user2Id : data.user1Id;
          excludeIds.add(otherId);
          if (data.status === 'accepted') {
            friendIds.add(otherId);
          }
        });
      };

      processDocs(snap1.docs);
      processDocs(snap2.docs);

      if (friendIds.size === 0) {
        return { suggestions: [] };
      }

      // Step 3: Cap at 30 friends to limit query volume
      const friendIdsToProcess = Array.from(friendIds).slice(0, 30);

      // Step 4: Query each friend's friendships in parallel (admin bypasses rules)
      const friendQueries = friendIdsToProcess.map(async friendId => {
        const [f1, f2] = await Promise.all([
          db
            .collection('friendships')
            .where('user1Id', '==', friendId)
            .where('status', '==', 'accepted')
            .get(),
          db
            .collection('friendships')
            .where('user2Id', '==', friendId)
            .where('status', '==', 'accepted')
            .get(),
        ]);
        return [...f1.docs, ...f2.docs];
      });
      const friendResults = await Promise.all(friendQueries);

      // Step 5: Count mutual connections
      const mutualCounts = new Map();

      friendResults.forEach(docs => {
        docs.forEach(docSnap => {
          const data = docSnap.data();
          [data.user1Id, data.user2Id].forEach(id => {
            if (!excludeIds.has(id)) {
              mutualCounts.set(id, (mutualCounts.get(id) || 0) + 1);
            }
          });
        });
      });

      if (mutualCounts.size === 0) {
        return { suggestions: [] };
      }

      // Step 6: Sort by count descending, take top 20
      const sortedEntries = Array.from(mutualCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

      // Step 7: Fetch user profiles in parallel
      const profileFetches = sortedEntries.map(async ([suggestionUserId, mutualCount]) => {
        const userDoc = await db.collection('users').doc(suggestionUserId).get();
        if (!userDoc.exists) return null;

        const userData = userDoc.data();
        return {
          userId: suggestionUserId,
          displayName: userData.displayName || null,
          username: userData.username || null,
          profilePhotoURL: userData.profilePhotoURL || userData.photoURL || null,
          mutualCount,
        };
      });
      const profiles = await Promise.all(profileFetches);

      const suggestions = profiles.filter(p => p !== null);

      logger.info('getMutualFriendSuggestions: Complete', {
        userId,
        friendCount: friendIds.size,
        suggestionsFound: suggestions.length,
      });

      return { suggestions };
    } catch (error) {
      logger.error('getMutualFriendSuggestions: Failed', { userId, error: error.message });
      throw new HttpsError('internal', 'Failed to get mutual friend suggestions');
    }
  }
);

/**
 * Cloud Function: Get mutual friends between the caller and a photo owner
 * Returns the intersection of both users' accepted friend lists, plus the photo owner.
 * Used by the @-mention autocomplete UI to show taggable users in comments.
 *
 * Input: { photoOwnerId: string }
 * Output: { mutualFriends: [{ userId, username, displayName, profilePhotoURL }] }
 */
exports.getMutualFriendsForComments = onCall(
  { memory: '512MiB', timeoutSeconds: 60 },
  async request => {
    const callerId = request.auth?.uid;

    if (!callerId) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { photoOwnerId } = request.data || {};

    if (!photoOwnerId || typeof photoOwnerId !== 'string') {
      throw new HttpsError('invalid-argument', 'photoOwnerId is required and must be a string');
    }

    try {
      // Step 1: Get caller's accepted friendships AND photo owner's accepted friendships in parallel
      const [callerSnap1, callerSnap2, ownerSnap1, ownerSnap2] = await Promise.all([
        db.collection('friendships').where('user1Id', '==', callerId).get(),
        db.collection('friendships').where('user2Id', '==', callerId).get(),
        db.collection('friendships').where('user1Id', '==', photoOwnerId).get(),
        db.collection('friendships').where('user2Id', '==', photoOwnerId).get(),
      ]);

      // Step 2: Build caller's friend set (accepted only)
      const callerFriendIds = new Set();
      const extractFriends = (docs, userId, targetSet) => {
        docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.status === 'accepted') {
            const otherId = data.user1Id === userId ? data.user2Id : data.user1Id;
            targetSet.add(otherId);
          }
        });
      };

      extractFriends(callerSnap1.docs, callerId, callerFriendIds);
      extractFriends(callerSnap2.docs, callerId, callerFriendIds);

      // Step 3: Build photo owner's friend set (accepted only)
      const ownerFriendIds = new Set();
      extractFriends(ownerSnap1.docs, photoOwnerId, ownerFriendIds);
      extractFriends(ownerSnap2.docs, photoOwnerId, ownerFriendIds);

      // Step 4: Compute intersection (friends in common)
      const mutualIds = new Set();
      for (const id of callerFriendIds) {
        if (ownerFriendIds.has(id)) {
          mutualIds.add(id);
        }
      }

      // Always include the photo owner as a valid tag target
      mutualIds.add(photoOwnerId);

      // Remove the caller from the result (don't tag yourself)
      mutualIds.delete(callerId);

      // Step 5: Cap at 50 mutual friends
      const mutualIdsArray = Array.from(mutualIds).slice(0, 50);

      if (mutualIdsArray.length === 0) {
        return { mutualFriends: [] };
      }

      // Step 6: Fetch user profiles in parallel
      const profileFetches = mutualIdsArray.map(async userId => {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) return null;

        const userData = userDoc.data();
        return {
          userId,
          username: userData.username || null,
          displayName: userData.displayName || null,
          profilePhotoURL: userData.profilePhotoURL || userData.photoURL || null,
        };
      });
      const profiles = await Promise.all(profileFetches);

      // Step 7: Filter nulls and sort alphabetically by displayName
      const mutualFriends = profiles
        .filter(p => p !== null)
        .sort((a, b) => {
          const nameA = (a.displayName || '').toLowerCase();
          const nameB = (b.displayName || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });

      logger.info('getMutualFriendsForComments: Complete', {
        callerId,
        photoOwnerId,
        callerFriendCount: callerFriendIds.size,
        ownerFriendCount: ownerFriendIds.size,
        mutualCount: mutualFriends.length,
      });

      return { mutualFriends };
    } catch (error) {
      logger.error('getMutualFriendsForComments: Failed', {
        callerId,
        photoOwnerId,
        error: error.message,
      });
      throw new HttpsError('internal', 'Failed to get mutual friends for comments');
    }
  }
);

/**
 * Schedule user account for deletion after 30-day grace period
 * Sets scheduledForDeletionAt to 30 days from now
 * User is logged out after scheduling - if they log back in, they can cancel
 */
exports.scheduleUserAccountDeletion = onCall(
  { memory: '256MiB', timeoutSeconds: 30 },
  async request => {
    // Require authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated to schedule deletion');
    }

    const userId = request.auth.uid;
    logger.info('scheduleUserAccountDeletion: Scheduling deletion', { userId });

    try {
      // Calculate deletion date: 30 days from now
      const now = new Date();
      const scheduledForDeletionAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Update user document with scheduled deletion info
      await db
        .collection('users')
        .doc(userId)
        .update({
          scheduledForDeletionAt: admin.firestore.Timestamp.fromDate(scheduledForDeletionAt),
          deletionScheduledAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      logger.info('scheduleUserAccountDeletion: User scheduled for deletion', {
        userId,
        scheduledForDeletionAt: scheduledForDeletionAt.toISOString(),
      });

      return {
        success: true,
        scheduledDate: scheduledForDeletionAt.toISOString(),
      };
    } catch (error) {
      logger.error('scheduleUserAccountDeletion: Failed', { userId, error: error.message });
      throw new HttpsError(
        'internal',
        'Failed to schedule account deletion. Please try again later.'
      );
    }
  }
);

/**
 * Cancel a scheduled account deletion
 * Clears scheduledForDeletionAt and deletionScheduledAt fields
 * Called when user logs back in during grace period and chooses to keep account
 */
exports.cancelUserAccountDeletion = onCall(
  { memory: '256MiB', timeoutSeconds: 30 },
  async request => {
    // Require authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated to cancel deletion');
    }

    const userId = request.auth.uid;
    logger.info('cancelUserAccountDeletion: Canceling scheduled deletion', { userId });

    try {
      // Clear deletion schedule fields
      await db.collection('users').doc(userId).update({
        scheduledForDeletionAt: admin.firestore.FieldValue.delete(),
        deletionScheduledAt: admin.firestore.FieldValue.delete(),
      });

      logger.info('cancelUserAccountDeletion: Scheduled deletion canceled', { userId });

      return { success: true };
    } catch (error) {
      logger.error('cancelUserAccountDeletion: Failed', { userId, error: error.message });
      throw new HttpsError(
        'internal',
        'Failed to cancel account deletion. Please try again later.'
      );
    }
  }
);

/**
 * Cloud Function: Send reminder notification 3 days before account deletion
 * Runs daily at 9 AM UTC to check for accounts approaching deletion
 */
exports.sendDeletionReminderNotification = functions
  .runWith({ memory: '256MB', timeoutSeconds: 300 })
  .pubsub.schedule('0 9 * * *') // Daily at 9 AM UTC
  .onRun(async context => {
    const { sendPushNotification } = require('./notifications/sender');
    try {
      const now = admin.firestore.Timestamp.now();

      // Calculate 3 days from now window (check accounts deleting in ~3 days)
      const threeDaysFromNow = admin.firestore.Timestamp.fromMillis(
        now.toMillis() + 3 * 24 * 60 * 60 * 1000
      );
      const threeDaysFromNowEnd = admin.firestore.Timestamp.fromMillis(
        now.toMillis() + 4 * 24 * 60 * 60 * 1000
      );

      // Query users scheduled for deletion in ~3 days
      // (between 3 and 4 days from now to avoid duplicate notifications)
      const usersSnapshot = await db
        .collection('users')
        .where('scheduledForDeletionAt', '>=', threeDaysFromNow)
        .where('scheduledForDeletionAt', '<', threeDaysFromNowEnd)
        .get();

      if (usersSnapshot.empty) {
        logger.info('sendDeletionReminderNotification: No users approaching deletion');
        return null;
      }

      logger.info('sendDeletionReminderNotification: Found users', {
        count: usersSnapshot.size,
      });

      let sentCount = 0;
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const fcmToken = userData.fcmToken;

        if (!fcmToken) {
          logger.debug('sendDeletionReminderNotification: No FCM token', {
            userId: userDoc.id,
          });
          continue;
        }

        // Send reminder notification
        const title = '⚠️ Account Deletion Reminder';
        const body =
          "Your account will be permanently deleted in 3 days. Log in to cancel if you've changed your mind.";

        await sendPushNotification(
          fcmToken,
          title,
          body,
          {
            type: 'deletion_reminder',
          },
          userDoc.id
        );

        sentCount++;
      }

      logger.info('sendDeletionReminderNotification: Complete', {
        found: usersSnapshot.size,
        sent: sentCount,
      });

      return { found: usersSnapshot.size, sent: sentCount };
    } catch (error) {
      logger.error('sendDeletionReminderNotification: Error', { error: error.message });
      return null;
    }
  });

/**
 * Process scheduled account deletions
 * Runs daily at 3 AM UTC to find and delete accounts past their scheduled date
 * Uses the same deletion cascade as deleteUserAccount
 */
exports.processScheduledDeletions = functions
  .runWith({ memory: '512MB', timeoutSeconds: 300 })
  .pubsub.schedule('0 3 * * *') // 3 AM UTC daily
  .onRun(async context => {
    const { getStorage } = require('firebase-admin/storage');
    const bucket = getStorage().bucket();
    const now = admin.firestore.Timestamp.now();

    logger.info('processScheduledDeletions: Starting scheduled deletion check', {
      checkTime: now.toDate(),
    });

    try {
      // Query users where scheduledForDeletionAt has passed
      const usersSnapshot = await db
        .collection('users')
        .where('scheduledForDeletionAt', '<=', now)
        .get();

      if (usersSnapshot.empty) {
        logger.info('processScheduledDeletions: No users scheduled for deletion');
        return { processed: 0, deleted: 0, failed: 0 };
      }

      logger.info('processScheduledDeletions: Found users to delete', {
        count: usersSnapshot.size,
      });

      let deleted = 0;
      let failed = 0;

      // Process each user
      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        logger.info('processScheduledDeletions: Processing user', { userId });

        try {
          // Step 1: Delete Storage files (photos)
          const photosSnapshot = await db.collection('photos').where('userId', '==', userId).get();
          logger.debug('processScheduledDeletions: Found photos to delete', {
            userId,
            count: photosSnapshot.size,
          });

          for (const doc of photosSnapshot.docs) {
            const photoData = doc.data();
            if (photoData.imageURL) {
              try {
                const decodedUrl = decodeURIComponent(photoData.imageURL);
                const pathMatch = decodedUrl.match(/\/o\/(.+?)\?/);
                if (pathMatch) {
                  await bucket.file(pathMatch[1]).delete();
                }
              } catch (storageError) {
                logger.warn('processScheduledDeletions: Storage file deletion failed', {
                  userId,
                  error: storageError.message,
                });
              }
            }
          }

          // Step 2: Delete photos from Firestore
          const photoBatch = db.batch();
          photosSnapshot.docs.forEach(doc => photoBatch.delete(doc.ref));
          if (photosSnapshot.size > 0) {
            await photoBatch.commit();
          }

          // Step 3: Delete friendships (user1Id)
          const friendships1 = await db
            .collection('friendships')
            .where('user1Id', '==', userId)
            .get();
          const friendship1Batch = db.batch();
          friendships1.docs.forEach(doc => friendship1Batch.delete(doc.ref));
          if (friendships1.size > 0) {
            await friendship1Batch.commit();
          }

          // Step 4: Delete friendships (user2Id)
          const friendships2 = await db
            .collection('friendships')
            .where('user2Id', '==', userId)
            .get();
          const friendship2Batch = db.batch();
          friendships2.docs.forEach(doc => friendship2Batch.delete(doc.ref));
          if (friendships2.size > 0) {
            await friendship2Batch.commit();
          }

          // Step 5: Delete darkroom document
          const darkroomRef = db.doc(`darkrooms/${userId}`);
          const darkroomDoc = await darkroomRef.get();
          if (darkroomDoc.exists) {
            await darkroomRef.delete();
          }

          // Step 6: Delete user document
          await db.doc(`users/${userId}`).delete();

          // Step 7: Delete Firebase Auth user
          await admin.auth().deleteUser(userId);

          logger.info('processScheduledDeletions: Account permanently deleted', { userId });
          deleted++;
        } catch (userError) {
          logger.error('processScheduledDeletions: Failed to delete user', {
            userId,
            error: userError.message,
          });
          failed++;
          // Continue to next user - don't let one failure stop others
        }
      }

      logger.info('processScheduledDeletions: Completed', {
        processed: usersSnapshot.size,
        deleted,
        failed,
      });

      return { processed: usersSnapshot.size, deleted, failed };
    } catch (error) {
      logger.error('processScheduledDeletions: Fatal error', { error: error.message });
      return null;
    }
  });

/**
 * Process scheduled photo deletions
 * Runs daily at 3:15 AM UTC to permanently delete photos past their 30-day grace period
 * Offset from account deletion (3 AM) to avoid resource contention
 */
exports.processScheduledPhotoDeletions = functions
  .runWith({ memory: '512MB', timeoutSeconds: 300 })
  .pubsub.schedule('15 3 * * *') // 3:15 AM UTC daily
  .onRun(async context => {
    const { getStorage } = require('firebase-admin/storage');
    const bucket = getStorage().bucket();
    const now = admin.firestore.Timestamp.now();

    logger.info('processScheduledPhotoDeletions: Starting', { checkTime: now.toDate() });

    try {
      // Query photos where scheduledForPermanentDeletionAt has passed
      const photosSnapshot = await db
        .collection('photos')
        .where('photoState', '==', 'deleted')
        .where('scheduledForPermanentDeletionAt', '<=', now)
        .get();

      if (photosSnapshot.empty) {
        logger.info('processScheduledPhotoDeletions: No photos to delete');
        return { processed: 0, deleted: 0, failed: 0 };
      }

      logger.info('processScheduledPhotoDeletions: Found photos', {
        count: photosSnapshot.size,
      });

      let deleted = 0;
      let failed = 0;

      for (const photoDoc of photosSnapshot.docs) {
        const photoId = photoDoc.id;
        const photoData = photoDoc.data();
        const userId = photoData.userId;

        try {
          // Collect all Firestore operations, then commit atomically
          const operations = []; // Array of { ref, type, data? }

          // Step 1: Remove from user's albums
          const albumsSnapshot = await db.collection('albums').where('userId', '==', userId).get();

          for (const albumDoc of albumsSnapshot.docs) {
            const albumData = albumDoc.data();
            if (albumData.photoIds && albumData.photoIds.includes(photoId)) {
              if (albumData.photoIds.length === 1) {
                // Last photo - delete album
                operations.push({ ref: albumDoc.ref, type: 'delete' });
              } else {
                // Remove photo from album
                const newPhotoIds = albumData.photoIds.filter(id => id !== photoId);
                const updateData = { photoIds: newPhotoIds };
                // Update cover if needed
                if (albumData.coverPhotoId === photoId && newPhotoIds.length > 0) {
                  updateData.coverPhotoId = newPhotoIds[0];
                }
                operations.push({ ref: albumDoc.ref, type: 'update', data: updateData });
              }
            }
          }

          // Step 2: Collect comment and like deletes
          const commentsSnapshot = await db
            .collection('photos')
            .doc(photoId)
            .collection('comments')
            .get();

          for (const commentDoc of commentsSnapshot.docs) {
            // Collect comment likes for deletion
            const likesSnapshot = await commentDoc.ref.collection('likes').get();
            for (const likeDoc of likesSnapshot.docs) {
              operations.push({ ref: likeDoc.ref, type: 'delete' });
            }
            operations.push({ ref: commentDoc.ref, type: 'delete' });
          }

          // Step 3: Delete photo document itself
          operations.push({ ref: photoDoc.ref, type: 'delete' });

          // Commit Firestore operations atomically in batches (max 400 per batch for safety)
          const BATCH_LIMIT = 400;
          for (let i = 0; i < operations.length; i += BATCH_LIMIT) {
            const batchOps = operations.slice(i, i + BATCH_LIMIT);
            const batch = db.batch();
            for (const op of batchOps) {
              if (op.type === 'delete') {
                batch.delete(op.ref);
              } else if (op.type === 'update') {
                batch.update(op.ref, op.data);
              }
            }
            await batch.commit();
          }

          logger.debug('processScheduledPhotoDeletions: Firestore batch committed', {
            photoId,
            operationCount: operations.length,
          });

          // Step 4: Storage cleanup (best-effort AFTER Firestore success)
          if (photoData.imageURL) {
            try {
              const decodedUrl = decodeURIComponent(photoData.imageURL);
              const pathMatch = decodedUrl.match(/\/o\/(.+?)\?/);
              if (pathMatch) {
                await bucket.file(pathMatch[1]).delete();
              }
            } catch (storageError) {
              logger.error(
                'processScheduledPhotoDeletions: Storage cleanup failed - orphaned file',
                {
                  photoId,
                  userId,
                  error: storageError.message,
                }
              );
              // Continue — Firestore data already cleaned up
            }
          }

          logger.debug('processScheduledPhotoDeletions: Photo deleted', { photoId });
          deleted++;
        } catch (photoError) {
          logger.error('processScheduledPhotoDeletions: Failed to delete photo', {
            photoId,
            error: photoError.message,
          });
          failed++;
          // Continue to next photo
        }
      }

      logger.info('processScheduledPhotoDeletions: Completed', {
        processed: photosSnapshot.size,
        deleted,
        failed,
      });

      return { processed: photosSnapshot.size, deleted, failed };
    } catch (error) {
      logger.error('processScheduledPhotoDeletions: Fatal error', { error: error.message });
      return null;
    }
  });

/**
 * Clean up old notification batches and in-app notifications
 * Runs daily at 2 AM UTC to prevent storage accumulation
 * - Deletes reactionBatches with status='sent' older than 7 days
 * - Deletes notifications older than 30 days
 * Uses batched writes to handle large volumes efficiently
 */
exports.cleanupOldNotifications = functions
  .runWith({ memory: '256MB', timeoutSeconds: 120 })
  .pubsub.schedule('0 2 * * *') // 2 AM UTC daily
  .onRun(async _context => {
    const now = admin.firestore.Timestamp.now();
    const sevenDaysAgo = new Date(now.toMillis() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.toMillis() - 30 * 24 * 60 * 60 * 1000);

    logger.info('cleanupOldNotifications: Starting cleanup', {
      checkTime: now.toDate(),
      sevenDaysAgo,
      thirtyDaysAgo,
    });

    let totalDeleted = 0;

    try {
      // Step 1: Clean up old reaction batches (7 days retention)
      logger.debug('cleanupOldNotifications: Querying old reactionBatches');

      const batchesSnapshot = await db
        .collection('reactionBatches')
        .where('status', '==', 'sent')
        .where('sentAt', '<', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
        .limit(500) // Process in chunks to avoid timeouts
        .get();

      if (!batchesSnapshot.empty) {
        logger.info('cleanupOldNotifications: Found old reactionBatches', {
          count: batchesSnapshot.size,
        });

        const batchDelete = db.batch();
        batchesSnapshot.docs.forEach(doc => batchDelete.delete(doc.ref));
        await batchDelete.commit();

        totalDeleted += batchesSnapshot.size;

        logger.info('cleanupOldNotifications: Deleted old reactionBatches', {
          deleted: batchesSnapshot.size,
        });
      } else {
        logger.debug('cleanupOldNotifications: No old reactionBatches to delete');
      }

      // Step 2: Clean up old in-app notifications (30 days retention)
      logger.debug('cleanupOldNotifications: Querying old notifications');

      const notificationsSnapshot = await db
        .collection('notifications')
        .where('createdAt', '<', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
        .limit(500) // Process in chunks
        .get();

      if (!notificationsSnapshot.empty) {
        logger.info('cleanupOldNotifications: Found old notifications', {
          count: notificationsSnapshot.size,
        });

        const notifBatch = db.batch();
        notificationsSnapshot.docs.forEach(doc => notifBatch.delete(doc.ref));
        await notifBatch.commit();

        totalDeleted += notificationsSnapshot.size;

        logger.info('cleanupOldNotifications: Deleted old notifications', {
          deleted: notificationsSnapshot.size,
        });
      } else {
        logger.debug('cleanupOldNotifications: No old notifications to delete');
      }

      logger.info('cleanupOldNotifications: Completed successfully', {
        totalDeleted,
      });

      return {
        success: true,
        batchesDeleted: batchesSnapshot.size,
        notificationsDeleted: notificationsSnapshot.size,
        totalDeleted,
      };
    } catch (error) {
      logger.error('cleanupOldNotifications: Fatal error', {
        error: error.message,
        stack: error.stack,
      });
      return { success: false, error: error.message };
    }
  });

/**
 * Increment friendCount on both users when a friendship is accepted
 * Triggers on friendship document update (pending → accepted)
 */
exports.incrementFriendCountOnAccept = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .firestore.document('friendships/{friendshipId}')
  .onUpdate(async change => {
    try {
      const before = change.before.data();
      const after = change.after.data();

      if (!before || !after) return null;
      if (before.status === 'accepted' || after.status !== 'accepted') return null;

      const { user1Id, user2Id } = after;
      if (!user1Id || !user2Id) return null;

      const increment = admin.firestore.FieldValue.increment(1);
      await Promise.all([
        db.collection('users').doc(user1Id).update({ friendCount: increment }),
        db.collection('users').doc(user2Id).update({ friendCount: increment }),
      ]);

      logger.info('incrementFriendCountOnAccept: Updated counts', { user1Id, user2Id });
      return null;
    } catch (error) {
      logger.error('incrementFriendCountOnAccept: Error', { error: error.message });
      return null;
    }
  });

/**
 * Decrement friendCount on both users when an accepted friendship is deleted
 * Triggers on friendship document deletion
 */
exports.decrementFriendCountOnRemove = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .firestore.document('friendships/{friendshipId}')
  .onDelete(async snapshot => {
    try {
      const data = snapshot.data();
      if (!data) return null;

      // Only decrement if the deleted friendship was accepted
      if (data.status !== 'accepted') return null;

      const { user1Id, user2Id } = data;
      if (!user1Id || !user2Id) return null;

      const decrement = admin.firestore.FieldValue.increment(-1);
      await Promise.all([
        db.collection('users').doc(user1Id).update({ friendCount: decrement }),
        db.collection('users').doc(user2Id).update({ friendCount: decrement }),
      ]);

      logger.info('decrementFriendCountOnRemove: Updated counts', { user1Id, user2Id });
      return null;
    } catch (error) {
      logger.error('decrementFriendCountOnRemove: Error', { error: error.message });
      return null;
    }
  });

/**
 * One-time migration: backfill friendCount on all user documents
 * Counts accepted friendships for each user and writes the count
 * Call via: firebase functions:call backfillFriendCounts
 */
exports.backfillFriendCounts = onCall({ memory: '512MiB', timeoutSeconds: 300 }, async request => {
  try {
    // Count accepted friendships per user
    const friendshipsSnapshot = await db
      .collection('friendships')
      .where('status', '==', 'accepted')
      .get();

    const counts = {};
    friendshipsSnapshot.forEach(doc => {
      const data = doc.data();
      counts[data.user1Id] = (counts[data.user1Id] || 0) + 1;
      counts[data.user2Id] = (counts[data.user2Id] || 0) + 1;
    });

    // Batch update user documents
    const userIds = Object.keys(counts);
    const batchSize = 500;
    let updated = 0;

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = db.batch();
      const chunk = userIds.slice(i, i + batchSize);

      chunk.forEach(userId => {
        batch.update(db.collection('users').doc(userId), {
          friendCount: counts[userId],
        });
      });

      await batch.commit();
      updated += chunk.length;
    }

    logger.info('backfillFriendCounts: Complete', {
      friendships: friendshipsSnapshot.size,
      usersUpdated: updated,
    });

    return { success: true, usersUpdated: updated };
  } catch (error) {
    logger.error('backfillFriendCounts: Error', { error: error.message });
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Email user reports to support address
 * Triggered when new report document is created in reports/ collection
 * Sends formatted email with report details to configured support address
 * Email failure is logged but doesn't prevent report submission (already in Firestore)
 */
exports.onReportCreated = functions.firestore
  .document('reports/{reportId}')
  .onCreate(async (snapshot, context) => {
    const report = snapshot.data();
    const reportId = context.params.reportId;

    const subject = `[REPORT] ${report.reason} — ${report.profileSnapshot?.username || 'Unknown user'}`;

    const body = `
New Report Submitted
====================

Report ID: ${reportId}
Date: ${new Date().toISOString()}

Reporter: ${report.reporterId}
Reported User: ${report.reportedUserId}
  Username: ${report.profileSnapshot?.username || 'N/A'}
  Display Name: ${report.profileSnapshot?.displayName || 'N/A'}

Reason: ${report.reason}
Details: ${report.details || 'No additional details provided'}

---
View in Firebase Console:
https://console.firebase.google.com/project/${process.env.GCLOUD_PROJECT}/firestore/data/reports/${reportId}
    `.trim();

    try {
      const transporter = getTransporter();
      await transporter.sendMail({
        from: `"Flick Reports" <${process.env.SMTP_EMAIL}>`,
        to: process.env.SUPPORT_EMAIL,
        subject,
        text: body,
      });
      logger.info('Report email sent', { reportId, reason: report.reason });
    } catch (error) {
      logger.error('Failed to send report email', { reportId, error: error.message });
      // Don't throw — the report is already saved in Firestore.
      // Email failure shouldn't prevent report submission.
    }
  });
