const functions = require('firebase-functions');
const admin = require('firebase-admin');
const logger = require('./logger');
const {
  validateOrNull,
  DarkroomDocSchema,
  PhotoDocSchema,
  FriendshipDocSchema,
  UserDocSchema,
  SignedUrlRequestSchema,
} = require('./validation');
const { getStorage } = require('firebase-admin/storage');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

// Initialize Firebase Admin SDK
admin.initializeApp();

// Track pending reactions for debouncing: { "photoId_reactorId": { timeout, reactions, photoOwnerId, fcmToken, reactorName, reactorProfilePhotoURL } }
const pendingReactions = {};

// Debounce window in milliseconds (10 seconds)
const REACTION_DEBOUNCE_MS = 10000;

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
  const photosSnapshot = await admin
    .firestore()
    .collection('photos')
    .where('userId', '==', userId)
    .where('status', '==', 'developing')
    .get();

  if (photosSnapshot.empty) {
    logger.info(`revealUserPhotos: No developing photos for user ${userId}`);
  } else {
    logger.info(`revealUserPhotos: Revealing ${photosSnapshot.size} photos for user ${userId}`);

    // Update all photos to revealed
    const batch = admin.firestore().batch();
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
  await admin.firestore().collection('darkrooms').doc(userId).update({
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
 * Cloud Function: Process darkroom reveals on schedule
 * Runs every 2 minutes to check all darkrooms and reveal overdue photos
 * This ensures photos reveal at scheduled time even when app is closed
 */
exports.processDarkroomReveals = functions.pubsub
  .schedule('every 2 minutes')
  .onRun(async context => {
    try {
      const now = admin.firestore.Timestamp.now();
      logger.info('processDarkroomReveals: Starting scheduled reveal check at', now.toDate());

      // Query all darkrooms where nextRevealAt has passed
      const darkroomsSnapshot = await admin
        .firestore()
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
 * Send push notification to a user via Expo Push Token
 * @param {string} fcmToken - User's Expo Push Token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data payload for deep linking
 * @returns {Promise<object>} - Result of notification send
 */
async function sendPushNotification(fcmToken, title, body, data = {}) {
  try {
    // Expo push tokens start with "ExponentPushToken["
    if (!fcmToken || !fcmToken.startsWith('ExponentPushToken[')) {
      logger.error('sendPushNotification: Invalid Expo Push Token:', fcmToken);
      return { success: false, error: 'Invalid token format' };
    }

    // For Expo push tokens, we use the Expo Push Notification service
    // The token is already in the correct format
    const message = {
      to: fcmToken,
      sound: 'default',
      title: title,
      body: body,
      data: data,
      priority: 'high',
      channelId: 'default',
    };

    // Send notification via Expo's push notification service
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const responseData = await response.json();
    logger.debug('sendPushNotification: Expo push notification sent:', responseData);

    return { success: true, data: responseData };
  } catch (error) {
    logger.error('sendPushNotification: Error sending push notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cloud Function: Send notification when photos are revealed in darkroom
 * Triggered when darkroom document is updated with new revealedAt timestamp
 *
 * IMPORTANT: Uses lastNotifiedAt to ensure only ONE notification per reveal batch.
 * This prevents spam when the scheduled function runs frequently.
 */
exports.sendPhotoRevealNotification = functions.firestore
  .document('darkrooms/{userId}')
  .onUpdate(async (change, context) => {
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

      const photosSnapshot = await admin
        .firestore()
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
        await admin.firestore().collection('darkrooms').doc(userId).update({
          lastNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return null;
      }

      // Get user's FCM token
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
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

      // Send notification with reveal data
      const title = '📸 Photos Ready!';
      const body =
        photosRevealed === 1
          ? 'Your photo is ready to view in the darkroom'
          : `${photosRevealed} photos are ready to view in the darkroom`;

      const result = await sendPushNotification(fcmToken, title, body, {
        type: 'photo_reveal',
        revealedCount: String(photosRevealed),
        revealAll: 'true',
      });

      // Update lastNotifiedAt AFTER successfully sending notification
      await admin.firestore().collection('darkrooms').doc(userId).update({
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
exports.sendFriendRequestNotification = functions.firestore
  .document('friendships/{friendshipId}')
  .onCreate(async (snap, context) => {
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
      const recipientDoc = await admin.firestore().collection('users').doc(recipientId).get();

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

      // Get sender's display name
      const senderDoc = await admin.firestore().collection('users').doc(requestedBy).get();

      const senderName = senderDoc.exists
        ? senderDoc.data().displayName || senderDoc.data().username
        : 'Someone';

      // Send notification
      const title = '👋 Friend Request';
      const body = `${senderName} sent you a friend request`;

      const result = await sendPushNotification(fcmToken, title, body, {
        type: 'friend_request',
        friendshipId: friendshipId,
      });

      logger.debug('sendFriendRequestNotification: Notification sent to:', recipientId, result);
      return result;
    } catch (error) {
      logger.error('sendFriendRequestNotification: Error:', error);
      return null;
    }
  });

/**
 * Send the batched reaction notification after debounce window expires
 * @param {string} pendingKey - Key in pendingReactions object
 */
async function sendBatchedReactionNotification(pendingKey) {
  const pending = pendingReactions[pendingKey];
  if (!pending) {
    logger.debug('sendBatchedReactionNotification: No pending entry found for', pendingKey);
    return;
  }

  const {
    reactions,
    photoOwnerId,
    fcmToken,
    reactorName,
    reactorId,
    reactorProfilePhotoURL,
    photoId,
  } = pending;

  // Delete pending entry immediately to prevent duplicate sends
  delete pendingReactions[pendingKey];

  const reactionSummary = formatReactionSummary(reactions);
  if (!reactionSummary) {
    logger.debug('sendBatchedReactionNotification: No reactions to send for', pendingKey);
    return;
  }

  const title = '❤️ New Reaction';
  const body = `${reactorName} reacted ${reactionSummary} to your photo`;

  logger.debug('sendBatchedReactionNotification: Sending batched notification', {
    pendingKey,
    reactorName,
    reactions,
    body,
  });

  // Send push notification
  const result = await sendPushNotification(fcmToken, title, body, {
    type: 'reaction',
    photoId: photoId,
  });

  // Write to notifications collection for in-app display
  await admin
    .firestore()
    .collection('notifications')
    .add({
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

  logger.debug('sendBatchedReactionNotification: Notification sent and stored', {
    pendingKey,
    result,
  });
}

/**
 * Cloud Function: Send notification when someone reacts to user's photo
 * Triggered when photo document is updated with new reactions
 *
 * DEBOUNCING: Batches rapid reactions from same user into single notification
 * - First reaction starts 10-second window
 * - Subsequent reactions extend window and aggregate
 * - After 10 seconds of inactivity, sends "Name reacted 😂×2 ❤️×1 to your photo"
 */
exports.sendReactionNotification = functions.firestore
  .document('photos/{photoId}')
  .onUpdate(async (change, context) => {
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
        hasPendingEntry: !!pendingReactions[pendingKey],
      });

      // Check if we already have a pending entry for this key
      if (pendingReactions[pendingKey]) {
        // Clear existing timeout
        clearTimeout(pendingReactions[pendingKey].timeout);

        // Merge new reactions into existing batch
        for (const [emoji, count] of Object.entries(reactionDiff)) {
          pendingReactions[pendingKey].reactions[emoji] =
            (pendingReactions[pendingKey].reactions[emoji] || 0) + count;
        }

        logger.debug('sendReactionNotification: Extended debounce window', {
          pendingKey,
          mergedReactions: pendingReactions[pendingKey].reactions,
        });

        // Set new timeout
        pendingReactions[pendingKey].timeout = setTimeout(
          () => sendBatchedReactionNotification(pendingKey),
          REACTION_DEBOUNCE_MS
        );

        return null;
      }

      // New pending entry - fetch user data
      // Get photo owner's FCM token
      const ownerDoc = await admin.firestore().collection('users').doc(photoOwnerId).get();

      if (!ownerDoc.exists) {
        logger.error('sendReactionNotification: Photo owner not found:', photoOwnerId);
        return null;
      }

      const ownerData = ownerDoc.data();
      const fcmToken = ownerData.fcmToken;

      if (!fcmToken) {
        logger.debug(
          'sendReactionNotification: Photo owner has no FCM token, skipping:',
          photoOwnerId
        );
        return null;
      }

      // Get reactor's display name and profile photo
      const reactorDoc = await admin.firestore().collection('users').doc(reactorId).get();

      const reactorData = reactorDoc.exists ? reactorDoc.data() : {};
      const reactorName = reactorData.displayName || reactorData.username || 'Someone';
      const reactorProfilePhotoURL = reactorData.profilePhotoURL || null;

      // Create new pending entry
      pendingReactions[pendingKey] = {
        reactions: { ...reactionDiff },
        photoOwnerId,
        fcmToken,
        reactorId,
        reactorName,
        reactorProfilePhotoURL,
        photoId,
        timeout: setTimeout(
          () => sendBatchedReactionNotification(pendingKey),
          REACTION_DEBOUNCE_MS
        ),
      };

      logger.debug('sendReactionNotification: Started new debounce window', {
        pendingKey,
        reactions: reactionDiff,
        debounceMs: REACTION_DEBOUNCE_MS,
      });

      return null;
    } catch (error) {
      logger.error('sendReactionNotification: Error:', error);
      return null;
    }
  });

/**
 * Cloud Function: Generate a signed URL for secure photo access
 * Callable function that requires authentication
 *
 * Uses v4 signing with 24-hour expiration. Even if a URL leaks,
 * it becomes invalid after 24 hours.
 */
exports.getSignedPhotoUrl = onCall(async request => {
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
  logger.info('getSignedPhotoUrl: Generating signed URL', { userId, photoPath });

  try {
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
 * Only sends notifications for top-level comments to photo owner.
 * Skips self-comments (commenter is photo owner) and replies.
 */
exports.sendCommentNotification = functions.firestore
  .document('photos/{photoId}/comments/{commentId}')
  .onCreate(async (snap, context) => {
    const { photoId, commentId } = context.params;
    const comment = snap.data();

    try {
      // Guard: validate comment data
      if (!comment || typeof comment !== 'object') {
        logger.warn('sendCommentNotification: Invalid comment data', { photoId, commentId });
        return null;
      }

      // Skip notifications for replies (only notify on top-level comments)
      if (comment.parentId) {
        logger.info('sendCommentNotification: Skipping notification for reply', {
          photoId,
          commentId,
          parentId: comment.parentId,
        });
        return null;
      }

      // Get photo to find owner
      const photoDoc = await admin.firestore().collection('photos').doc(photoId).get();

      if (!photoDoc.exists) {
        logger.warn('sendCommentNotification: Photo not found', { photoId });
        return null;
      }

      const photo = photoDoc.data();
      const photoOwnerId = photo.userId;

      // Don't notify if commenter is the photo owner (self-comment)
      if (comment.userId === photoOwnerId) {
        logger.info('sendCommentNotification: Skipping self-comment notification', {
          photoId,
          commentId,
          userId: comment.userId,
        });
        return null;
      }

      // Get photo owner's FCM token
      const ownerDoc = await admin.firestore().collection('users').doc(photoOwnerId).get();

      if (!ownerDoc.exists || !ownerDoc.data().fcmToken) {
        logger.warn('sendCommentNotification: No FCM token for photo owner', { photoOwnerId });
        return null;
      }

      // Get commenter's name for notification
      const commenterDoc = await admin.firestore().collection('users').doc(comment.userId).get();

      const commenterName = commenterDoc.exists
        ? commenterDoc.data().displayName || commenterDoc.data().username || 'Someone'
        : 'Someone';

      // Build comment preview for notification body
      let commentPreview;
      if (comment.text && comment.text.trim()) {
        // Truncate text to 50 chars
        const truncatedText = comment.text.substring(0, 50);
        commentPreview = truncatedText + (comment.text.length > 50 ? '...' : '');
      } else if (comment.mediaType === 'gif') {
        commentPreview = 'sent a GIF';
      } else if (comment.mediaType === 'image') {
        commentPreview = 'sent a photo';
      } else {
        commentPreview = 'commented';
      }

      // Send notification via Expo Push API
      const title = '💬 New Comment';
      const body = `${commenterName}: ${commentPreview}`;

      const result = await sendPushNotification(ownerDoc.data().fcmToken, title, body, {
        type: 'comment',
        photoId,
        commentId,
        screen: 'Feed',
      });

      // Write to notifications collection for in-app display
      await admin
        .firestore()
        .collection('notifications')
        .add({
          recipientId: photoOwnerId,
          type: 'comment',
          senderId: comment.userId,
          senderName: commenterName,
          senderProfilePhotoURL: commenterDoc.exists ? commenterDoc.data().profilePhotoURL : null,
          photoId: photoId,
          commentId: commentId,
          message: body,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          read: false,
        });

      logger.info('sendCommentNotification: Notification sent', {
        photoId,
        commentId,
        to: photoOwnerId,
        commenter: comment.userId,
      });

      return result;
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
exports.deleteUserAccount = onCall({ cors: true }, async request => {
  // Require authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated to delete account');
  }

  const userId = request.auth.uid;
  logger.info('deleteUserAccount: Starting deletion', { userId });

  try {
    const db = admin.firestore();
    const bucket = getStorage().bucket();

    // Step 1: Get all user's photos and delete Storage files
    const photosSnapshot = await db.collection('photos').where('userId', '==', userId).get();
    logger.info('deleteUserAccount: Found photos to delete', { count: photosSnapshot.size });

    for (const doc of photosSnapshot.docs) {
      const photoData = doc.data();
      if (photoData.imageURL) {
        try {
          // Extract path from Firebase Storage URL
          const decodedUrl = decodeURIComponent(photoData.imageURL);
          const pathMatch = decodedUrl.match(/\/o\/(.+?)\?/);
          if (pathMatch) {
            await bucket.file(pathMatch[1]).delete();
            logger.debug('deleteUserAccount: Deleted storage file', { path: pathMatch[1] });
          }
        } catch (storageError) {
          // Log but continue - file may already be deleted
          logger.warn('deleteUserAccount: Storage file deletion failed', {
            error: storageError.message,
          });
        }
      }
    }

    // Step 2: Delete all photos from Firestore (batch, max 500)
    const photoBatch = db.batch();
    photosSnapshot.docs.forEach(doc => photoBatch.delete(doc.ref));
    if (photosSnapshot.size > 0) {
      await photoBatch.commit();
      logger.info('deleteUserAccount: Deleted photo documents', { count: photosSnapshot.size });
    }

    // Step 3: Delete friendships where user is user1Id
    const friendships1 = await db.collection('friendships').where('user1Id', '==', userId).get();
    const friendship1Batch = db.batch();
    friendships1.docs.forEach(doc => friendship1Batch.delete(doc.ref));
    if (friendships1.size > 0) {
      await friendship1Batch.commit();
      logger.info('deleteUserAccount: Deleted friendships (user1)', { count: friendships1.size });
    }

    // Step 4: Delete friendships where user is user2Id
    const friendships2 = await db.collection('friendships').where('user2Id', '==', userId).get();
    const friendship2Batch = db.batch();
    friendships2.docs.forEach(doc => friendship2Batch.delete(doc.ref));
    if (friendships2.size > 0) {
      await friendship2Batch.commit();
      logger.info('deleteUserAccount: Deleted friendships (user2)', { count: friendships2.size });
    }

    // Step 5: Delete darkroom document
    const darkroomRef = db.doc(`darkrooms/${userId}`);
    const darkroomDoc = await darkroomRef.get();
    if (darkroomDoc.exists) {
      await darkroomRef.delete();
      logger.info('deleteUserAccount: Deleted darkroom document');
    }

    // Step 6: Delete user document
    const userRef = db.doc(`users/${userId}`);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      await userRef.delete();
      logger.info('deleteUserAccount: Deleted user document');
    }

    // Step 7: Delete Firebase Auth user (LAST - after all data cleanup)
    await admin.auth().deleteUser(userId);
    logger.info('deleteUserAccount: Deleted auth user, account deletion complete', { userId });

    return { success: true };
  } catch (error) {
    logger.error('deleteUserAccount: Failed', { userId, error: error.message });
    throw new HttpsError('internal', 'Account deletion failed: ' + error.message);
  }
});

/**
 * Schedule user account for deletion after 30-day grace period
 * Sets scheduledForDeletionAt to 30 days from now
 * User is logged out after scheduling - if they log back in, they can cancel
 */
exports.scheduleUserAccountDeletion = onCall({ cors: true }, async request => {
  // Require authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated to schedule deletion');
  }

  const userId = request.auth.uid;
  logger.info('scheduleUserAccountDeletion: Scheduling deletion', { userId });

  try {
    const db = admin.firestore();

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
    throw new HttpsError('internal', 'Failed to schedule deletion: ' + error.message);
  }
});

/**
 * Cancel a scheduled account deletion
 * Clears scheduledForDeletionAt and deletionScheduledAt fields
 * Called when user logs back in during grace period and chooses to keep account
 */
exports.cancelUserAccountDeletion = onCall({ cors: true }, async request => {
  // Require authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated to cancel deletion');
  }

  const userId = request.auth.uid;
  logger.info('cancelUserAccountDeletion: Canceling scheduled deletion', { userId });

  try {
    const db = admin.firestore();

    // Clear deletion schedule fields
    await db.collection('users').doc(userId).update({
      scheduledForDeletionAt: admin.firestore.FieldValue.delete(),
      deletionScheduledAt: admin.firestore.FieldValue.delete(),
    });

    logger.info('cancelUserAccountDeletion: Scheduled deletion canceled', { userId });

    return { success: true };
  } catch (error) {
    logger.error('cancelUserAccountDeletion: Failed', { userId, error: error.message });
    throw new HttpsError('internal', 'Failed to cancel deletion: ' + error.message);
  }
});

/**
 * Process scheduled account deletions
 * Runs daily at 3 AM UTC to find and delete accounts past their scheduled date
 * Uses the same deletion cascade as deleteUserAccount
 */
exports.processScheduledDeletions = functions.pubsub
  .schedule('0 3 * * *') // 3 AM UTC daily
  .onRun(async context => {
    const db = admin.firestore();
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
