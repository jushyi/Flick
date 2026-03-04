/**
 * usePinPreference - Per-friend sticky pin preference hook
 *
 * Manages the "pin to screen" toggle state for each friend.
 * Persists preferences to AsyncStorage with key prefix `pin_pref_`.
 * Tracks whether the explanatory tooltip has been shown.
 *
 * Usage:
 *   const { pinEnabled, togglePin, loaded, showTooltip, dismissTooltip } = usePinPreference(friendId);
 */

import { useState, useEffect, useCallback } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import logger from '../utils/logger';

const PIN_KEY_PREFIX = 'pin_pref_';
const TOOLTIP_SHOWN_KEY = 'pin_tooltip_shown';

export const usePinPreference = friendId => {
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
      } catch (error) {
        logger.error('Failed to load pin preferences', { error: error.message, friendId });
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
    async value => {
      setPinEnabled(value);
      try {
        await AsyncStorage.setItem(`${PIN_KEY_PREFIX}${friendId}`, String(value));
        logger.debug('Pin preference updated', { friendId, pinEnabled: value });
      } catch (error) {
        logger.error('Failed to save pin preference', { error: error.message, friendId });
      }
    },
    [friendId]
  );

  const dismissTooltip = useCallback(async () => {
    setShowTooltip(false);
    try {
      await AsyncStorage.setItem(TOOLTIP_SHOWN_KEY, 'true');
    } catch (error) {
      logger.error('Failed to save tooltip dismissal', { error: error.message });
    }
  }, []);

  return { pinEnabled, togglePin, loaded, showTooltip, dismissTooltip };
};
