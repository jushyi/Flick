/**
 * Photo Tag Service
 *
 * Client-side service for photo tag operations.
 * Wraps Cloud Function calls following the standard { success, error } pattern.
 */

import { getFunctions, httpsCallable } from '@react-native-firebase/functions';

import logger from '../../utils/logger';

/**
 * Add a tagged photo to the current user's feed.
 * Calls the addTaggedPhotoToFeed Cloud Function which handles:
 * - Copying the photo to the user's feed with attribution
 * - Updating the message's addedToFeedBy map for idempotency
 * - Notifying the photographer of the reshare
 *
 * @param {string} photoId - The original photo ID
 * @param {string} conversationId - The conversation containing the tag message
 * @param {string} messageId - The tagged_photo message ID
 * @returns {{ success: boolean, newPhotoId?: string, error?: string }}
 */
export const addTaggedPhotoToFeed = async (photoId, conversationId, messageId) => {
  try {
    const functions = getFunctions();
    const addToFeed = httpsCallable(functions, 'addTaggedPhotoToFeed');
    const result = await addToFeed({ photoId, conversationId, messageId });
    return { success: true, newPhotoId: result.data.newPhotoId };
  } catch (error) {
    logger.error('addTaggedPhotoToFeed failed', { error: error.message, photoId });
    return { success: false, error: error.message };
  }
};
