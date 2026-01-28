/**
 * Audio Downloader Service
 *
 * Downloads audio files for waveform generation.
 * Waveform library requires local file path, not remote URL.
 *
 * Uses expo-file-system for cross-platform file operations.
 */

import * as FileSystem from 'expo-file-system';
import logger from '../utils/logger';

/**
 * Download audio file for waveform generation.
 * Waveform library requires local file path.
 *
 * @param {string} previewUrl - Remote audio URL
 * @param {string} songId - Unique song ID for cache key
 * @returns {Promise<string>} Local file path
 */
export const downloadForWaveform = async (previewUrl, songId) => {
  const localPath = `${FileSystem.cacheDirectory}preview_${songId}.m4a`;

  try {
    // Check if already cached
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      logger.debug('audioDownloader: Using cached file', { songId });
      return localPath;
    }

    // Download file
    logger.info('audioDownloader: Downloading preview', { songId });
    const download = await FileSystem.downloadAsync(previewUrl, localPath);

    if (download.status !== 200) {
      throw new Error(`Download failed with status ${download.status}`);
    }

    logger.info('audioDownloader: Download complete', { songId, uri: download.uri });
    return download.uri;
  } catch (error) {
    logger.error('audioDownloader: Failed to download', { songId, error: error.message });
    throw error;
  }
};

/**
 * Clear cached audio file.
 *
 * @param {string} songId - Unique song ID
 */
export const clearCachedAudio = async songId => {
  const localPath = `${FileSystem.cacheDirectory}preview_${songId}.m4a`;
  try {
    await FileSystem.deleteAsync(localPath, { idempotent: true });
    logger.debug('audioDownloader: Cleared cache', { songId });
  } catch (_error) {
    logger.warn('audioDownloader: Failed to clear cache', { songId });
  }
};

/**
 * Check if audio file is cached.
 *
 * @param {string} songId - Unique song ID
 * @returns {Promise<boolean>} True if cached
 */
export const isAudioCached = async songId => {
  const localPath = `${FileSystem.cacheDirectory}preview_${songId}.m4a`;
  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    return fileInfo.exists;
  } catch (_error) {
    return false;
  }
};
