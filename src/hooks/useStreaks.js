/**
 * useStreak and useStreakMap Hooks
 *
 * Provides real-time streak data to UI components:
 * - useStreak: Single conversation streak with local countdown timer
 * - useStreakMap: Batch streak data for messages list (single Firestore listener)
 *
 * These hooks bridge the server-side streak engine (Cloud Functions)
 * and the UI components (StreakIndicator, ConversationRow, etc.).
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import {
  subscribeToStreak,
  subscribeToUserStreaks,
  deriveStreakState,
  getStreakColor,
} from '../services/firebase/streakService';

import logger from '../utils/logger';

/**
 * useStreak Hook
 *
 * Provides real-time streak data for a single conversation.
 * Used by ConversationScreen/ConversationHeader.
 *
 * Features:
 * - Subscribes to a single streak document via streakService
 * - Derives visual state and color from raw data
 * - Local countdown timer updates every 60s for expiry awareness
 * - Sets isExpired=true locally when countdown hits zero (instant UI feedback
 *   before Cloud Function updates the document)
 *
 * @param {string|null} currentUserId - Current user's UID
 * @param {string|null} friendId - Friend's UID
 * @returns {object} Streak state for the conversation
 */
export const useStreak = (currentUserId, friendId) => {
  const [streakData, setStreakData] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isExpired, setIsExpired] = useState(false);
  const intervalRef = useRef(null);

  // Subscribe to streak document
  useEffect(() => {
    if (!currentUserId || !friendId) {
      setStreakData(null);
      setTimeRemaining(null);
      setIsExpired(false);
      return;
    }

    logger.debug('useStreak: Subscribing', { currentUserId, friendId });

    const unsubscribe = subscribeToStreak(currentUserId, friendId, data => {
      logger.debug('useStreak: Data received', {
        hasData: !!data,
        dayCount: data?.dayCount,
      });
      setStreakData(data);
    });

    return () => {
      logger.debug('useStreak: Cleaning up subscription');
      unsubscribe();
    };
  }, [currentUserId, friendId]);

  // Local countdown timer (Research Pitfall 7)
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!streakData?.expiresAt) {
      setTimeRemaining(null);
      setIsExpired(false);
      return;
    }

    const computeRemaining = () => {
      const expiresAtMs = streakData.expiresAt.toMillis
        ? streakData.expiresAt.toMillis()
        : streakData.expiresAt.toDate
          ? streakData.expiresAt.toDate().getTime()
          : new Date(streakData.expiresAt).getTime();

      const remaining = expiresAtMs - Date.now();

      if (remaining <= 0) {
        setTimeRemaining(0);
        setIsExpired(true);
      } else {
        setTimeRemaining(remaining);
        setIsExpired(false);
      }
    };

    // Compute immediately
    computeRemaining();

    // Update every 60 seconds
    intervalRef.current = setInterval(computeRemaining, 60000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [streakData?.expiresAt]);

  // Derive state and color from raw data
  const streakState = useMemo(
    () => deriveStreakState(streakData, currentUserId),
    [streakData, currentUserId]
  );

  const dayCount = streakData?.dayCount || 0;

  const streakColor = useMemo(() => getStreakColor(streakState, dayCount), [streakState, dayCount]);

  return {
    streakData,
    streakState,
    dayCount,
    streakColor,
    timeRemaining,
    isExpired,
  };
};

/**
 * useStreakMap Hook
 *
 * Provides batch streak data for ALL conversations at once.
 * Used by MessagesList/ConversationRow to avoid N+1 Firestore listeners
 * (Research Pitfall 6: single-listener approach).
 *
 * Returns a lookup map keyed by streak ID with derived state for each streak.
 *
 * @param {string|null} userId - Current user's UID
 * @returns {object} { streakMap, loading }
 */
export const useStreakMap = userId => {
  const [streakMap, setStreakMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setStreakMap({});
      setLoading(false);
      return;
    }

    logger.debug('useStreakMap: Subscribing', { userId });
    setLoading(true);

    const unsubscribe = subscribeToUserStreaks(userId, streaks => {
      logger.debug('useStreakMap: Data received', {
        streakCount: streaks.length,
      });

      const map = {};
      streaks.forEach(streak => {
        const state = deriveStreakState(streak, userId);
        const color = getStreakColor(state, streak.dayCount || 0);
        map[streak.id] = {
          dayCount: streak.dayCount || 0,
          streakState: state,
          streakColor: color,
          expiresAt: streak.expiresAt || null,
          warning: streak.warning || false,
        };
      });

      setStreakMap(map);
      setLoading(false);
    });

    return () => {
      logger.debug('useStreakMap: Cleaning up subscription');
      unsubscribe();
    };
  }, [userId]);

  return { streakMap, loading };
};
