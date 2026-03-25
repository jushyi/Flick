import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { getUserPhotos } from './firebase/photoService';
import logger from '../utils/logger';

interface DownloadProgress {
  current: number;
  total: number;
  photoId: string;
}

interface DownloadResult {
  success: boolean;
  downloaded: number;
  failed: number;
  error?: string;
}

export const requestMediaLibraryPermission = async (): Promise<boolean> => {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  return status === 'granted';
};

export const downloadAllPhotos = async (
  userId: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<DownloadResult> => {
  logger.info('downloadPhotosService.downloadAllPhotos: Starting', { userId });

  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) {
    logger.warn('downloadPhotosService.downloadAllPhotos: Permission denied');
    return { success: false, downloaded: 0, failed: 0, error: 'Media library permission denied' };
  }

  const photosResult = await getUserPhotos(userId);
  if (!photosResult.success) {
    logger.error('downloadPhotosService.downloadAllPhotos: Failed to get photos', {
      error: photosResult.error,
    });
    return { success: false, downloaded: 0, failed: 0, error: photosResult.error };
  }

  const photos = photosResult.photos || [];
  const total = photos.length;

  if (total === 0) {
    logger.info('downloadPhotosService.downloadAllPhotos: No photos to download');
    return { success: true, downloaded: 0, failed: 0 };
  }

  logger.info('downloadPhotosService.downloadAllPhotos: Found photos', { total });

  let album = await MediaLibrary.getAlbumAsync('Flick Export');

  let downloaded = 0;
  let failed = 0;

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

      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);

      if (!album) {
        album = await MediaLibrary.createAlbumAsync('Flick Export', asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }

      await FileSystem.deleteAsync(localUri, { idempotent: true });

      downloaded++;
      logger.debug('downloadPhotosService.downloadAllPhotos: Photo saved', {
        photoId,
        downloaded,
        total,
      });
    } catch (err) {
      const error = err as Error;
      logger.warn('downloadPhotosService.downloadAllPhotos: Error saving photo', {
        photoId,
        error: error.message,
      });
      failed++;
    }

    if (onProgress) {
      onProgress({ current: i + 1, total, photoId });
    }
  }

  logger.info('downloadPhotosService.downloadAllPhotos: Complete', { downloaded, failed, total });

  return { success: true, downloaded, failed };
};
