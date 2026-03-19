/**
 * Upload Queue Service
 *
 * Manages a persistent upload queue for photos and videos captured by the camera.
 * Media items are queued immediately after capture and uploaded in the background,
 * allowing the camera to return to ready state instantly.
 *
 * Features:
 * - AsyncStorage persistence (survives app restarts)
 * - Sequential processing (avoids race conditions)
 * - Exponential backoff retry (3 attempts max)
 * - Integrates with photoService and darkroomService
 * - Supports both photo and video uploads (mediaType discriminator)
 * - Video thumbnail generation via expo-video first-frame extraction
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

import logger from '../utils/logger';
import { uploadPhoto, uploadVideo } from './firebase/storageService';
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
 * Generate a tiny thumbnail for progressive loading placeholder (photos).
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

/**
 * Generate a tiny thumbnail from a video file for progressive loading placeholder.
 * Extracts the first frame using expo-video createVideoPlayer, then resizes to
 * a 20px wide base64 JPEG data URL.
 * Returns null on failure (non-critical - video will still load without a placeholder).
 * @param {string} videoUri - Local file URI of the video
 * @returns {Promise<string|null>} Base64 data URL or null
 */
const generateVideoThumbnail = async videoUri => {
  try {
    // Step 1: Create a transient player from the local file URI
    const { createVideoPlayer } = require('expo-video');
    const player = createVideoPlayer(videoUri);

    // Step 2: Generate a single thumbnail at time 0 (first frame)
    const thumbnails = await player.generateThumbnailsAsync([0]);

    // Step 3: Release the player immediately -- we only needed the thumbnail
    player.release();

    if (!thumbnails || thumbnails.length === 0) return null;

    const thumbUri = thumbnails[0].uri; // local file URI of the extracted frame

    // Step 4: Resize to tiny placeholder (20px wide) and convert to base64 JPEG
    const manipulated = await ImageManipulator.manipulateAsync(
      thumbUri,
      [{ resize: { width: 20 } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
    );

    const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    logger.warn('UploadQueueService.generateVideoThumbnail: Failed, continuing without thumbnail', {
      error: error.message,
    });
    return null; // Graceful fallback -- video will still load without a placeholder
  }
};

// =============================================================================
// STATE
// =============================================================================

let queue = [];
let isProcessing = false;
let isInitialized = false;
let processingPromise = null; // Tracks current processing run for await chaining

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
 * Add media item to upload queue
 * @param {string} userId - User ID who captured the media
 * @param {string} mediaUri - Local file URI of the captured photo or video
 * @param {string} [mediaType='photo'] - Type of media ('photo' or 'video')
 * @param {number|null} [duration=null] - Video duration in seconds (null for photos)
 * @returns {Promise<string>} Queue item ID
 */
export const addToQueue = async (userId, mediaUri, mediaType = 'photo', duration = null) => {
  const queueItem = {
    id: generateId(),
    mediaUri,
    userId,
    mediaType,
    duration, // video duration in seconds (null for photos)
    createdAt: Date.now(),
    attempts: 0,
    status: 'pending',
  };

  logger.info('UploadQueueService.addToQueue: Adding item', {
    id: queueItem.id,
    userId,
    mediaType,
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
    logger.debug('UploadQueueService.processQueue: Already processing, waiting for current run');
    // Wait for the in-progress run to complete rather than silently returning
    if (processingPromise) {
      await processingPromise;
    }
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

  const doProcess = async () => {
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
    processingPromise = null;
    logger.info('UploadQueueService.processQueue: Complete, queue empty');
  };

  processingPromise = doProcess();
  await processingPromise;
};

/**
 * Upload a single queue item
 * Handles both photo and video uploads based on mediaType.
 * Creates Firestore doc, generates thumbnail, uploads media, initializes darkroom.
 * @param {Object} item - Queue item to upload
 * @returns {Promise<void>}
 * @throws {Error} If upload fails
 */
const uploadQueueItem = async item => {
  const { id, userId, mediaType = 'photo' } = item;
  // Backward compatibility: support both mediaUri (new) and photoUri (legacy persisted items)
  const mediaUri = item.mediaUri || item.photoUri;

  logger.debug('UploadQueueService.uploadQueueItem: Starting', { id, userId, mediaType });

  // Update status
  item.status = 'uploading';
  await saveQueue();

  // Step 1: Generate a Firestore document ID without writing anything
  const photosCollection = collection(db, 'photos');
  const photoRef = doc(photosCollection);
  const photoId = photoRef.id;

  const isVideo = mediaType === 'video';
  const extension = isVideo ? (mediaUri.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4') : 'jpg';
  const storagePath = `photos/${userId}/${photoId}.${extension}`;

  logger.debug('UploadQueueService.uploadQueueItem: Generated photo ID', {
    id,
    photoId,
  });

  // Step 2: Generate thumbnail (video: first frame extraction, photo: resize)
  logger.debug('UploadQueueService.uploadQueueItem: Generating thumbnail', { id, photoId });
  const thumbnailDataURL = isVideo
    ? await generateVideoThumbnail(mediaUri)
    : await generateThumbnail(mediaUri);

  // Step 3: Upload media to Storage
  logger.debug('UploadQueueService.uploadQueueItem: Uploading to Storage', {
    id,
    photoId,
    userId,
    mediaType,
  });
  const uploadResult = isVideo
    ? await uploadVideo(userId, photoId, mediaUri)
    : await uploadPhoto(userId, photoId, mediaUri);

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
    imageURL: isVideo ? null : uploadResult.url,
    videoURL: isVideo ? uploadResult.url : null,
    mediaType,
    storagePath,
    capturedAt: serverTimestamp(),
    status: 'developing',
    photoState: null,
    visibility: 'friends-only',
    month: getCurrentMonth(),
    reactions: {},
    reactionCount: 0,
    ...(thumbnailDataURL && { thumbnailDataURL }),
    ...(isVideo && item.duration != null && { duration: item.duration }),
  };
  await setDoc(photoRef, docData);

  // Step 5: Ensure darkroom is initialized
  logger.debug('UploadQueueService.uploadQueueItem: Initializing darkroom', {
    id,
    userId,
  });
  await ensureDarkroomInitialized(userId);
  clearRevealCache(); // New media captured -- clear cache so darkroom checks re-evaluate fresh timing

  logger.info('UploadQueueService.uploadQueueItem: Complete', {
    id,
    photoId,
    userId,
    mediaType,
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
