import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/logger';

const STORAGE_KEY = '@viewed_stories';
const EXPIRY_HOURS = 24; // Reset viewed state after 24 hours

/**
 * Hook for managing viewed stories state with AsyncStorage persistence
 *
 * Features:
 * - Persists viewed state to AsyncStorage
 * - 24-hour expiry for viewed state
 * - Loading state for initial hydration
 *
 * @returns {Object} { isViewed, markAsViewed, loading }
 */
export const useViewedStories = () => {
  const [viewedFriends, setViewedFriends] = useState(new Set());
  const [loading, setLoading] = useState(true);

  /**
   * Load viewed state from AsyncStorage on mount
   */
  const loadViewedState = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const now = Date.now();
        // Filter out expired entries (older than 24 hours)
        const valid = Object.entries(data)
          .filter(([, timestamp]) => now - timestamp < EXPIRY_HOURS * 60 * 60 * 1000)
          .map(([friendId]) => friendId);
        setViewedFriends(new Set(valid));
        logger.debug('useViewedStories: Loaded viewed state', { count: valid.length });
      }
    } catch (error) {
      logger.error('useViewedStories: Failed to load', { error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Load viewed state on mount
  useEffect(() => {
    loadViewedState();
  }, []);

  /**
   * Mark a friend's stories as viewed
   * Updates local state immediately, then persists to AsyncStorage
   *
   * @param {string} friendId - Friend's user ID to mark as viewed
   */
  const markAsViewed = useCallback(async friendId => {
    try {
      // Update local state immediately
      setViewedFriends(prev => new Set([...prev, friendId]));

      // Persist to AsyncStorage
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const data = stored ? JSON.parse(stored) : {};
      data[friendId] = Date.now();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      logger.info('useViewedStories: Marked as viewed', { friendId });
    } catch (error) {
      logger.error('useViewedStories: Failed to mark as viewed', { error: error.message });
    }
  }, []);

  /**
   * Check if a friend's stories have been viewed
   *
   * @param {string} friendId - Friend's user ID to check
   * @returns {boolean} Whether the friend's stories have been viewed
   */
  const isViewed = useCallback(
    friendId => {
      return viewedFriends.has(friendId);
    },
    [viewedFriends]
  );

  return { isViewed, markAsViewed, loading };
};
