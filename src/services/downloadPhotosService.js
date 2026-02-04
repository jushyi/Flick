/**
 * Download Photos Service
 *
 * Downloads all user photos to device camera roll.
 * Used before account deletion to preserve memories.
 */

import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { getUserPhotos } from './firebase/photoService';
import logger from '../utils/logger';

/**
 * Request media library permissions
 * @returns {Promise<boolean>} - Whether permission was granted
 */
export const requestMediaLibraryPermission = async () => {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  return status === 'granted';
};

/**
 * Download all user photos to camera roll
 * @param {string} userId - User ID
 * @param {function} onProgress - Callback with { current, total, photoId }
 * @returns {Promise<{ success: boolean, downloaded: number, failed: number, error?: string }>}
 */
export const downloadAllPhotos = async (userId, onProgress) => {
  logger.info('downloadPhotosService.downloadAllPhotos: Starting', { userId });

  // 1. Request permission (return early if denied)
  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) {
    logger.warn('downloadPhotosService.downloadAllPhotos: Permission denied');
    return {
      success: false,
      downloaded: 0,
      failed: 0,
      error: 'Media library permission denied',
    };
  }

  // 2. Get all user photos via getUserPhotos
  const photosResult = await getUserPhotos(userId);
  if (!photosResult.success) {
    logger.error('downloadPhotosService.downloadAllPhotos: Failed to get photos', {
      error: photosResult.error,
    });
    return {
      success: false,
      downloaded: 0,
      failed: 0,
      error: photosResult.error,
    };
  }

  const photos = photosResult.photos || [];
  const total = photos.length;

  if (total === 0) {
    logger.info('downloadPhotosService.downloadAllPhotos: No photos to download');
    return { success: true, downloaded: 0, failed: 0 };
  }

  logger.info('downloadPhotosService.downloadAllPhotos: Found photos', { total });

  // 3. Create album "Rewind Export" (or use existing)
  let album = await MediaLibrary.getAlbumAsync('Rewind Export');
  if (!album) {
    logger.debug('downloadPhotosService.downloadAllPhotos: Creating Rewind Export album');
  }

  let downloaded = 0;
  let failed = 0;

  // 4. For each photo, download and save to camera roll
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const photoId = photo.id;
    const imageURL = photo.imageURL;

    if (!imageURL) {
      logger.warn('downloadPhotosService.downloadAllPhotos: Photo has no imageURL', { photoId });
      failed++;
      continue;
    }

    try {
      // a. Download from imageURL to FileSystem.cacheDirectory
      const localUri = FileSystem.cacheDirectory + `${photoId}.jpg`;
      const downloadResult = await FileSystem.downloadAsync(imageURL, localUri);

      if (downloadResult.status !== 200) {
        logger.warn('downloadPhotosService.downloadAllPhotos: Download failed', {
          photoId,
          status: downloadResult.status,
        });
        failed++;
        continue;
      }

      // b. Save to MediaLibrary via createAssetAsync
      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);

      // c. Add to album
      if (!album) {
        // Create album with first asset
        album = await MediaLibrary.createAlbumAsync('Rewind Export', asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }

      // d. Delete cache file
      await FileSystem.deleteAsync(localUri, { idempotent: true });

      downloaded++;
      logger.debug('downloadPhotosService.downloadAllPhotos: Photo saved', {
        photoId,
        downloaded,
        total,
      });
    } catch (error) {
      logger.warn('downloadPhotosService.downloadAllPhotos: Error saving photo', {
        photoId,
        error: error.message,
      });
      failed++;
    }

    // e. Call onProgress
    if (onProgress) {
      onProgress({ current: i + 1, total, photoId });
    }
  }

  logger.info('downloadPhotosService.downloadAllPhotos: Complete', {
    downloaded,
    failed,
    total,
  });

  // 5. Return result
  return {
    success: true,
    downloaded,
    failed,
  };
};
