/**
 * Audio Player Service
 *
 * Provides audio preview playback for profile songs with:
 * - Clip range support (start/end positions)
 * - Progress callbacks
 *
 * Uses expo-audio for cross-platform audio support.
 */

import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import logger from '../utils/logger';

// Configure audio to play even in silent mode (like music apps)
// This must be called before any sound is played
setAudioModeAsync({
  allowsRecording: false,
  shouldPlayInBackground: false, // Songs stop when navigating away
  playsInSilentMode: true, // Key setting: play through speakers regardless of silent switch
  interruptionMode: 'duckOthers',
  shouldRouteThroughEarpiece: false,
}).catch(error => {
  logger.error('audioPlayer: Failed to set audio mode', { error: error?.message });
});

// Module-level state for single player instance
let currentPlayer = null;
let statusListener = null;
let clipEndTimeout = null;

/**
 * Play a preview clip with optional start/end positions and fade out.
 *
 * @param {string} previewUrl - URL of the audio preview
 * @param {Object} options - Playback options
 * @param {number} options.clipStart - Start position in seconds (default 0)
 * @param {number} options.clipEnd - End position in seconds (default 30)
 * @param {function} options.onProgress - Progress callback (receives 0-1)
 * @param {function} options.onComplete - Called when playback ends
 * @returns {Promise<AudioPlayer|null>} Player object for external control
 */
export const playPreview = async (previewUrl, options = {}) => {
  const { clipStart = 0, clipEnd = 30, onProgress, onComplete } = options;

  logger.debug('audioPlayer: Starting playback', { previewUrl, clipStart, clipEnd });

  // Stop any existing playback first
  await stopPreview();

  try {
    // Create new player instance
    const player = createAudioPlayer(previewUrl, { updateInterval: 50 });

    currentPlayer = player;

    // Set up playback status update handler
    statusListener = player.addListener('playbackStatusUpdate', status => {
      if (!status.isLoaded) return;

      const currentPositionSec = status.currentTime;
      const clipDuration = clipEnd - clipStart;
      const elapsed = currentPositionSec - clipStart;

      // Calculate progress within clip range (0-1)
      const progress = Math.min(Math.max(elapsed / clipDuration, 0), 1);

      if (onProgress) {
        onProgress(progress);
      }

      // Stop at clip end (immediate cut, no fade)
      if (currentPositionSec >= clipEnd) {
        logger.debug('audioPlayer: Reached clip end, stopping');
        cleanupPlayer(player);
        if (onComplete) {
          onComplete();
        }
      }

      // Handle natural playback completion
      if (status.didJustFinish) {
        logger.debug('audioPlayer: Playback finished naturally');
        cleanupPlayer(player);
        if (onComplete) {
          onComplete();
        }
      }
    });

    // Seek to clip start position
    if (clipStart > 0) {
      await player.seekTo(clipStart);
    }

    // Start playback
    player.play();
    logger.info('audioPlayer: Playback started');

    // Backup timeout to ensure playback stops at clipEnd
    const clipDurationMs = (clipEnd - clipStart) * 1000;
    clipEndTimeout = setTimeout(() => {
      logger.debug('audioPlayer: Clip end timeout triggered');
      stopPreview();
      if (onComplete) {
        onComplete();
      }
    }, clipDurationMs + 100); // Small buffer

    return player;
  } catch (error) {
    logger.error('audioPlayer: Failed to start playback', { error: error?.message });
    return null;
  }
};

/**
 * Stop current preview playback immediately.
 */
export const stopPreview = async () => {
  logger.debug('audioPlayer: Stopping playback');

  // Clear timeout
  if (clipEndTimeout) {
    clearTimeout(clipEndTimeout);
    clipEndTimeout = null;
  }

  // Stop immediately (no fade)
  if (currentPlayer) {
    const player = currentPlayer;
    currentPlayer = null;
    cleanupPlayer(player);
  }
};

/**
 * Clean up a player instance (pause and release resources).
 *
 * @param {AudioPlayer} player - Player instance to cleanup
 */
const cleanupPlayer = player => {
  if (!player) return;

  // Remove listener first to prevent callbacks on removed player
  if (statusListener) {
    statusListener.remove();
    statusListener = null;
  }

  try {
    player.pause();
  } catch (_error) {
    // Ignore - may already be paused
  }

  try {
    player.remove();
  } catch (_error) {
    // Ignore - may already be removed
  }
};

/**
 * Pause current preview playback.
 */
export const pausePreview = async () => {
  if (currentPlayer) {
    try {
      currentPlayer.pause();
      logger.debug('audioPlayer: Paused');
    } catch (error) {
      logger.debug('audioPlayer: Pause failed', { error: error?.message });
    }
  }
};

/**
 * Resume current preview playback.
 */
export const resumePreview = async () => {
  if (currentPlayer) {
    try {
      currentPlayer.play();
      logger.debug('audioPlayer: Resumed');
    } catch (error) {
      logger.debug('audioPlayer: Resume failed', { error: error?.message });
    }
  }
};

/**
 * Seek to a specific position in the preview.
 *
 * @param {number} seconds - Position to seek to in seconds
 */
export const seekTo = async seconds => {
  if (currentPlayer) {
    try {
      await currentPlayer.seekTo(seconds);
      logger.debug('audioPlayer: Seeked to', { seconds });
    } catch (error) {
      logger.debug('audioPlayer: Seek failed', { error: error?.message });
    }
  }
};
