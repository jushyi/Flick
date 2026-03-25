/**
 * Sound Utilities
 *
 * Audio playback utilities for the app.
 * Uses expo-audio for cross-platform audio support.
 *
 * Default behavior respects iOS silent mode (no sound when muted).
 */

import { createAudioPlayer } from 'expo-audio';
import logger from './logger';

/**
 * Play the success sound when user completes photo triage.
 * Sound plays in sync with the success animation.
 *
 * Features:
 * - Checks user's sound effects preference (opt-in model, default: false)
 * - Respects iOS silent mode (no sound when device is muted)
 * - Auto-removes after playback to prevent memory leaks
 * - Silent failure - sound is enhancement, not critical
 *
 * @param {boolean} effectsEnabled - User's sound effects preference (default: false)
 * @returns {Promise<void>}
 */
export const playSuccessSound = async (effectsEnabled = false) => {
  // Check user preference first
  if (!effectsEnabled) {
    logger.debug('soundUtils: Sound effects disabled by user preference');
    return;
  }

  logger.debug('soundUtils: Playing success sound');

  try {
    const player = createAudioPlayer(require('../../assets/theburntpeanut-hooray.mp3'));

    // Set up listener to remove player when playback finishes
    const listener = player.addListener('playbackStatusUpdate', status => {
      if (status.didJustFinish) {
        logger.debug('soundUtils: Sound playback finished, unloading');
        try {
          listener.remove();
          player.remove();
        } catch (err) {
          logger.warn('soundUtils: Failed to unload sound', { error: err?.message });
        }
      }
    });

    player.play();
    logger.info('soundUtils: Success sound playing');
  } catch (error) {
    // Silent failure - sound is an enhancement, not critical functionality
    logger.error('soundUtils: Failed to play success sound', { error: error?.message });
  }
};
