/**
 * Screenshot Queue Service
 *
 * Handles offline persistence for screenshot detection events.
 * When the device is offline and a screenshot event cannot be written to
 * Firestore immediately, the event is queued in AsyncStorage and retried
 * when connectivity returns.
 *
 * Mirrors the uploadQueueService.js pattern:
 * - AsyncStorage persistence (survives app restarts)
 * - Sequential processing with retry
 * - MAX_RETRIES limit per event
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
 * Called when a screenshot is detected but Firestore write fails (offline).
 *
 * @param {Object} event - Screenshot event data
 * @param {string} event.conversationId - Conversation document ID
 * @param {string} event.snapMessageId - ID of the snap message that was screenshotted
 * @param {string} event.screenshotterId - User ID of the person who took the screenshot
 * @param {string} event.screenshotterName - Display name of the screenshotter
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const queueScreenshotEvent = async event => {
  try {
    const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    const queue = stored ? JSON.parse(stored) : [];

    queue.push({
      ...event,
      retryCount: 0,
      queuedAt: Date.now(),
    });

    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));

    logger.info('screenshotQueueService.queueScreenshotEvent: Event queued', {
      conversationId: event.conversationId,
      snapMessageId: event.snapMessageId,
      queueLength: queue.length,
    });

    return { success: true };
  } catch (error) {
    logger.error('screenshotQueueService.queueScreenshotEvent: Failed to queue event', {
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Process all queued screenshot events.
 * Iterates through the queue, attempts to write each event to Firestore via
 * recordScreenshot. On success, removes the event. On failure, increments
 * retryCount. Events exceeding MAX_RETRIES are removed with a warning.
 *
 * @returns {Promise<{success: boolean, processed: number, failed: number}>}
 */
export const processScreenshotQueue = async () => {
  try {
    const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    const queue = stored ? JSON.parse(stored) : [];

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
            alreadyScreenshotted: result.alreadyScreenshotted || false,
          });
        } else {
          throw new Error(result.error || 'recordScreenshot returned failure');
        }
      } catch (error) {
        event.retryCount = (event.retryCount || 0) + 1;

        if (event.retryCount >= MAX_RETRIES) {
          failed++;
          logger.warn(
            'screenshotQueueService.processScreenshotQueue: Max retries exceeded, dropping event',
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
    return { success: false, processed: 0, failed: 0 };
  }
};

/**
 * Get the current queue length (for debugging/logging).
 *
 * @returns {Promise<number>} Current number of events in the queue
 */
export const getQueueLength = async () => {
  try {
    const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    const queue = stored ? JSON.parse(stored) : [];
    return queue.length;
  } catch (error) {
    logger.error('screenshotQueueService.getQueueLength: Failed to read queue', {
      error: error.message,
    });
    return 0;
  }
};
