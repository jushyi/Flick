import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import logger from '../utils/logger';

setAudioModeAsync({
  allowsRecording: false,
  shouldPlayInBackground: false,
  playsInSilentMode: true,
  interruptionMode: 'duckOthers',
  shouldRouteThroughEarpiece: false,
}).catch((err: Error) => {
  logger.error('audioPlayer: Failed to set audio mode', { error: err?.message });
});

let currentPlayer: AudioPlayer | null = null;
let statusListener: { remove: () => void } | null = null;
let clipEndTimeout: ReturnType<typeof setTimeout> | null = null;

interface PlayPreviewOptions {
  clipStart?: number;
  clipEnd?: number;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
}

export const playPreview = async (
  previewUrl: string,
  options: PlayPreviewOptions = {}
): Promise<AudioPlayer | null> => {
  const { clipStart = 0, clipEnd = 30, onProgress, onComplete } = options;

  logger.debug('audioPlayer: Starting playback', { previewUrl, clipStart, clipEnd });

  await stopPreview();

  try {
    const player = createAudioPlayer(previewUrl, { updateInterval: 50 });

    currentPlayer = player;

    statusListener = player.addListener(
      'playbackStatusUpdate',
      (status: { isLoaded?: boolean; currentTime?: number; didJustFinish?: boolean }) => {
        if (!status.isLoaded) return;

        const currentPositionSec = status.currentTime ?? 0;
        const clipDuration = clipEnd - clipStart;
        const elapsed = currentPositionSec - clipStart;
        const progress = Math.min(Math.max(elapsed / clipDuration, 0), 1);

        if (onProgress) {
          onProgress(progress);
        }

        if (currentPositionSec >= clipEnd) {
          logger.debug('audioPlayer: Reached clip end, stopping');
          cleanupPlayer(player);
          if (onComplete) {
            onComplete();
          }
        }

        if (status.didJustFinish) {
          logger.debug('audioPlayer: Playback finished naturally');
          cleanupPlayer(player);
          if (onComplete) {
            onComplete();
          }
        }
      }
    );

    if (clipStart > 0) {
      await player.seekTo(clipStart);
    }

    player.play();
    logger.info('audioPlayer: Playback started');

    const clipDurationMs = (clipEnd - clipStart) * 1000;
    clipEndTimeout = setTimeout(() => {
      logger.debug('audioPlayer: Clip end timeout triggered');
      stopPreview();
      if (onComplete) {
        onComplete();
      }
    }, clipDurationMs + 100);

    return player;
  } catch (err) {
    const error = err as Error;
    logger.error('audioPlayer: Failed to start playback', { error: error?.message });
    return null;
  }
};

export const stopPreview = async (): Promise<void> => {
  logger.debug('audioPlayer: Stopping playback');

  if (clipEndTimeout) {
    clearTimeout(clipEndTimeout);
    clipEndTimeout = null;
  }

  if (currentPlayer) {
    const player = currentPlayer;
    currentPlayer = null;
    cleanupPlayer(player);
  }
};

const cleanupPlayer = (player: AudioPlayer): void => {
  if (!player) return;

  if (statusListener) {
    statusListener.remove();
    statusListener = null;
  }

  try {
    player.pause();
  } catch {
    // May already be paused
  }

  try {
    player.remove();
  } catch {
    // May already be removed
  }
};

export const pausePreview = async (): Promise<void> => {
  if (currentPlayer) {
    try {
      currentPlayer.pause();
      logger.debug('audioPlayer: Paused');
    } catch (err) {
      const error = err as Error;
      logger.debug('audioPlayer: Pause failed', { error: error?.message });
    }
  }
};

export const resumePreview = async (): Promise<void> => {
  if (currentPlayer) {
    try {
      currentPlayer.play();
      logger.debug('audioPlayer: Resumed');
    } catch (err) {
      const error = err as Error;
      logger.debug('audioPlayer: Resume failed', { error: error?.message });
    }
  }
};

export const seekTo = async (seconds: number): Promise<void> => {
  if (currentPlayer) {
    try {
      await currentPlayer.seekTo(seconds);
      logger.debug('audioPlayer: Seeked to', { seconds });
    } catch (err) {
      const error = err as Error;
      logger.debug('audioPlayer: Seek failed', { error: error?.message });
    }
  }
};
