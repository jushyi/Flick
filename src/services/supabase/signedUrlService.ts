/**
 * Signed URL Service (Supabase)
 *
 * Provides URL access to photos stored in Supabase Storage.
 * - Public buckets (photos, profile-photos, selects, comment-images): instant CDN URLs
 * - Private buckets (snaps): time-limited signed URLs (5 minutes)
 * - Proactive refresh: checks expiry before rendering and generates new URL if near-expiry
 */

import { supabase } from '../../lib/supabase';

import { isUrlNearExpiry } from '../../utils/imageUrl';

import logger from '../../utils/logger';

/**
 * Get a public CDN URL for a photo in a public bucket.
 * SYNCHRONOUS -- no network call needed for public buckets.
 *
 * @param storagePath - Path within the bucket (e.g., 'uid/photo123.webp')
 * @param bucket - Bucket name (defaults to 'photos')
 * @returns Public URL string
 */
export const getPhotoUrl = (storagePath: string, bucket: string = 'photos'): string => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return data.publicUrl;
};

/**
 * Get a signed URL for a snap in the private snaps bucket.
 * ASYNC -- requires a network call to generate the signed URL.
 *
 * @param storagePath - Path within the snaps bucket (e.g., 'uid/snap123.webp')
 * @returns Signed URL string or null on error
 */
export const getSnapUrl = async (storagePath: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from('snaps')
      .createSignedUrl(storagePath, 300);

    if (error) {
      logger.error('signedUrlService.getSnapUrl: Failed', {
        storagePath,
        error: error.message,
      });
      return null;
    }

    return data.signedUrl;
  } catch (error: any) {
    logger.error('signedUrlService.getSnapUrl: Exception', {
      storagePath,
      error: error.message,
    });
    return null;
  }
};

/**
 * Check a signed URL for near-expiry and refresh if needed.
 * Returns the current URL if still valid, or a fresh signed URL if near-expiry.
 *
 * Graceful degradation: on error, returns the original URL so the caller can
 * attempt to use the cached image (expo-image serves from disk cache even if
 * the URL has expired, preventing visible flash).
 *
 * @param currentUrl - The existing signed URL to check
 * @param storagePath - Path within the bucket for regeneration
 * @param bucket - Bucket name (defaults to 'snaps')
 * @returns The current URL or a fresh signed URL
 */
export const refreshSignedUrlIfExpiring = async (
  currentUrl: string,
  storagePath: string,
  bucket: string = 'snaps',
): Promise<string> => {
  try {
    if (!isUrlNearExpiry(currentUrl)) {
      return currentUrl;
    }

    logger.debug('signedUrlService.refreshSignedUrlIfExpiring: URL near expiry, refreshing', {
      storagePath,
      bucket,
    });

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 300);

    if (error || !data?.signedUrl) {
      logger.warn('signedUrlService.refreshSignedUrlIfExpiring: Refresh failed, using current URL', {
        storagePath,
        error: error?.message,
      });
      return currentUrl;
    }

    return data.signedUrl;
  } catch (error: any) {
    logger.warn('signedUrlService.refreshSignedUrlIfExpiring: Exception, using current URL', {
      storagePath,
      error: error.message,
    });
    return currentUrl;
  }
};
