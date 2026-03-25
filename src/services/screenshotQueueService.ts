import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../lib/supabase';

// TODO(20-08): Implement full screenshotService in supabase layer
const recordScreenshot = async (params: {
  conversationId: string;
  snapMessageId: string;
  screenshotterId: string;
  screenshotterName: string;
}): Promise<{ success: boolean; alreadyScreenshotted?: boolean; error?: string }> => {
  try {
    const { error } = await supabase.from('screenshot_events').insert({
      conversation_id: params.conversationId,
      snap_message_id: params.snapMessageId,
      screenshotter_id: params.screenshotterId,
      screenshotter_name: params.screenshotterName,
    });
    if (error) {
      // If duplicate, treat as already screenshotted
      if (error.code === '23505') {
        return { success: true, alreadyScreenshotted: true };
      }
      return { success: false, error: error.message };
    }
    return { success: true, alreadyScreenshotted: false };
  } catch (err) {
    const e = err as Error;
    return { success: false, error: e.message };
  }
};

import logger from '../utils/logger';

const QUEUE_STORAGE_KEY = '@screenshotQueue';
const MAX_RETRIES = 3;

interface ScreenshotEvent {
  conversationId: string;
  snapMessageId: string;
  screenshotterId: string;
  screenshotterName: string;
}

interface QueuedEvent extends ScreenshotEvent {
  retryCount: number;
  queuedAt: number;
}

interface QueueResult {
  success: boolean;
  error?: string;
}

interface ProcessResult {
  success: boolean;
  processed: number;
  failed: number;
}

export const queueScreenshotEvent = async (event: ScreenshotEvent): Promise<QueueResult> => {
  try {
    const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    const queue: QueuedEvent[] = stored ? JSON.parse(stored) : [];

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
  } catch (err) {
    const error = err as Error;
    logger.error('screenshotQueueService.queueScreenshotEvent: Failed to queue event', {
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

export const processScreenshotQueue = async (): Promise<ProcessResult> => {
  try {
    const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    const queue: QueuedEvent[] = stored ? JSON.parse(stored) : [];

    if (queue.length === 0) {
      logger.debug('screenshotQueueService.processScreenshotQueue: Queue empty');
      return { success: true, processed: 0, failed: 0 };
    }

    logger.info('screenshotQueueService.processScreenshotQueue: Processing queue', {
      queueLength: queue.length,
    });

    const remaining: QueuedEvent[] = [];
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
      } catch (err) {
        const error = err as Error;
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
  } catch (err) {
    const error = err as Error;
    logger.error('screenshotQueueService.processScreenshotQueue: Failed', {
      error: error.message,
    });
    return { success: false, processed: 0, failed: 0 };
  }
};

export const getQueueLength = async (): Promise<number> => {
  try {
    const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    const queue: QueuedEvent[] = stored ? JSON.parse(stored) : [];
    return queue.length;
  } catch (err) {
    const error = err as Error;
    logger.error('screenshotQueueService.getQueueLength: Failed to read queue', {
      error: error.message,
    });
    return 0;
  }
};
