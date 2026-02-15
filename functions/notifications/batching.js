const admin = require('firebase-admin');
const logger = require('../logger');

/**
 * Add a reaction to a Firestore batch for delayed notification sending
 * Uses transactions to ensure atomic updates across multiple Cloud Function instances
 *
 * @param {string} photoId - ID of the photo being reacted to
 * @param {string} reactorId - ID of the user reacting
 * @param {Object} reactions - Reaction diff object { emoji: count }
 * @returns {Promise<void>}
 */
async function addReactionToBatch(photoId, reactorId, reactions) {
  const db = admin.firestore();
  const batchId = `${photoId}_${reactorId}`;
  const batchRef = db.collection('reactionBatches').doc(batchId);

  logger.debug('addReactionToBatch: Starting transaction', {
    photoId,
    reactorId,
    batchId,
    reactions,
  });

  await db.runTransaction(async transaction => {
    const batchDoc = await transaction.get(batchRef);

    if (batchDoc.exists) {
      // Batch already exists - merge reactions and update timestamp
      const existingData = batchDoc.data();
      const mergedReactions = { ...existingData.reactions };

      // Merge new reactions with existing ones
      Object.keys(reactions).forEach(emoji => {
        mergedReactions[emoji] = (mergedReactions[emoji] || 0) + reactions[emoji];
      });

      logger.debug('addReactionToBatch: Updating existing batch', {
        batchId,
        existingReactions: existingData.reactions,
        newReactions: reactions,
        mergedReactions,
      });

      transaction.update(batchRef, {
        reactions: mergedReactions,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      // Create new batch with 30-second expiry
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30000); // 30 seconds from now

      logger.debug('addReactionToBatch: Creating new batch', {
        batchId,
        reactions,
        expiresAt,
      });

      transaction.set(batchRef, {
        photoId,
        reactorId,
        reactions,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt,
        status: 'pending',
      });

      // Schedule Cloud Task for delayed send (only for new batches)
      // This happens after transaction commits to avoid scheduling duplicate tasks
      logger.debug('addReactionToBatch: Scheduling Cloud Task for new batch', {
        batchId,
      });
    }
  });

  // Schedule task AFTER transaction commits (for new batches only)
  // Check if batch was just created by reading current status
  const batchDoc = await batchRef.get();
  const batchData = batchDoc.data();

  // Only schedule if batch was created in this invocation (createdAt ~= updatedAt)
  // This prevents duplicate task scheduling when updating existing batches
  if (batchData && batchData.createdAt && batchData.updatedAt) {
    const createdMs = batchData.createdAt.toMillis();
    const updatedMs = batchData.updatedAt.toMillis();

    // If timestamps are within 1 second, this is a new batch
    if (Math.abs(updatedMs - createdMs) < 1000) {
      logger.debug('addReactionToBatch: New batch detected, scheduling task', {
        batchId,
        createdAt: createdMs,
        updatedAt: updatedMs,
      });
      await scheduleNotificationTask(batchId, 30);
    } else {
      logger.debug('addReactionToBatch: Existing batch updated, skipping task scheduling', {
        batchId,
        createdAt: createdMs,
        updatedAt: updatedMs,
      });
    }
  }

  logger.debug('addReactionToBatch: Transaction complete', { batchId });
}

/**
 * Schedule a Cloud Task to send a batched notification after a delay
 * Uses Cloud Tasks for reliable delayed execution
 *
 * @param {string} batchId - ID of the batch to send (format: photoId_reactorId)
 * @param {number} delaySeconds - Delay in seconds before sending
 * @returns {Promise<void>}
 */
async function scheduleNotificationTask(batchId, delaySeconds) {
  // Initialize CloudTasksClient inside function to avoid cold start issues
  const { CloudTasksClient } = require('@google-cloud/tasks');
  const client = new CloudTasksClient();

  const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  const location = 'us-central1'; // Same as Cloud Functions region
  const queue = 'default';

  const parent = client.queuePath(project, location, queue);

  // Cloud Function URL for the handler (will be created in Task 2)
  const url = `https://${location}-${project}.cloudfunctions.net/sendBatchedNotification`;

  const scheduleTime = new Date(Date.now() + delaySeconds * 1000);

  const task = {
    httpRequest: {
      httpMethod: 'POST',
      url,
      headers: {
        'Content-Type': 'application/json',
      },
      body: Buffer.from(JSON.stringify({ batchId })).toString('base64'),
    },
    scheduleTime: {
      seconds: Math.floor(scheduleTime.getTime() / 1000),
    },
  };

  logger.debug('scheduleNotificationTask: Creating Cloud Task', {
    batchId,
    delaySeconds,
    scheduleTime,
    url,
    parent,
  });

  try {
    const [response] = await client.createTask({ parent, task });
    logger.debug('scheduleNotificationTask: Task created successfully', {
      batchId,
      taskName: response.name,
    });
  } catch (error) {
    logger.error('scheduleNotificationTask: Failed to create task', {
      batchId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

module.exports = {
  addReactionToBatch,
  scheduleNotificationTask,
};
