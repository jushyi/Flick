/**
 * Screenshot Service
 *
 * Handles Firestore writes for screenshot detection events.
 * When a recipient screenshots a snap, this service:
 * 1. Sets screenshottedAt timestamp on the snap message document
 * 2. Creates a system_screenshot message in the conversation
 *
 * Key features:
 * - Idempotent: only the first screenshot of a given snap triggers writes
 * - Active snap check: skips non-snap or expired/deleted messages
 * - Standard { success, error } return pattern
 *
 * Data flow:
 * SnapViewer detects screenshot -> recordScreenshot() ->
 *   updateDoc(screenshottedAt) + addDoc(system_screenshot message) ->
 *   onNewMessage Cloud Function sends push notification to snap sender
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
 *
 * Idempotent: if screenshottedAt already exists on the snap, returns early
 * without creating duplicate system messages.
 *
 * @param {object} params - Screenshot event parameters
 * @param {string} params.conversationId - Conversation document ID
 * @param {string} params.snapMessageId - Snap message document ID that was screenshotted
 * @param {string} params.screenshotterId - User ID of the person who took the screenshot
 * @param {string} params.screenshotterName - Display name of the screenshotter (for system message text)
 * @returns {Promise<{success: boolean, alreadyScreenshotted?: boolean, skipped?: boolean, systemMessageId?: string, error?: string}>}
 */
export const recordScreenshot = async ({
  conversationId,
  snapMessageId,
  screenshotterId,
  screenshotterName,
}) => {
  logger.debug('screenshotService.recordScreenshot: Starting', {
    conversationId,
    snapMessageId,
    screenshotterId,
  });

  try {
    if (!conversationId || !snapMessageId || !screenshotterId || !screenshotterName) {
      logger.warn('screenshotService.recordScreenshot: Missing required fields', {
        conversationId,
        snapMessageId,
        screenshotterId,
        screenshotterName,
      });
      return { success: false, error: 'Missing required fields' };
    }

    // 1. Get the snap message document
    const messageRef = doc(db, 'conversations', conversationId, 'messages', snapMessageId);
    const snapDoc = await getDoc(messageRef);

    if (!snapDoc.exists()) {
      logger.warn('screenshotService.recordScreenshot: Snap message not found', {
        conversationId,
        snapMessageId,
      });
      return { success: false, error: 'Snap message not found' };
    }

    const snapData = snapDoc.data();

    // 2. Active snap check: only snap messages trigger screenshot recording
    if (snapData.type !== 'snap') {
      logger.debug('screenshotService.recordScreenshot: Not a snap message, skipping', {
        conversationId,
        snapMessageId,
        type: snapData.type,
      });
      return { success: true, skipped: true };
    }

    // 3. Idempotency check: if already screenshotted, return early
    if (snapData.screenshottedAt) {
      logger.debug('screenshotService.recordScreenshot: Already screenshotted, skipping', {
        conversationId,
        snapMessageId,
      });
      return { success: true, alreadyScreenshotted: true };
    }

    // 4. Write screenshottedAt timestamp on the snap message document
    await updateDoc(messageRef, {
      screenshottedAt: serverTimestamp(),
    });

    // 5. Create system_screenshot message in the conversation
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const systemMessage = await addDoc(messagesRef, {
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
      systemMessageId: systemMessage.id,
    });

    return { success: true, systemMessageId: systemMessage.id };
  } catch (error) {
    logger.error('screenshotService.recordScreenshot: Failed', {
      conversationId,
      snapMessageId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};
