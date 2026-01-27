/**
 * GifPicker - Giphy SDK Helper
 *
 * Provides initialization and selection hooks for the Giphy SDK.
 *
 * IMPORTANT: This module requires:
 * 1. A Giphy API key (get free key at https://developers.giphy.com/)
 * 2. A dev client build (not Expo Go) - run `npx expo prebuild && npx expo run:ios`
 *
 * Usage:
 * 1. Initialize in App.js: initializeGiphy('YOUR_API_KEY')
 * 2. In component: useGifSelection(handleGifSelected)
 * 3. Call openGifPicker() to show the dialog
 */
import { useEffect } from 'react';
import { GiphyDialog, GiphyDialogEvent, GiphySDK, GiphyContentType } from '@giphy/react-native-sdk';
import logger from '../../utils/logger';

/**
 * Initialize the Giphy SDK
 * Call this once at app startup (in App.js)
 *
 * @param {string} apiKey - Your Giphy API key from https://developers.giphy.com/
 */
export const initializeGiphy = apiKey => {
  if (!apiKey || apiKey === 'YOUR_GIPHY_API_KEY') {
    logger.warn('GifPicker: Giphy SDK not initialized - missing or placeholder API key');
    return;
  }

  try {
    GiphySDK.configure({ apiKey });
    logger.info('GifPicker: Giphy SDK initialized');
  } catch (error) {
    logger.error('GifPicker: Failed to initialize Giphy SDK', { error: error.message });
  }
};

/**
 * Open the Giphy dialog for GIF selection
 * Shows both GIFs and Stickers, no confirmation screen
 */
export const openGifPicker = () => {
  logger.info('GifPicker: Opening dialog');

  try {
    GiphyDialog.configure({
      mediaTypeConfig: [GiphyContentType.Gif, GiphyContentType.Sticker],
      showConfirmationScreen: false,
    });
    GiphyDialog.show();
  } catch (error) {
    logger.error('GifPicker: Failed to open dialog', { error: error.message });
  }
};

/**
 * Hook to handle GIF selection from the Giphy dialog
 * Sets up a listener for media selection events
 *
 * @param {function} onGifSelected - Callback with GIF URL when selected
 */
export const useGifSelection = onGifSelected => {
  useEffect(() => {
    logger.debug('GifPicker: Setting up selection listener');

    const listener = GiphyDialog.addListener(GiphyDialogEvent.MediaSelected, event => {
      logger.info('GifPicker: Media selected', {
        type: event.media?.type,
        hasUrl: !!event.media?.url,
      });

      // Get the GIF URL - prefer fixed_height for comments (smaller, faster loading)
      const gifUrl =
        event.media?.images?.fixed_height?.url ||
        event.media?.images?.downsized?.url ||
        event.media?.url;

      if (gifUrl && onGifSelected) {
        logger.debug('GifPicker: Calling onGifSelected', { urlLength: gifUrl.length });
        onGifSelected(gifUrl);
      }

      // Hide dialog after selection
      GiphyDialog.hide();
    });

    return () => {
      logger.debug('GifPicker: Removing selection listener');
      listener.remove();
    };
  }, [onGifSelected]);
};

export default {
  initializeGiphy,
  openGifPicker,
  useGifSelection,
};
