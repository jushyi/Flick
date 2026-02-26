/**
 * usePinPreference — Per-friend sticky pin preference via AsyncStorage
 *
 * Remembers whether the sender has "pin to screen" enabled for each friend.
 * The preference persists across app restarts via AsyncStorage.
 * Also tracks whether the user has seen the one-time pin tooltip.
 *
 * Usage:
 *   const { pinEnabled, togglePin, loaded, showTooltip, dismissTooltip } = usePinPreference(friendId);
 */

import { useState, useEffect, useCallback } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import logger from '../utils/logger';

const PIN_KEY_PREFIX = 'pin_pref_';
const TOOLTIP_SHOWN_KEY = 'pin_tooltip_shown';

/**
 * @param {string} friendId - The friend's user ID
 * @returns {{ pinEnabled: boolean, togglePin: (value: boolean) => void, loaded: boolean, showTooltip: boolean, dismissTooltip: () => void }}
 */
const usePinPreference = friendId => {
  const [pinEnabled, setPinEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Load preference and tooltip state from AsyncStorage on mount / friendId change
  useEffect(() => {
    let cancelled = false;

    const loadPreference = async () => {
      try {
        setLoaded(false);

        const [pinValue, tooltipValue] = await Promise.all([
          AsyncStorage.getItem(`${PIN_KEY_PREFIX}${friendId}`),
          AsyncStorage.getItem(TOOLTIP_SHOWN_KEY),
        ]);

        if (cancelled) return;

        setPinEnabled(pinValue === 'true');
        setShowTooltip(tooltipValue !== 'true');
        setLoaded(true);
      } catch (error) {
        logger.error('Failed to load pin preference', { friendId, error: error.message });
        if (!cancelled) {
          setPinEnabled(false);
          setShowTooltip(false);
          setLoaded(true);
        }
      }
    };

    if (friendId) {
      loadPreference();
    }

    return () => {
      cancelled = true;
    };
  }, [friendId]);

  // Toggle pin state and persist
  const togglePin = useCallback(
    async value => {
      setPinEnabled(value);
      try {
        await AsyncStorage.setItem(`${PIN_KEY_PREFIX}${friendId}`, String(value));
        logger.debug('Pin preference updated', { friendId, pinEnabled: value });
      } catch (error) {
        logger.error('Failed to persist pin preference', { friendId, error: error.message });
      }
    },
    [friendId]
  );

  // Dismiss tooltip and persist
  const dismissTooltip = useCallback(async () => {
    setShowTooltip(false);
    try {
      await AsyncStorage.setItem(TOOLTIP_SHOWN_KEY, 'true');
    } catch (error) {
      logger.error('Failed to persist tooltip dismissal', { error: error.message });
    }
  }, []);

  return { pinEnabled, togglePin, loaded, showTooltip, dismissTooltip };
};

export default usePinPreference;
