/**
 * Upload Queue Service
 *
 * Manages a persistent upload queue for photos captured by the camera.
 * Photos are queued immediately after capture and uploaded in the background,
 * allowing the camera to return to ready state instantly.
 *
 * Features:
 * - AsyncStorage persistence (survives app restarts)
 * - Sequential processing (avoids race conditions)
 * - Exponential backoff retry (3 attempts max)
 * - Integrates with photoService and darkroomService
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

import logger from '../utils/logger';
import { uploadPhoto } from './firebase/storageService';
import { ensureDarkroomInitialized, clearRevealCache } from './firebase/darkroomService';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';

// Initialize Firestore
const db = getFirestore();

// =============================================================================
// CONSTANTS
// =============================================================================

const QUEUE_STORAGE_KEY = '@uploadQueue';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [2000, 4000, 8000]; // Exponential backoff: 2s, 4s, 8s

/**
 * Generate a unique ID for queue items
 * Uses timestamp + random string (no external dependency needed)
 * @returns {string} Unique ID
 */
const generateId = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomPart}`;
};

/**
 * Generate a tiny thumbnail for progressive loading placeholder.
 * Creates a 20px wide JPEG, reads it as base64, returns a data URL.
 * Returns null on failure (non-critical - photo uploads without thumbnail).
 * @param {string} photoUri - Local file URI of the photo
 * @returns {Promise<string|null>} Base64 data URL or null
 */
const generateThumbnail = async photoUri => {
  try {
    const result = await ImageManipulator.manipulateAsync(photoUri, [{ resize: { width: 20 } }], {
      format: ImageManipulator.SaveFormat.JPEG,
      compress: 0.5,
    });
    const base64 = await FileSystem.readAsStringAsync(result.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    logger.warn('UploadQueueService.generateThumbnail: Thumbnail generation failed', {
      error: error.message,
    });
    return null;
  }
};

// =============================================================================
// STATE
// =============================================================================

let queue = [];
let isProcessing = false;
let isInitialized = false;

// =============================================================================
// PERSISTENCE
// =============================================================================

/**
 * Load queue from AsyncStorage
 * @returns {Promise<Array>} Queue items
 */
const loadQueue = async () => {
  try {
    const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (stored) {
      const parsedQueue = JSON.parse(stored);
      logger.debug('UploadQueueService.loadQueue: Loaded queue from storage', {
        count: parsedQueue.length,
      });
      return parsedQueue;
    }
    return [];
  } catch (error) {
    logger.error('UploadQueueService.loadQueue: Failed to load queue', {
      error: error.message,
    });
    return [];
  }
};

/**
 * Save queue to AsyncStorage
 * @returns {Promise<void>}
 */
const saveQueue = async () => {
  try {
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    logger.debug('UploadQueueService.saveQueue: Saved queue to storage', {
      count: queue.length,
    });
  } catch (error) {
    logger.error('UploadQueueService.saveQueue: Failed to save queue', {
      error: error.message,
    });
  }
};

// =============================================================================
// QUEUE OPERATIONS
// =============================================================================

/**
 * Initialize upload queue on app start
 * Loads persisted queue and starts processor
 * @returns {Promise<void>}
 */
export const initializeQueue = async () => {
  if (isInitialized) {
    logger.debug('UploadQueueService.initializeQueue: Already initialized');
    return;
  }

  logger.info('UploadQueueService.initializeQueue: Starting');

  try {
    queue = await loadQueue();
    isInitialized = true;

    logger.info('UploadQueueService.initializeQueue: Complete', {
      pendingItems: queue.length,
    });

    // Process any pending items
    if (queue.length > 0) {
      processQueue();
    }
  } catch (error) {
    logger.error('UploadQueueService.initializeQueue: Failed', {
      error: error.message,
    });
  }
};

/**
 * Add photo to upload queue
 * @param {string} userId - User ID who captured the photo
 * @param {string} photoUri - Local file URI of the captured photo
 * @returns {Promise<string>} Queue item ID
 */
export const addToQueue = async (userId, photoUri) => {
  const queueItem = {
    id: generateId(),
    photoUri,
    userId,
    createdAt: Date.now(),
    attempts: 0,
    status: 'pending',
  };

  logger.info('UploadQueueService.addToQueue: Adding item', {
    id: queueItem.id,
    userId,
  });

  queue.push(queueItem);
  await saveQueue();

  // Trigger processing
  processQueue();

  return queueItem.id;
};

/**
 * Process upload queue sequentially
 * Only one item is processed at a time to avoid race conditions
 * @returns {Promise<void>}
 */
export const processQueue = async () => {
  if (isProcessing) {
    logger.debug('UploadQueueService.processQueue: Already processing, skipping');
    return;
  }

  if (queue.length === 0) {
    logger.debug('UploadQueueService.processQueue: Queue empty');
    return;
  }

  isProcessing = true;
  logger.info('UploadQueueService.processQueue: Starting', {
    queueLength: queue.length,
  });

  while (queue.length > 0) {
    const item = queue[0];

    // Skip items that have exceeded max retries
    if (item.attempts >= MAX_RETRY_ATTEMPTS) {
      logger.warn('UploadQueueService.processQueue: Max retries exceeded, removing item', {
        id: item.id,
        attempts: item.attempts,
      });
      queue.shift();
      await saveQueue();
      continue;
    }

    try {
      await uploadQueueItem(item);
      // Success - remove from queue
      queue.shift();
      await saveQueue();
      logger.info('UploadQueueService.processQueue: Item processed successfully', {
        id: item.id,
      });
    } catch (error) {
      // Failed - increment attempts and retry with backoff
      item.attempts += 1;
      item.status = 'failed';
      await saveQueue();

      if (item.attempts < MAX_RETRY_ATTEMPTS) {
        const delay = RETRY_DELAYS[item.attempts - 1];
        logger.warn('UploadQueueService.processQueue: Item failed, will retry', {
          id: item.id,
          attempts: item.attempts,
          nextRetryIn: delay,
          error: error.message,
        });

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        logger.error('UploadQueueService.processQueue: Item failed permanently', {
          id: item.id,
          attempts: item.attempts,
          error: error.message,
        });
      }
    }
  }

  isProcessing = false;
  logger.info('UploadQueueService.processQueue: Complete, queue empty');
};

/**
 * Upload a single queue item
 * Creates Firestore doc, compresses/uploads image, updates doc with URL, initializes darkroom
 * @param {Object} item - Queue item to upload
 * @returns {Promise<void>}
 * @throws {Error} If upload fails
 */
const uploadQueueItem = async item => {
  const { id, userId, photoUri } = item;

  logger.debug('UploadQueueService.uploadQueueItem: Starting', { id, userId });

  // Update status
  item.status = 'uploading';
  await saveQueue();

  // Step 1: Generate a Firestore document ID without writing anything
  const photosCollection = collection(db, 'photos');
  const photoRef = doc(photosCollection);
  const photoId = photoRef.id;
  const storagePath = `photos/${userId}/${photoId}.jpg`;

  logger.debug('UploadQueueService.uploadQueueItem: Generated photo ID', {
    id,
    photoId,
  });

  // Step 2: Generate thumbnail from local photo (non-blocking, non-critical)
  logger.debug('UploadQueueService.uploadQueueItem: Generating thumbnail', { id, photoId });
  const thumbnailDataURL = await generateThumbnail(photoUri);

  // Step 3: Upload compressed photo to Storage FIRST
  logger.debug('UploadQueueService.uploadQueueItem: Uploading to Storage', {
    id,
    photoId,
    userId,
  });
  const uploadResult = await uploadPhoto(userId, photoId, photoUri);

  if (!uploadResult.success) {
    throw new Error(uploadResult.error || 'Upload to storage failed');
  }

  // Step 4: Create Firestore document with the real URL (single atomic write)
  logger.debug('UploadQueueService.uploadQueueItem: Creating Firestore document with URL', {
    id,
    photoId,
  });
  const docData = {
    userId,
    imageURL: uploadResult.url,
    storagePath,
    capturedAt: serverTimestamp(),
    status: 'developing',
    photoState: null,
    visibility: 'friends-only',
    month: getCurrentMonth(),
    reactions: {},
    reactionCount: 0,
    ...(thumbnailDataURL && { thumbnailDataURL }),
  };
  await setDoc(photoRef, docData);

  // Step 5: Ensure darkroom is initialized
  logger.debug('UploadQueueService.uploadQueueItem: Initializing darkroom', {
    id,
    userId,
  });
  await ensureDarkroomInitialized(userId);
  clearRevealCache(); // New photo captured — clear cache so darkroom checks re-evaluate fresh timing

  logger.info('UploadQueueService.uploadQueueItem: Complete', {
    id,
    photoId,
    userId,
  });
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get current month in YYYY-MM format
 * @returns {string} Current month
 */
const getCurrentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * Get current queue length
 * @returns {number} Number of pending items in queue
 */
export const getQueueLength = () => {
  return queue.length;
};

/**
 * Clear failed items from queue (those that exceeded max retries)
 * @returns {Promise<number>} Number of items cleared
 */
export const clearFailedItems = async () => {
  const initialLength = queue.length;
  queue = queue.filter(item => item.attempts < MAX_RETRY_ATTEMPTS);
  const cleared = initialLength - queue.length;

  if (cleared > 0) {
    await saveQueue();
    logger.info('UploadQueueService.clearFailedItems: Cleared failed items', {
      cleared,
      remaining: queue.length,
    });
  }

  return cleared;
};
