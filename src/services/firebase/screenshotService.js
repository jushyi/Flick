/**
 * Screenshot Service
 *
 * Handles Firestore writes for screenshot detection events.
 * Records screenshottedAt timestamp on snap message documents and creates
 * system_screenshot messages in conversation subcollections.
 *
 * Used by screenshotQueueService for offline retry of failed writes.
 */

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';

import logger from '../../utils/logger';

const db = getFirestore();

/**
 * Record a screenshot event on a snap message.
 * Writes screenshottedAt timestamp and creates a system_screenshot message.
 * Idempotent: only the first screenshot triggers writes.
 *
 * @param {Object} params
 * @param {string} params.conversationId - Conversation document ID
 * @param {string} params.snapMessageId - ID of the snap message that was screenshotted
 * @param {string} params.screenshotterId - User ID of the person who took the screenshot
 * @param {string} params.screenshotterName - Display name of the screenshotter
 * @returns {Promise<{success: boolean, alreadyScreenshotted?: boolean, skipped?: boolean, systemMessageId?: string, error?: string}>}
 */
export const recordScreenshot = async ({
  conversationId,
  snapMessageId,
  screenshotterId,
  screenshotterName,
}) => {
  try {
    // Step 1: Get reference to the snap message document
    const messageRef = doc(db, 'conversations', conversationId, 'messages', snapMessageId);

    // Step 2: Read the snap document
    const snapDoc = await getDoc(messageRef);

    if (!snapDoc.exists()) {
      logger.warn('screenshotService.recordScreenshot: Snap message not found', {
        conversationId,
        snapMessageId,
      });
      return { success: true, skipped: true };
    }

    const snapData = snapDoc.data();

    // Step 3: Idempotency check - if already screenshotted, return early
    if (snapData.screenshottedAt) {
      logger.debug('screenshotService.recordScreenshot: Already screenshotted, skipping', {
        conversationId,
        snapMessageId,
      });
      return { success: true, alreadyScreenshotted: true };
    }

    // Step 4: Active snap check - only snap type messages trigger screenshot recording
    if (snapData.type !== 'snap') {
      logger.debug('screenshotService.recordScreenshot: Not a snap message, skipping', {
        conversationId,
        snapMessageId,
        type: snapData.type,
      });
      return { success: true, skipped: true };
    }

    // Step 5: Write screenshottedAt timestamp on the snap message document
    await updateDoc(messageRef, {
      screenshottedAt: serverTimestamp(),
    });

    // Step 6: Create system message in the conversation
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const systemMessageDoc = await addDoc(messagesRef, {
      senderId: screenshotterId,
      type: 'system_screenshot',
      text: `${screenshotterName} screenshotted a snap`,
      screenshotterId: screenshotterId,
      snapMessageId: snapMessageId,
      gifUrl: null,
      imageUrl: null,
      createdAt: serverTimestamp(),
    });

    logger.info('screenshotService.recordScreenshot: Screenshot recorded', {
      conversationId,
      snapMessageId,
      screenshotterId,
      systemMessageId: systemMessageDoc.id,
    });

    return { success: true, systemMessageId: systemMessageDoc.id };
  } catch (error) {
    logger.error('screenshotService.recordScreenshot: Failed', {
      conversationId,
      snapMessageId,
      screenshotterId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};
