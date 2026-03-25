import * as FileSystem from 'expo-file-system/legacy';
import logger from '../utils/logger';

export const downloadForWaveform = async (previewUrl: string, songId: string): Promise<string> => {
  const localPath = `${FileSystem.cacheDirectory}preview_${songId}.m4a`;

  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      logger.debug('audioDownloader: Using cached file', { songId });
      return localPath;
    }

    logger.info('audioDownloader: Downloading preview', { songId });
    const download = await FileSystem.downloadAsync(previewUrl, localPath);

    if (download.status !== 200) {
      throw new Error(`Download failed with status ${download.status}`);
    }

    logger.info('audioDownloader: Download complete', { songId, uri: download.uri });
    return download.uri;
  } catch (err) {
    const error = err as Error;
    logger.error('audioDownloader: Failed to download', { songId, error: error.message });
    throw error;
  }
};

export const clearCachedAudio = async (songId: string): Promise<void> => {
  const localPath = `${FileSystem.cacheDirectory}preview_${songId}.m4a`;
  try {
    await FileSystem.deleteAsync(localPath, { idempotent: true });
    logger.debug('audioDownloader: Cleared cache', { songId });
  } catch {
    logger.warn('audioDownloader: Failed to clear cache', { songId });
  }
};

export const isAudioCached = async (songId: string): Promise<boolean> => {
  const localPath = `${FileSystem.cacheDirectory}preview_${songId}.m4a`;
  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    return fileInfo.exists;
  } catch {
    return false;
  }
};
