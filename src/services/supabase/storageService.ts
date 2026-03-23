/**
 * Supabase Storage Service
 *
 * Handles all upload/delete/URL operations for Supabase Storage.
 * Photos are compressed to WebP before upload. Videos are uploaded unchanged.
 * Regular photos use public CDN URLs. Snaps use a private bucket (signed URLs generated elsewhere).
 *
 * Upload flow: compress -> read as base64 -> decode to ArrayBuffer -> upload to Supabase Storage
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

import { supabase } from '@/lib/supabase';

import logger from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

interface UploadResult {
  success: boolean;
  url?: string;
  storagePath?: string;
  error?: string;
}

interface SelectsUploadResult {
  success: boolean;
  photoURLs?: string[];
  error?: string;
}

interface DeleteResult {
  success: boolean;
  error?: string;
}

interface UrlResult {
  success: boolean;
  url?: string;
  error?: string;
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Compress image using expo-image-manipulator
 */
const compressImage = async (
  uri: string,
  options: { width: number; quality: number; format?: 'webp' | 'jpeg' }
): Promise<string> => {
  const format =
    options.format === 'jpeg'
      ? ImageManipulator.SaveFormat.JPEG
      : ImageManipulator.SaveFormat.WEBP;

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: options.width } }],
    { compress: options.quality, format }
  );
  return result.uri;
};

/**
 * Read a local file URI as an ArrayBuffer via base64 conversion
 */
const readFileAsArrayBuffer = async (uri: string): Promise<ArrayBuffer> => {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return decode(base64);
};

/**
 * Get content type from file extension
 */
const getContentType = (extension: string): string => {
  const map: Record<string, string> = {
    '.webp': 'image/webp',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.mov': 'video/quicktime',
    '.mp4': 'video/mp4',
  };
  return map[extension.toLowerCase()] || 'application/octet-stream';
};

/**
 * Generate a simple UUID v4
 */
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// ============================================================================
// Exported functions
// ============================================================================

/**
 * Upload photo to Supabase Storage
 * Compresses to WebP 0.9 quality at 1080px width
 */
export const uploadPhoto = async (
  userId: string,
  photoId: string,
  localUri: string
): Promise<UploadResult> => {
  try {
    logger.debug('StorageService.uploadPhoto: Starting', { userId, photoId });

    const compressedUri = await compressImage(localUri, { width: 1080, quality: 0.9 });
    const arrayBuffer = await readFileAsArrayBuffer(compressedUri);
    const storagePath = `photos/${userId}/${photoId}.webp`;

    const { error } = await supabase.storage.from('photos').upload(storagePath, arrayBuffer, {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000',
      upsert: false,
    });

    if (error) {
      logger.error('StorageService.uploadPhoto: Upload failed', { photoId, error: error.message });
      return { success: false, error: error.message };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('photos').getPublicUrl(storagePath);

    logger.info('StorageService.uploadPhoto: Upload successful', { photoId });
    return { success: true, url: publicUrl, storagePath };
  } catch (error: any) {
    logger.error('StorageService.uploadPhoto: Failed', { photoId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Upload video to Supabase Storage
 * No compression -- video quality is set at recording time
 */
export const uploadVideo = async (
  userId: string,
  photoId: string,
  videoUri: string
): Promise<UploadResult> => {
  try {
    logger.debug('StorageService.uploadVideo: Starting', { userId, photoId });

    const extension = videoUri.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4';
    const contentType = extension === 'mov' ? 'video/quicktime' : 'video/mp4';
    const storagePath = `photos/${userId}/${photoId}.${extension}`;

    const arrayBuffer = await readFileAsArrayBuffer(videoUri);

    const { error } = await supabase.storage.from('photos').upload(storagePath, arrayBuffer, {
      contentType,
      upsert: false,
    });

    if (error) {
      logger.error('StorageService.uploadVideo: Upload failed', { photoId, error: error.message });
      return { success: false, error: error.message };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('photos').getPublicUrl(storagePath);

    logger.info('StorageService.uploadVideo: Upload successful', { photoId });
    return { success: true, url: publicUrl, storagePath };
  } catch (error: any) {
    logger.error('StorageService.uploadVideo: Failed', { photoId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Upload profile photo to Supabase Storage
 * Compresses to WebP 0.7 quality at 400px width
 */
export const uploadProfilePhoto = async (
  userId: string,
  localUri: string
): Promise<UploadResult> => {
  try {
    logger.debug('StorageService.uploadProfilePhoto: Starting', { userId });

    const compressedUri = await compressImage(localUri, { width: 400, quality: 0.7 });
    const arrayBuffer = await readFileAsArrayBuffer(compressedUri);
    const storagePath = `${userId}/profile.webp`;

    const { error } = await supabase.storage
      .from('profile-photos')
      .upload(storagePath, arrayBuffer, {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000',
        upsert: true,
      });

    if (error) {
      logger.error('StorageService.uploadProfilePhoto: Upload failed', {
        userId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('profile-photos').getPublicUrl(storagePath);

    logger.info('StorageService.uploadProfilePhoto: Upload successful', { userId });
    return { success: true, url: publicUrl, storagePath };
  } catch (error: any) {
    logger.error('StorageService.uploadProfilePhoto: Failed', { userId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Upload selects (highlights) photos to Supabase Storage
 * Compresses each to WebP 0.7 at 400px width
 */
export const uploadSelectsPhotos = async (
  userId: string,
  localUris: string[]
): Promise<SelectsUploadResult> => {
  try {
    logger.info('StorageService.uploadSelectsPhotos: Starting', {
      userId,
      count: localUris.length,
    });

    const photoURLs: string[] = [];

    for (let i = 0; i < localUris.length; i++) {
      const uri = localUris[i];

      // Skip already-uploaded URLs
      if (uri.startsWith('https://') || uri.startsWith('http://')) {
        photoURLs.push(uri);
        continue;
      }

      const compressedUri = await compressImage(uri, { width: 400, quality: 0.7 });
      const arrayBuffer = await readFileAsArrayBuffer(compressedUri);
      const storagePath = `${userId}/select_${i}.webp`;

      const { error } = await supabase.storage.from('selects').upload(storagePath, arrayBuffer, {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000',
        upsert: true,
      });

      if (error) {
        logger.error('StorageService.uploadSelectsPhotos: Upload failed', {
          index: i,
          error: error.message,
        });
        return { success: false, error: error.message };
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('selects').getPublicUrl(storagePath);

      photoURLs.push(publicUrl);

      logger.debug('StorageService.uploadSelectsPhotos: Uploaded', {
        index: i,
        total: localUris.length,
      });
    }

    logger.info('StorageService.uploadSelectsPhotos: All uploaded', {
      userId,
      count: photoURLs.length,
    });
    return { success: true, photoURLs };
  } catch (error: any) {
    logger.error('StorageService.uploadSelectsPhotos: Failed', { userId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Upload comment image to Supabase Storage
 * Compresses to WebP 0.9 at 1080px width
 */
export const uploadCommentImage = async (
  localUri: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    logger.debug('StorageService.uploadCommentImage: Starting');

    const uuid = generateUUID();
    const compressedUri = await compressImage(localUri, { width: 1080, quality: 0.9 });
    const arrayBuffer = await readFileAsArrayBuffer(compressedUri);
    const storagePath = `${uuid}.webp`;

    const { error } = await supabase.storage
      .from('comment-images')
      .upload(storagePath, arrayBuffer, {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000',
        upsert: false,
      });

    if (error) {
      logger.error('StorageService.uploadCommentImage: Upload failed', { error: error.message });
      return { success: false, error: error.message };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('comment-images').getPublicUrl(storagePath);

    logger.info('StorageService.uploadCommentImage: Upload successful');
    return { success: true, url: publicUrl };
  } catch (error: any) {
    logger.error('StorageService.uploadCommentImage: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Upload snap photo to Supabase Storage (private bucket)
 * Compresses to WebP 0.9 at 1080px width
 * Does NOT return a public URL -- snaps use signed URLs
 */
export const uploadSnapPhoto = async (
  userId: string,
  snapId: string,
  localUri: string
): Promise<{ success: boolean; storagePath?: string; error?: string }> => {
  try {
    logger.debug('StorageService.uploadSnapPhoto: Starting', { userId, snapId });

    const compressedUri = await compressImage(localUri, { width: 1080, quality: 0.9 });
    const arrayBuffer = await readFileAsArrayBuffer(compressedUri);
    const storagePath = `${userId}/${snapId}.webp`;

    const { error } = await supabase.storage.from('snaps').upload(storagePath, arrayBuffer, {
      contentType: 'image/webp',
      upsert: false,
    });

    if (error) {
      logger.error('StorageService.uploadSnapPhoto: Upload failed', {
        snapId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    logger.info('StorageService.uploadSnapPhoto: Upload successful', { snapId });
    return { success: true, storagePath };
  } catch (error: any) {
    logger.error('StorageService.uploadSnapPhoto: Failed', { snapId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Delete photo from Supabase Storage
 */
export const deletePhoto = async (userId: string, photoId: string): Promise<DeleteResult> => {
  try {
    logger.debug('StorageService.deletePhoto: Starting', { userId, photoId });

    const { error } = await supabase.storage
      .from('photos')
      .remove([`photos/${userId}/${photoId}.webp`]);

    if (error) {
      logger.error('StorageService.deletePhoto: Failed', { userId, photoId, error: error.message });
      return { success: false, error: error.message };
    }

    logger.info('StorageService.deletePhoto: Deleted', { userId, photoId });
    return { success: true };
  } catch (error: any) {
    logger.error('StorageService.deletePhoto: Failed', { userId, photoId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Delete profile photo from Supabase Storage
 */
export const deleteProfilePhoto = async (userId: string): Promise<DeleteResult> => {
  try {
    logger.debug('StorageService.deleteProfilePhoto: Starting', { userId });

    const { error } = await supabase.storage
      .from('profile-photos')
      .remove([`${userId}/profile.webp`]);

    if (error) {
      logger.error('StorageService.deleteProfilePhoto: Failed', {
        userId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    logger.info('StorageService.deleteProfilePhoto: Deleted', { userId });
    return { success: true };
  } catch (error: any) {
    logger.error('StorageService.deleteProfilePhoto: Failed', { userId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Get public URL for a photo
 */
export const getPhotoURL = async (userId: string, photoId: string): Promise<UrlResult> => {
  try {
    logger.debug('StorageService.getPhotoURL: Starting', { userId, photoId });

    const storagePath = `photos/${userId}/${photoId}.webp`;
    const {
      data: { publicUrl },
    } = supabase.storage.from('photos').getPublicUrl(storagePath);

    logger.info('StorageService.getPhotoURL: Retrieved', { userId, photoId });
    return { success: true, url: publicUrl };
  } catch (error: any) {
    logger.error('StorageService.getPhotoURL: Failed', { userId, photoId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Generate a tiny thumbnail for a photo
 * Resizes to 20px wide JPEG at 0.5 quality, returns base64 data URI
 */
export const generateThumbnail = async (uri: string): Promise<string | null> => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 20 } }],
      { format: ImageManipulator.SaveFormat.JPEG, compress: 0.5 }
    );

    const base64 = await FileSystem.readAsStringAsync(result.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return `data:image/jpeg;base64,${base64}`;
  } catch (error: any) {
    logger.error('StorageService.generateThumbnail: Failed', { error: error.message });
    return null;
  }
};
