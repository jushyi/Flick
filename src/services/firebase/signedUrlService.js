/**
 * Signed URL Service
 *
 * Provides secure, time-limited access to photos via signed URLs.
 * Calls Cloud Functions to generate signed URLs with 24-hour expiration.
 *
 * Key functions:
 * - getSignedPhotoUrl: Get signed URL for a storage path
 * - convertToSignedUrl: Convert full URL or path to signed URL
 */

import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import logger from '../../utils/logger';

const functions = getFunctions();

/**
 * Get a signed URL for a photo with 24-hour expiration.
 * Calls the getSignedPhotoUrl Cloud Function.
 *
 * @param {string} photoPath - Storage path to the photo (e.g., 'photos/abc123.jpg')
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export const getSignedPhotoUrl = async photoPath => {
  try {
    logger.debug('SignedUrlService.getSignedPhotoUrl: Requesting signed URL', { photoPath });

    const getSignedUrl = httpsCallable(functions, 'getSignedPhotoUrl');
    const result = await getSignedUrl({ photoPath });

    logger.info('SignedUrlService.getSignedPhotoUrl: Success', { photoPath });
    return { success: true, url: result.data.url };
  } catch (error) {
    logger.error('SignedUrlService.getSignedPhotoUrl: Failed', {
      photoPath,
      error: error.message,
      code: error.code,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Convert a storage path or full URL to signed URL.
 * Convenience function that extracts path from full URL if needed.
 *
 * @param {string} urlOrPath - Either a full storage URL or just the path
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export const convertToSignedUrl = async urlOrPath => {
  // If it's already a path (not a full URL), use directly
  let photoPath = urlOrPath;

  // If it's a full Firebase Storage URL, extract the path
  // URLs look like: https://firebasestorage.googleapis.com/v0/b/bucket/o/photos%2Fabc.jpg?...
  if (urlOrPath.includes('firebasestorage.googleapis.com')) {
    try {
      const url = new URL(urlOrPath);
      // Path is in the /o/ segment, URL-encoded
      const pathMatch = url.pathname.match(/\/o\/(.+)$/);
      if (pathMatch) {
        photoPath = decodeURIComponent(pathMatch[1]);
      }
    } catch (_e) {
      logger.warn('SignedUrlService.convertToSignedUrl: Could not parse URL', { urlOrPath });
      // Fall through and try with original value
    }
  }

  return getSignedPhotoUrl(photoPath);
};
