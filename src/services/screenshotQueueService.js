/**
 * Screenshot Queue Service
 *
 * Manages an offline queue for screenshot events using AsyncStorage.
 * When a screenshot event fails to write to Firestore (e.g., due to
 * network issues), the event is queued locally and retried when
 * connectivity returns.
 *
 * Mirrors the uploadQueueService.js pattern for persistence and retry.
 *
 * Queue item structure:
 * {
 *   conversationId: string,
 *   snapMessageId: string,
 *   screenshotterId: string,
 *   screenshotterName: string,
 *   retryCount: number,
 *   queuedAt: number (timestamp),
 * }
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { recordScreenshot } from './firebase/screenshotService';

import logger from '../utils/logger';

// =============================================================================
// CONSTANTS
// =============================================================================

const QUEUE_STORAGE_KEY = '@screenshotQueue';
const MAX_RETRIES = 3;

// =============================================================================
// QUEUE OPERATIONS
// =============================================================================

/**
 * Queue a screenshot event for later processing.
 * Called when the initial Firestore write fails (e.g., offline).
 *
 * @param {object} event - Screenshot event data
 * @param {string} event.conversationId - Conversation document ID
 * @param {string} event.snapMessageId - Snap message document ID
 * @param {string} event.screenshotterId - User ID of the screenshotter
 * @param {string} event.screenshotterName - Display name of the screenshotter
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const queueScreenshotEvent = async event => {
  try {
    const { conversationId, snapMessageId, screenshotterId, screenshotterName } = event;

    if (!conversationId || !snapMessageId || !screenshotterId || !screenshotterName) {
      logger.warn('screenshotQueueService.queueScreenshotEvent: Missing required fields', {
        conversationId,
        snapMessageId,
        screenshotterId,
      });
      return { success: false, error: 'Missing required fields' };
    }

    const existing = JSON.parse((await AsyncStorage.getItem(QUEUE_STORAGE_KEY)) || '[]');

    existing.push({
      conversationId,
      snapMessageId,
      screenshotterId,
      screenshotterName,
      retryCount: 0,
      queuedAt: Date.now(),
    });

    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(existing));

    logger.info('screenshotQueueService.queueScreenshotEvent: Event queued', {
      conversationId,
      snapMessageId,
      queueLength: existing.length,
    });

    return { success: true };
  } catch (error) {
    logger.error('screenshotQueueService.queueScreenshotEvent: Failed', {
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Process all queued screenshot events.
 * Iterates through the queue, attempts to write each event to Firestore
 * via recordScreenshot. On success, removes the event. On failure,
 * increments retryCount. Events exceeding MAX_RETRIES are discarded.
 *
 * @returns {Promise<{success: boolean, processed: number, failed: number, error?: string}>}
 */
export const processScreenshotQueue = async () => {
  try {
    const queue = JSON.parse((await AsyncStorage.getItem(QUEUE_STORAGE_KEY)) || '[]');

    if (queue.length === 0) {
      logger.debug('screenshotQueueService.processScreenshotQueue: Queue empty');
      return { success: true, processed: 0, failed: 0 };
    }

    logger.info('screenshotQueueService.processScreenshotQueue: Processing queue', {
      queueLength: queue.length,
    });

    const remaining = [];
    let processed = 0;
    let failed = 0;

    for (const event of queue) {
      try {
        const result = await recordScreenshot({
          conversationId: event.conversationId,
          snapMessageId: event.snapMessageId,
          screenshotterId: event.screenshotterId,
          screenshotterName: event.screenshotterName,
        });

        if (result.success) {
          processed++;
          logger.info('screenshotQueueService.processScreenshotQueue: Event processed', {
            conversationId: event.conversationId,
            snapMessageId: event.snapMessageId,
          });
        } else {
          // Firestore returned an error (not a thrown exception)
          event.retryCount = (event.retryCount || 0) + 1;
          if (event.retryCount >= MAX_RETRIES) {
            failed++;
            logger.warn(
              'screenshotQueueService.processScreenshotQueue: Max retries exceeded, discarding',
              {
                conversationId: event.conversationId,
                snapMessageId: event.snapMessageId,
                retryCount: event.retryCount,
              }
            );
          } else {
            remaining.push(event);
          }
        }
      } catch (error) {
        event.retryCount = (event.retryCount || 0) + 1;
        if (event.retryCount >= MAX_RETRIES) {
          failed++;
          logger.warn(
            'screenshotQueueService.processScreenshotQueue: Max retries exceeded, discarding',
            {
              conversationId: event.conversationId,
              snapMessageId: event.snapMessageId,
              retryCount: event.retryCount,
              error: error.message,
            }
          );
        } else {
          remaining.push(event);
          logger.warn('screenshotQueueService.processScreenshotQueue: Event failed, will retry', {
            conversationId: event.conversationId,
            snapMessageId: event.snapMessageId,
            retryCount: event.retryCount,
            error: error.message,
          });
        }
      }
    }

    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remaining));

    logger.info('screenshotQueueService.processScreenshotQueue: Complete', {
      processed,
      failed,
      remaining: remaining.length,
    });

    return { success: true, processed, failed };
  } catch (error) {
    logger.error('screenshotQueueService.processScreenshotQueue: Failed', {
      error: error.message,
    });
    return { success: false, processed: 0, failed: 0, error: error.message };
  }
};

/**
 * Get the current queue length (for debugging/logging).
 *
 * @returns {Promise<number>} Current queue length
 */
export const getQueueLength = async () => {
  try {
    const queue = JSON.parse((await AsyncStorage.getItem(QUEUE_STORAGE_KEY)) || '[]');
    return queue.length;
  } catch (error) {
    logger.error('screenshotQueueService.getQueueLength: Failed', {
      error: error.message,
    });
    return 0;
  }
};
