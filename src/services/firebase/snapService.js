/**
 * Snap Service
 *
 * Handles the complete snap lifecycle: upload, send, mark viewed, and signed URL generation.
 * Snaps are ephemeral photo messages that disappear after viewing.
 *
 * Key features:
 * - Upload snap photo to snap-photos/ Storage path with no-cache headers
 * - Create snap message document with type:'snap' in conversation messages subcollection
 * - Auto-retry upload+send up to 3 times with exponential backoff on failure
 * - Mark snap as viewed (writes viewedAt timestamp, triggers server-side cleanup)
 * - Fetch short-lived signed URLs (5-minute expiry) via Cloud Function
 *
 * Data structure (message document):
 * {
 *   senderId: string,
 *   type: 'snap',
 *   text: null,
 *   gifUrl: null,
 *   imageUrl: null,
 *   snapStoragePath: string,       // e.g. 'snap-photos/userId/1234567890-abc1234.jpg'
 *   caption: string | null,        // Truncated to 150 chars
 *   viewedAt: Timestamp | null,    // Set by recipient when snap is viewed
 *   expiresAt: Timestamp,          // 48 hours from creation (safety net for cleanup)
 *   createdAt: Timestamp,
 * }
 */

import { getStorage, ref } from '@react-native-firebase/storage';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from '@react-native-firebase/firestore';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import * as ImageManipulator from 'expo-image-manipulator';

import logger from '../../utils/logger';

const storage = getStorage();
const db = getFirestore();
const functions = getFunctions();

/**
 * Convert URI to local file path for RN Firebase putFile.
 * @param {string} uri - File URI (may start with file://)
 * @returns {string} Local file path without file:// prefix
 */
const uriToFilePath = uri => {
  if (uri.startsWith('file://')) {
    return uri.substring(7);
  }
  return uri;
};

/**
 * Compress snap image before upload.
 * Uses same pattern as storageService compressImage.
 * @param {string} uri - Local image URI
 * @returns {Promise<string>} Compressed image URI
 */
const compressSnapImage = async uri => {
  try {
    // Step 1: Normalize EXIF orientation (bake rotation into pixels).
    // Back camera photos retain raw EXIF from sensor; this ensures
    // orientation is consistent across platforms before upload.
    const normalized = await ImageManipulator.manipulateAsync(uri, [], {
      format: ImageManipulator.SaveFormat.JPEG,
    });

    // Step 2: Resize and compress
    const manipResult = await ImageManipulator.manipulateAsync(
      normalized.uri,
      [{ resize: { width: 1080 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    return manipResult.uri;
  } catch (error) {
    logger.error('snapService.compressSnapImage: Compression failed, using original', {
      error: error.message,
    });
    return uri;
  }
};

/**
 * Sleep utility for exponential backoff.
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Upload a snap photo and send it as a message in a conversation.
 * Compresses the image, uploads to snap-photos/ Storage path, then creates
 * a message document with type:'snap' in the conversation messages subcollection.
 *
 * Includes auto-retry logic: on failure, retries up to 3 times with exponential
 * backoff (1s, 2s, 4s delays). If all retries fail, returns retriesExhausted flag
 * so the UI can show a tap-to-retry error state.
 *
 * @param {string} conversationId - Conversation document ID
 * @param {string} senderId - Sender's user ID
 * @param {string} localUri - Local image URI from camera capture
 * @param {string|null} caption - Optional caption text (truncated to 150 chars)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string, retriesExhausted?: boolean}>}
 */
export const uploadAndSendSnap = async (conversationId, senderId, localUri, caption = null) => {
  logger.debug('snapService.uploadAndSendSnap: Starting', {
    conversationId,
    senderId,
    hasCaption: !!caption,
  });

  if (!conversationId || !senderId || !localUri) {
    logger.warn('snapService.uploadAndSendSnap: Missing required fields', {
      conversationId,
      senderId,
      hasUri: !!localUri,
    });
    return { success: false, error: 'Missing required fields' };
  }

  const maxRetries = 3;
  const backoffDelays = [1000, 2000, 4000];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Compress image
      const compressedUri = await compressSnapImage(localUri);
      const filePath = uriToFilePath(compressedUri);

      // Generate unique snap ID
      const snapId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const snapStoragePath = `snap-photos/${senderId}/${snapId}.jpg`;

      // Upload to Storage with no-cache headers (ephemeral content)
      const storageRef = ref(storage, snapStoragePath);
      await storageRef.putFile(filePath, {
        cacheControl: 'no-store',
        contentType: 'image/jpeg',
      });

      // Calculate expiresAt as 48 hours from now
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + 48 * 60 * 60 * 1000));

      // Truncate caption to 150 chars if provided
      const truncatedCaption = caption ? caption.substring(0, 150) : null;

      // Create snap message document
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const messageData = {
        senderId,
        type: 'snap',
        text: null,
        gifUrl: null,
        imageUrl: null,
        snapStoragePath,
        caption: truncatedCaption,
        viewedAt: null,
        expiresAt,
        createdAt: serverTimestamp(),
      };

      const messageDoc = await addDoc(messagesRef, messageData);

      logger.info('snapService.uploadAndSendSnap: Snap sent successfully', {
        conversationId,
        messageId: messageDoc.id,
        snapStoragePath,
        attempt,
      });

      return { success: true, messageId: messageDoc.id };
    } catch (error) {
      if (attempt < maxRetries) {
        logger.warn('snapService.uploadAndSendSnap: Attempt failed, retrying', {
          conversationId,
          senderId,
          attempt,
          maxRetries,
          error: error.message,
          nextRetryMs: backoffDelays[attempt - 1],
        });
        await sleep(backoffDelays[attempt - 1]);
      } else {
        logger.error('snapService.uploadAndSendSnap: All retries exhausted', {
          conversationId,
          senderId,
          error: error.message,
          totalAttempts: maxRetries,
        });
        return { success: false, error: error.message, retriesExhausted: true };
      }
    }
  }
};

/**
 * Mark a snap message as viewed by writing a viewedAt timestamp.
 * This triggers the onSnapViewed Cloud Function which deletes the Storage file.
 * Firestore rules allow the non-sender participant to update viewedAt.
 *
 * @param {string} conversationId - Conversation document ID
 * @param {string} messageId - Snap message document ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const markSnapViewed = async (conversationId, messageId) => {
  logger.debug('snapService.markSnapViewed: Starting', {
    conversationId,
    messageId,
  });

  try {
    if (!conversationId || !messageId) {
      logger.warn('snapService.markSnapViewed: Missing required fields', {
        conversationId,
        messageId,
      });
      return { success: false, error: 'Missing required fields' };
    }

    const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    await updateDoc(messageRef, {
      viewedAt: serverTimestamp(),
    });

    logger.info('snapService.markSnapViewed: Snap marked as viewed', {
      conversationId,
      messageId,
    });

    return { success: true };
  } catch (error) {
    logger.error('snapService.markSnapViewed: Failed', {
      conversationId,
      messageId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Get a short-lived signed URL for a snap photo via Cloud Function.
 * The Cloud Function validates the caller is a conversation participant
 * and returns a 5-minute expiry signed URL.
 *
 * @param {string} snapStoragePath - Storage path starting with 'snap-photos/'
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export const getSignedSnapUrl = async snapStoragePath => {
  logger.debug('snapService.getSignedSnapUrl: Starting', { snapStoragePath });

  try {
    if (!snapStoragePath) {
      logger.warn('snapService.getSignedSnapUrl: Missing snapStoragePath');
      return { success: false, error: 'Missing snapStoragePath' };
    }

    if (!snapStoragePath.startsWith('snap-photos/')) {
      logger.warn('snapService.getSignedSnapUrl: Invalid path, must start with snap-photos/', {
        snapStoragePath,
      });
      return { success: false, error: 'Invalid path: must start with snap-photos/' };
    }

    const getSignedUrl = httpsCallable(functions, 'getSignedSnapUrl');
    const result = await getSignedUrl({ snapStoragePath });

    logger.info('snapService.getSignedSnapUrl: Success', { snapStoragePath });
    return { success: true, url: result.data.url };
  } catch (error) {
    logger.error('snapService.getSignedSnapUrl: Failed', {
      snapStoragePath,
      error: error.message,
      code: error.code,
    });
    return { success: false, error: error.message };
  }
};
