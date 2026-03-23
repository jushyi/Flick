/**
 * Upload Queue Service (Supabase + PowerSync)
 *
 * Manages a persistent upload queue for photos and videos captured by the camera.
 * Media items are queued immediately after capture and uploaded in the background,
 * allowing the camera to return to ready state instantly.
 *
 * Features:
 * - PowerSync local-only SQLite table persistence (survives app restarts)
 * - Sequential processing (avoids race conditions)
 * - Exponential backoff retry (3 attempts max: 2s, 4s, 8s)
 * - Uploads to Supabase Storage via storageService.ts
 * - Drains old AsyncStorage Firebase queue items on first init
 * - Supports photo, video, and snap uploads (mediaType discriminator)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { uploadPhoto, uploadVideo, uploadSnapPhoto, generateThumbnail } from './supabase/storageService';
import { uploadPhoto as firebaseUploadPhoto, uploadVideo as firebaseUploadVideo } from './firebase/storageService';
import { getPowerSyncDb } from '../lib/powersync/PowerSyncProvider';
import { supabase } from '../lib/supabase';

import logger from '../utils/logger';

// =============================================================================
// CONSTANTS
// =============================================================================

const QUEUE_STORAGE_KEY = '@uploadQueue';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [2000, 4000, 8000]; // Exponential backoff: 2s, 4s, 8s

/**
 * Generate a UUID v4
 */
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// =============================================================================
// STATE
// =============================================================================

let isProcessing = false;
let isInitialized = false;

// =============================================================================
// QUEUE OPERATIONS
// =============================================================================

/**
 * Initialize upload queue on app start.
 * Checks AsyncStorage for old Firebase queue items and drains them via
 * Firebase path before switching to Supabase. Then reads PowerSync local
 * table for current state.
 */
export const initializeQueue = async (): Promise<void> => {
  if (isInitialized) {
    logger.debug('UploadQueueService.initializeQueue: Already initialized');
    return;
  }

  logger.info('UploadQueueService.initializeQueue: Starting');

  try {
    // Step 1: Drain old Firebase queue items from AsyncStorage
    let drainedCount = 0;
    try {
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        const oldItems = JSON.parse(stored);
        if (Array.isArray(oldItems) && oldItems.length > 0) {
          logger.info('UploadQueueService.initializeQueue: Draining old Firebase queue', {
            count: oldItems.length,
          });

          for (const item of oldItems) {
            try {
              const mediaUri = item.mediaUri || item.photoUri;
              const userId = item.userId;
              const mediaType = item.mediaType || 'photo';

              if (mediaType === 'video') {
                await firebaseUploadVideo(userId, generateUUID(), mediaUri);
              } else {
                await firebaseUploadPhoto(userId, generateUUID(), mediaUri);
              }
              drainedCount++;
            } catch (error: any) {
              logger.warn('UploadQueueService.initializeQueue: Failed to drain item', {
                id: item.id,
                error: error.message,
              });
            }
          }

          // Clear old queue from AsyncStorage
          await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
        }
      }
    } catch (drainError: any) {
      logger.warn('UploadQueueService.initializeQueue: Drain failed', {
        error: drainError.message,
      });
    }

    isInitialized = true;
    logger.info('Upload queue initialized', { drainedCount });

    // Step 2: Check PowerSync for pending items and process
    const db = getPowerSyncDb();
    if (db) {
      const pending = await db.getAll(
        'SELECT * FROM upload_queue WHERE status IN (?, ?) ORDER BY created_at',
        ['pending', 'retry']
      );
      if (pending.length > 0) {
        logger.info('UploadQueueService.initializeQueue: Found pending items', {
          count: pending.length,
        });
        processQueue();
      }
    }
  } catch (error: any) {
    logger.error('UploadQueueService.initializeQueue: Failed', {
      error: error.message,
    });
  }
};

/**
 * Add media item to upload queue.
 * Inserts a row into the PowerSync upload_queue local-only table with
 * status='pending', backend='supabase', attempts=0.
 *
 * @param userId - User ID who captured the media
 * @param mediaUri - Local file URI of the captured photo or video
 * @param mediaType - Type of media ('photo', 'video', or 'snap')
 * @param duration - Video duration in seconds (null for photos)
 * @returns Object with photoId and thumbnail
 */
export const addToQueue = async (
  userId: string,
  mediaUri: string,
  mediaType: string = 'photo',
  duration: number | null = null
): Promise<{ photoId: string; thumbnail: string | null }> => {
  const id = generateUUID();
  const photoId = generateUUID();
  const createdAt = Date.now();

  logger.info('UploadQueueService.addToQueue: Adding item', {
    id,
    userId,
    mediaType,
  });

  // Generate thumbnail
  const thumbnail = await generateThumbnail(mediaUri);

  // Insert into PowerSync local-only table
  const db = getPowerSyncDb();
  if (db) {
    await db.execute(
      'INSERT INTO upload_queue (id, user_id, media_uri, media_type, duration, status, attempts, created_at, backend, error_message, photo_id, thumbnail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, userId, mediaUri, mediaType, duration, 'pending', 0, createdAt, 'supabase', null, photoId, thumbnail]
    );
  } else {
    logger.warn('UploadQueueService.addToQueue: PowerSync not available, item not persisted');
  }

  // Trigger processing (non-blocking)
  processQueue().catch(() => {});

  return { photoId, thumbnail };
};

/**
 * Process upload queue sequentially.
 * Queries PowerSync for pending/retry items ordered by created_at,
 * processes each using the appropriate upload function based on backend and mediaType.
 */
export const processQueue = async (): Promise<void> => {
  if (isProcessing) {
    logger.debug('UploadQueueService.processQueue: Already processing');
    return;
  }

  const db = getPowerSyncDb();
  if (!db) {
    logger.warn('UploadQueueService.processQueue: PowerSync not available');
    return;
  }

  isProcessing = true;
  logger.info('UploadQueueService.processQueue: Starting');

  try {
    const items = await db.getAll(
      'SELECT * FROM upload_queue WHERE status IN (?, ?) ORDER BY created_at',
      ['pending', 'retry']
    );

    for (const item of items) {
      try {
        // Update status to processing
        await db.execute(
          'UPDATE upload_queue SET status = ? WHERE id = ?',
          ['processing', item.id]
        );

        // Upload based on backend and media type
        let uploadResult: any;

        if (item.backend === 'firebase') {
          // Drain old Firebase items
          if (item.media_type === 'video') {
            uploadResult = await firebaseUploadVideo(item.user_id, item.photo_id, item.media_uri);
          } else {
            uploadResult = await firebaseUploadPhoto(item.user_id, item.photo_id, item.media_uri);
          }
        } else {
          // Supabase upload
          if (item.media_type === 'video') {
            uploadResult = await uploadVideo(item.user_id, item.photo_id, item.media_uri);
          } else if (item.media_type === 'snap') {
            uploadResult = await uploadSnapPhoto(item.user_id, item.photo_id, item.media_uri);
          } else {
            uploadResult = await uploadPhoto(item.user_id, item.photo_id, item.media_uri);
          }
        }

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Upload failed');
        }

        // Mark as completed
        await db.execute(
          'UPDATE upload_queue SET status = ? WHERE id = ?',
          ['completed', item.id]
        );

        logger.info('UploadQueueService.processQueue: Item completed', {
          id: item.id,
          photoId: item.photo_id,
        });
      } catch (error: any) {
        const newAttempts = (item.attempts || 0) + 1;
        const newStatus = newAttempts >= MAX_RETRY_ATTEMPTS ? 'failed' : 'retry';

        await db.execute(
          'UPDATE upload_queue SET status = ?, attempts = ?, error_message = ? WHERE id = ?',
          [newStatus, newAttempts, error.message, item.id]
        );

        if (newStatus === 'failed') {
          logger.error('UploadQueueService.processQueue: Item failed permanently', {
            id: item.id,
            attempts: newAttempts,
            error: error.message,
          });
        } else {
          const delay = RETRY_DELAYS[newAttempts - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
          logger.warn('UploadQueueService.processQueue: Item failed, will retry', {
            id: item.id,
            attempts: newAttempts,
            nextRetryIn: delay,
            error: error.message,
          });
          // Wait before processing next item
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  } catch (error: any) {
    logger.error('UploadQueueService.processQueue: Failed', {
      error: error.message,
    });
  } finally {
    isProcessing = false;
    logger.info('UploadQueueService.processQueue: Complete');
  }
};

/**
 * Get count of pending + retry items in the queue
 */
export const getQueueLength = async (): Promise<number> => {
  const db = getPowerSyncDb();
  if (!db) {
    return 0;
  }

  try {
    const result = await db.get(
      'SELECT COUNT(*) as count FROM upload_queue WHERE status IN (?, ?)',
      ['pending', 'retry']
    );
    return result.count;
  } catch (error: any) {
    logger.error('UploadQueueService.getQueueLength: Failed', {
      error: error.message,
    });
    return 0;
  }
};

/**
 * Reset internal state (for testing only)
 */
export const _resetForTesting = (): void => {
  isProcessing = false;
  isInitialized = false;
};

/**
 * Delete failed items from the queue
 */
export const clearFailedItems = async (): Promise<void> => {
  const db = getPowerSyncDb();
  if (!db) {
    return;
  }

  try {
    await db.execute(
      'DELETE FROM upload_queue WHERE status = ?',
      ['failed']
    );
    logger.info('UploadQueueService.clearFailedItems: Cleared failed items');
  } catch (error: any) {
    logger.error('UploadQueueService.clearFailedItems: Failed', {
      error: error.message,
    });
  }
};
