/**
 * Sound Utilities
 *
 * Audio playback utilities for the app.
 * Uses expo-av for cross-platform audio support.
 *
 * Default behavior respects iOS silent mode (no sound when muted).
 */

import { Audio } from 'expo-av';
import logger from './logger';

/**
 * Play the success sound when user completes photo triage.
 * Sound plays in sync with the success animation.
 *
 * Features:
 * - Respects iOS silent mode (no sound when device is muted)
 * - Auto-unloads after playback to prevent memory leaks
 * - Silent failure - sound is enhancement, not critical
 *
 * @returns {Promise<void>}
 */
export const playSuccessSound = async () => {
  logger.debug('soundUtils: Playing success sound');

  try {
    // Load the sound file
    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/theburntpeanut-hooray.mp3')
    );

    // Set up listener to unload sound when playback finishes
    sound.setOnPlaybackStatusUpdate(status => {
      if (status.didJustFinish) {
        logger.debug('soundUtils: Sound playback finished, unloading');
        sound.unloadAsync().catch(err => {
          logger.warn('soundUtils: Failed to unload sound', { error: err?.message });
        });
      }
    });

    // Play the sound
    await sound.playAsync();
    logger.info('soundUtils: Success sound playing');
  } catch (error) {
    // Silent failure - sound is an enhancement, not critical functionality
    logger.error('soundUtils: Failed to play success sound', { error: error?.message });
  }
};
