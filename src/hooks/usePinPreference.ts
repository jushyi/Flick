import { useState, useEffect, useCallback } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import logger from '../utils/logger';

const PIN_KEY_PREFIX = 'pin_pref_';
const TOOLTIP_SHOWN_KEY = 'pin_tooltip_shown';

type UsePinPreferenceReturn = {
  pinEnabled: boolean;
  togglePin: (value: boolean) => Promise<void>;
  loaded: boolean;
  showTooltip: boolean;
  dismissTooltip: () => Promise<void>;
};

export const usePinPreference = (friendId: string): UsePinPreferenceReturn => {
  const [pinEnabled, setPinEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadPreferences = async () => {
      try {
        const [pinVal, tooltipVal] = await Promise.all([
          AsyncStorage.getItem(`${PIN_KEY_PREFIX}${friendId}`),
          AsyncStorage.getItem(TOOLTIP_SHOWN_KEY),
        ]);

        if (!cancelled) {
          setPinEnabled(pinVal === 'true');
          setShowTooltip(tooltipVal !== 'true');
          setLoaded(true);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Failed to load pin preferences', { error: message, friendId });
        if (!cancelled) {
          setLoaded(true);
        }
      }
    };

    setLoaded(false);
    loadPreferences();

    return () => {
      cancelled = true;
    };
  }, [friendId]);

  const togglePin = useCallback(
    async (value: boolean) => {
      setPinEnabled(value);
      try {
        await AsyncStorage.setItem(`${PIN_KEY_PREFIX}${friendId}`, String(value));
        logger.debug('Pin preference updated', { friendId, pinEnabled: value });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Failed to save pin preference', { error: message, friendId });
      }
    },
    [friendId]
  );

  const dismissTooltip = useCallback(async () => {
    setShowTooltip(false);
    try {
      await AsyncStorage.setItem(TOOLTIP_SHOWN_KEY, 'true');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to save tooltip dismissal', { error: message });
    }
  }, []);

  return { pinEnabled, togglePin, loaded, showTooltip, dismissTooltip };
};
