const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
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

  // Track whether this invocation created the batch (vs updating an existing one)
  let isNewBatch = false;

  await db.runTransaction(async transaction => {
    const batchDoc = await transaction.get(batchRef);

    if (batchDoc.exists) {
      const existingData = batchDoc.data();

      // If batch was already sent or is processing, create a fresh batch
      if (existingData.status === 'sent' || existingData.status === 'processing') {
        logger.debug('addReactionToBatch: Previous batch completed, creating fresh batch', {
          batchId,
          previousStatus: existingData.status,
        });

        transaction.set(batchRef, {
          photoId,
          reactorId,
          reactions,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          status: 'pending',
          taskScheduled: false,
        });
        isNewBatch = true;
        return;
      }

      // Batch exists and is pending - merge reactions
      const mergedReactions = { ...existingData.reactions };

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
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      // Create new batch
      logger.debug('addReactionToBatch: Creating new batch', {
        batchId,
        reactions,
      });

      transaction.set(batchRef, {
        photoId,
        reactorId,
        reactions,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        status: 'pending',
        taskScheduled: false,
      });
      isNewBatch = true;
    }
  });

  // Schedule Cloud Task only for new batches
  // Use atomic taskScheduled flag to prevent duplicate scheduling across instances
  if (isNewBatch) {
    const scheduled = await db.runTransaction(async transaction => {
      const batchDoc = await transaction.get(batchRef);
      const batchData = batchDoc.data();

      // Only schedule if no task has been scheduled yet (prevents race condition)
      if (batchData && batchData.taskScheduled === false) {
        transaction.update(batchRef, { taskScheduled: true });
        return true;
      }
      return false;
    });

    if (scheduled) {
      logger.debug('addReactionToBatch: Scheduling Cloud Task for new batch', { batchId });
      await scheduleNotificationTask(batchId, 30);
    } else {
      logger.debug('addReactionToBatch: Task already scheduled by another instance', { batchId });
    }
  }

  logger.debug('addReactionToBatch: Complete', { batchId, isNewBatch });
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

  // GCLOUD_PROJECT and GCP_PROJECT are deprecated in Node 18+ runtimes
  // Use FIREBASE_CONFIG (always available in Firebase Functions) as primary source
  const project =
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId;

  if (!project) {
    throw new Error('Could not determine project ID from environment variables');
  }

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
      oidcToken: {
        serviceAccountEmail: `${project}@appspot.gserviceaccount.com`,
      },
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
