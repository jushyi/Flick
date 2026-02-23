import { useState, useEffect, useCallback, useRef } from 'react';
import {
  loadViewedPhotos,
  markPhotosAsViewedInFirestore,
} from '../services/firebase/viewedStoriesService';
import { useAuth } from '../context/AuthContext';
import logger from '../utils/logger';

/**
 * Hook for managing viewed stories state with Firestore persistence
 *
 * Features:
 * - Persists viewed state to Firestore per-user (users/{userId}/viewedPhotos/{photoId})
 * - 7-day expiry for viewed state (matches story visibility window)
 * - Loading state for initial hydration
 * - Get first unviewed photo index for starting position
 * - Uses ref for immediate sync access (avoids React state async issues)
 * - Account switching loads correct user's viewed state
 *
 * @returns {Object} { isViewed, markAsViewed, markPhotosAsViewed, getFirstUnviewedIndex, hasViewedAllPhotos, reloadViewedState, loading }
 */
export const useViewedStories = () => {
  const { user } = useAuth();
  const userId = user?.uid;

  const [viewedFriends, setViewedFriends] = useState(new Set());
  const [viewedPhotos, setViewedPhotos] = useState(new Set());
  const [loading, setLoading] = useState(true);

  // Ref for immediate sync access to viewed photos (bypasses React state async)
  const viewedPhotosRef = useRef(new Set());

  /**
   * Shared loader — fetches viewed photos from Firestore and merges with in-memory state.
   * On failure, preserves whatever is already in the ref so viewed rings don't flash.
   * @param {boolean} isInitial - true on first mount (shows loading skeleton)
   */
  const fetchAndApplyViewedPhotos = useCallback(
    async isInitial => {
      if (!userId) {
        logger.debug('useViewedStories: No userId, clearing viewed state');
        setViewedPhotos(new Set());
        setViewedFriends(new Set());
        viewedPhotosRef.current = new Set();
        setLoading(false);
        return;
      }

      try {
        logger.debug('useViewedStories: Loading viewed photos from Firestore', { userId });
        if (isInitial) setLoading(true);

        const result = await loadViewedPhotos(userId);
        if (result.success && result.photoIds) {
          // Merge Firestore data with any in-memory viewed IDs (covers photos marked
          // during this session that may not have synced yet or were written after
          // the Firestore expiry query cutoff)
          const merged = new Set([...viewedPhotosRef.current, ...result.photoIds]);
          setViewedPhotos(merged);
          viewedPhotosRef.current = merged;
          logger.info('useViewedStories: Loaded viewed photos', {
            firestoreCount: result.photoIds.size,
            mergedCount: merged.size,
          });
        } else {
          logger.warn('useViewedStories: Failed to load viewed photos', { error: result.error });
          // Keep existing in-memory data instead of resetting to empty
        }
      } catch (error) {
        logger.error('useViewedStories: Error loading viewed state', { error: error.message });
        // Keep existing in-memory data instead of resetting to empty
      } finally {
        if (isInitial) setLoading(false);
      }
    },
    [userId]
  );

  /**
   * Load viewed state from Firestore on mount or user change
   */
  useEffect(() => {
    fetchAndApplyViewedPhotos(true);
  }, [fetchAndApplyViewedPhotos]);

  /**
   * Reload viewed state from Firestore (call during pull-to-refresh)
   * Merges with in-memory state so no viewed rings flash during reload.
   */
  const reloadViewedState = useCallback(() => {
    return fetchAndApplyViewedPhotos(false);
  }, [fetchAndApplyViewedPhotos]);

  /**
   * Mark a friend's stories as viewed
   * Updates local state immediately (no Firestore persistence for friend-level viewing)
   * Friend viewed state is derived from photo viewed state
   *
   * @param {string} friendId - Friend's user ID to mark as viewed
   */
  const markAsViewed = useCallback(async friendId => {
    // Update local state immediately
    setViewedFriends(prev => new Set([...prev, friendId]));
    logger.info('useViewedStories: Marked friend as viewed', { friendId });
  }, []);

  /**
   * Mark photos as viewed when navigating through stories
   * Persists to Firestore for per-user storage
   *
   * @param {Array<string>} photoIds - Array of photo IDs to mark as viewed
   */
  const markPhotosAsViewed = useCallback(
    async photoIds => {
      if (!photoIds || photoIds.length === 0) return;
      if (!userId) {
        logger.warn('useViewedStories: Cannot mark photos without userId');
        return;
      }

      try {
        // Update ref immediately (sync) for instant access in getFirstUnviewedIndex
        const newSet = new Set([...viewedPhotosRef.current, ...photoIds]);
        viewedPhotosRef.current = newSet;

        // Update local state (async, triggers re-renders)
        setViewedPhotos(newSet);

        // Persist to Firestore in background
        const result = await markPhotosAsViewedInFirestore(userId, photoIds);
        if (!result.success) {
          logger.warn('useViewedStories: Failed to persist to Firestore', { error: result.error });
          // Local state is still updated, so functionality works
        }

        logger.debug('useViewedStories: Marked photos as viewed', { count: photoIds.length });
      } catch (error) {
        logger.error('useViewedStories: Failed to mark photos as viewed', { error: error.message });
      }
    },
    [userId]
  );

  /**
   * Get the index of the first unviewed photo in an array
   * Returns 0 if all photos are viewed (start from beginning)
   * Uses ref for immediate sync access (avoids React state async issues)
   * Note: viewedPhotos dependency ensures callback updates when data loads from Firestore
   *
   * @param {Array<object>} photos - Array of photo objects with id property
   * @returns {number} Index of first unviewed photo, or 0 if all viewed
   */
  const getFirstUnviewedIndex = useCallback(
    photos => {
      if (!photos || photos.length === 0) return 0;

      // Use ref for immediate access (sync) instead of state (async)
      const viewed = viewedPhotosRef.current;
      const firstUnviewedIdx = photos.findIndex(photo => !viewed.has(photo.id));

      // If all are viewed, start from beginning
      if (firstUnviewedIdx === -1) {
        logger.debug('useViewedStories: All photos viewed, starting from 0');
        return 0;
      }

      logger.debug('useViewedStories: First unviewed photo', {
        index: firstUnviewedIdx,
        total: photos.length,
        viewedCount: viewed.size,
      });
      return firstUnviewedIdx;
    },
    [viewedPhotos]
  );

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

  /**
   * Check if all photos in an array have been viewed
   * Uses ref for immediate sync access (avoids React state async issues)
   * Note: viewedPhotos dependency ensures callback updates when data loads from Firestore
   * @param {Array<object>} photos - Array of photo objects with id property
   * @returns {boolean} True if ALL photos have been viewed
   */
  const hasViewedAllPhotos = useCallback(
    photos => {
      if (!photos || photos.length === 0) return false;
      // Use ref for immediate access (sync) instead of state (async)
      const viewed = viewedPhotosRef.current;
      return photos.every(photo => viewed.has(photo.id));
    },
    [viewedPhotos]
  );

  return {
    isViewed,
    markAsViewed,
    markPhotosAsViewed,
    getFirstUnviewedIndex,
    hasViewedAllPhotos,
    reloadViewedState,
    loading,
    viewedPhotoCount: viewedPhotos.size, // Exposes count to trigger re-renders in consumers
  };
};
