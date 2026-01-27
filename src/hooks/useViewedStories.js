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
 * - 24-hour expiry for viewed state (filtered on query)
 * - Loading state for initial hydration
 * - Get first unviewed photo index for starting position
 * - Uses ref for immediate sync access (avoids React state async issues)
 * - Account switching loads correct user's viewed state
 *
 * @returns {Object} { isViewed, markAsViewed, markPhotosAsViewed, getFirstUnviewedIndex, hasViewedAllPhotos, loading }
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
   * Load viewed state from Firestore on mount or user change
   */
  useEffect(() => {
    const loadViewedState = async () => {
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
        setLoading(true);

        const result = await loadViewedPhotos(userId);
        if (result.success && result.photoIds) {
          setViewedPhotos(result.photoIds);
          viewedPhotosRef.current = result.photoIds;
          logger.info('useViewedStories: Loaded viewed photos', { count: result.photoIds.size });
        } else {
          logger.warn('useViewedStories: Failed to load viewed photos', { error: result.error });
          // Start with empty set on error
          setViewedPhotos(new Set());
          viewedPhotosRef.current = new Set();
        }
      } catch (error) {
        logger.error('useViewedStories: Error loading viewed state', { error: error.message });
        setViewedPhotos(new Set());
        viewedPhotosRef.current = new Set();
      } finally {
        setLoading(false);
      }
    };

    loadViewedState();
  }, [userId]);

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
   *
   * @param {Array<object>} photos - Array of photo objects with id property
   * @returns {number} Index of first unviewed photo, or 0 if all viewed
   */
  const getFirstUnviewedIndex = useCallback(photos => {
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

  /**
   * Check if all photos in an array have been viewed
   * Uses ref for immediate sync access (avoids React state async issues)
   * @param {Array<object>} photos - Array of photo objects with id property
   * @returns {boolean} True if ALL photos have been viewed
   */
  const hasViewedAllPhotos = useCallback(photos => {
    if (!photos || photos.length === 0) return false;
    // Use ref for immediate access (sync) instead of state (async)
    const viewed = viewedPhotosRef.current;
    return photos.every(photo => viewed.has(photo.id));
  }, []);

  return {
    isViewed,
    markAsViewed,
    markPhotosAsViewed,
    getFirstUnviewedIndex,
    hasViewedAllPhotos,
    loading,
  };
};
