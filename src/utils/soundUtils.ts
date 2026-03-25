import { createAudioPlayer } from 'expo-audio';
import logger from './logger';

export const playSuccessSound = async (effectsEnabled = false): Promise<void> => {
  if (!effectsEnabled) {
    logger.debug('soundUtils: Sound effects disabled by user preference');
    return;
  }

  logger.debug('soundUtils: Playing success sound');

  try {
    const player = createAudioPlayer(require('../../assets/theburntpeanut-hooray.mp3'));

    const listener = player.addListener('playbackStatusUpdate', (status: { didJustFinish?: boolean }) => {
      if (status.didJustFinish) {
        logger.debug('soundUtils: Sound playback finished, unloading');
        try {
          listener.remove();
          player.remove();
        } catch (err) {
          const e = err as Error;
          logger.warn('soundUtils: Failed to unload sound', { error: e?.message });
        }
      }
    });

    player.play();
    logger.info('soundUtils: Success sound playing');
  } catch (err) {
    const error = err as Error;
    logger.error('soundUtils: Failed to play success sound', { error: error?.message });
  }
};
