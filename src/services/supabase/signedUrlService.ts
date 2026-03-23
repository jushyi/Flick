/**
 * Signed URL Service (Supabase)
 *
 * Provides URL access to photos stored in Supabase Storage.
 * - Public buckets (photos, profile-photos, selects, comment-images): instant CDN URLs
 * - Private buckets (snaps): time-limited signed URLs (5 minutes)
 */

import { supabase } from '../../lib/supabase';

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
