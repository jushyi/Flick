/**
 * useFeedPhotos hook
 *
 * Manages feed photo state including initial load, pagination, real-time
 * updates, and refresh. Filters feed to friends-only and curates to show
 * top photos per friend ranked by engagement.
 *
 * Features:
 * - Initial load with friend filtering
 * - Pagination (load more)
 * - Pull-to-refresh
 * - Real-time subscription
 * - Optimistic UI updates for reactions
 */

import { useState, useEffect, useCallback } from 'react';
import { getFeedPhotos, subscribeFeedPhotos } from '../services/firebase/feedService';
import { getFriendUserIds } from '../services/firebase/friendshipService';
import { useAuth } from '../context/AuthContext';
import logger from '../utils/logger';

// Minimum reactions for a photo to appear in "hot" feed
const MIN_REACTIONS_FOR_HOT = 2;

/**
 * Curate feed to show top N photos per friend, ranked by engagement
 * @param {Array} photos - Array of photo objects
 * @param {number} limit - Max photos per friend (default: 5)
 * @returns {Array} - Curated array of photos
 */
const curateTopPhotosPerFriend = (photos, limit = 5) => {
  if (!photos || photos.length === 0) return [];

  // Group photos by userId
  const photosByUser = {};
  photos.forEach(photo => {
    if (!photosByUser[photo.userId]) {
      photosByUser[photo.userId] = [];
    }
    photosByUser[photo.userId].push(photo);
  });

  // For each user, sort by reactionCount and take top N
  const curatedPhotos = [];
  Object.values(photosByUser).forEach(userPhotos => {
    // Sort by reactionCount DESC, then capturedAt DESC as tiebreaker
    userPhotos.sort((a, b) => {
      const countDiff = (b.reactionCount || 0) - (a.reactionCount || 0);
      if (countDiff !== 0) return countDiff;
      // Tiebreaker: most recent first
      const aTime = a.capturedAt?.seconds || a.capturedAt?.toSeconds?.() || 0;
      const bTime = b.capturedAt?.seconds || b.capturedAt?.toSeconds?.() || 0;
      return bTime - aTime;
    });
    // Take top N
    curatedPhotos.push(...userPhotos.slice(0, limit));
  });

  // Sort final list by reactionCount DESC for overall feed order
  curatedPhotos.sort((a, b) => (b.reactionCount || 0) - (a.reactionCount || 0));

  logger.debug('useFeedPhotos: Curated feed', {
    totalPhotos: photos.length,
    curatedPhotos: curatedPhotos.length,
    friendCount: Object.keys(photosByUser).length,
    limit,
  });

  return curatedPhotos;
};

/**
 * Filter photos to only include high-engagement posts
 * @param {Array} photos - Array of photo objects
 * @param {boolean} hotOnly - Whether to filter for hot photos only
 * @returns {Array} - Filtered array of photos
 */
const filterHotPhotos = (photos, hotOnly) => {
  if (!hotOnly || !photos || photos.length === 0) return photos;

  const filtered = photos.filter(photo => (photo.reactionCount || 0) >= MIN_REACTIONS_FOR_HOT);

  logger.debug('useFeedPhotos: Filtered to hot photos', {
    total: photos.length,
    hot: filtered.length,
    threshold: MIN_REACTIONS_FOR_HOT,
  });

  return filtered;
};

/**
 * Custom hook for managing feed photos
 * Handles initial load, pagination, real-time updates, and refresh
 * Fetches friendships and filters feed to friends-only.
 * Curates feed to top 5 photos per friend by engagement.
 * Hot highlights filter for engagement-based curation.
 *
 * @param {boolean} enableRealtime - Enable real-time listener (default: true)
 * @param {boolean} hotOnly - Only show photos with high engagement (default: false)
 * @returns {object} - Feed state and control functions
 */
const useFeedPhotos = (enableRealtime = true, hotOnly = false) => {
  const { user } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);
  const [friendUserIds, setFriendUserIds] = useState([]);

  /**
   * Fetch friend user IDs
   * Returns the friend IDs directly (in addition to updating state)
   * so callers can use the fresh value immediately
   */
  const fetchFriendships = useCallback(async () => {
    if (!user?.uid) return [];

    try {
      const result = await getFriendUserIds(user.uid);
      if (result.success) {
        setFriendUserIds(result.friendUserIds);
        return result.friendUserIds;
      }
      return [];
    } catch (err) {
      logger.error('Error fetching friendships', err);
      return [];
    }
  }, [user]);

  /**
   * Initial load of feed photos
   */
  const loadFeedPhotos = useCallback(async () => {
    // Don't fetch if user is not authenticated
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch friendships and use returned value directly
      // (can't use state value as it hasn't updated yet due to closure)
      const freshFriendIds = await fetchFriendships();

      // Then fetch feed photos with friend filter
      const result = await getFeedPhotos(20, null, freshFriendIds, user.uid);

      if (result.success) {
        // Curate feed to top 5 photos per friend
        const curatedPhotos = curateTopPhotosPerFriend(result.photos, 5);
        // Apply hot filter if enabled
        const filteredPhotos = filterHotPhotos(curatedPhotos, hotOnly);
        setPhotos(filteredPhotos);
        setLastDoc(result.lastDoc);
        // After curation, hasMore is based on curated set
        setHasMore(result.hasMore && filteredPhotos.length >= 5);
      } else {
        setError(result.error);
      }
    } catch (err) {
      logger.error('Error loading feed photos', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchFriendships, user, hotOnly]);

  /**
   * Load more photos (pagination)
   */
  const loadMorePhotos = useCallback(async () => {
    // Don't load if already loading or no more photos
    if (loadingMore || !hasMore || !lastDoc) return;

    try {
      setLoadingMore(true);

      const result = await getFeedPhotos(10, lastDoc, friendUserIds, user?.uid);

      if (result.success) {
        // Combine existing photos with new ones and re-curate
        setPhotos(prev => {
          const allPhotos = [...prev, ...result.photos];
          const curatedPhotos = curateTopPhotosPerFriend(allPhotos, 5);
          // Apply hot filter if enabled
          return filterHotPhotos(curatedPhotos, hotOnly);
        });
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
      } else {
        setError(result.error);
      }
    } catch (err) {
      logger.error('Error loading more photos', err);
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, lastDoc, friendUserIds, user, hotOnly]);

  /**
   * Refresh feed (pull-to-refresh)
   */
  const refreshFeed = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);

      // Refresh friendships and use the returned value directly
      // (can't use state value as it hasn't updated yet due to closure)
      const freshFriendIds = await fetchFriendships();

      const result = await getFeedPhotos(20, null, freshFriendIds, user?.uid);

      if (result.success) {
        // Curate feed to top 5 photos per friend
        const curatedPhotos = curateTopPhotosPerFriend(result.photos, 5);
        // Apply hot filter if enabled
        const filteredPhotos = filterHotPhotos(curatedPhotos, hotOnly);
        setPhotos(filteredPhotos);
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore && filteredPhotos.length >= 5);
      } else {
        setError(result.error);
      }
    } catch (err) {
      logger.error('Error refreshing feed', err);
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }, [fetchFriendships, user, hotOnly]);

  /**
   * Update a single photo in state (for optimistic UI updates)
   * Used for reactions without refetching entire feed
   */
  const updatePhotoInState = useCallback((photoId, updatedPhoto) => {
    setPhotos(prevPhotos => prevPhotos.map(photo => (photo.id === photoId ? updatedPhoto : photo)));
  }, []);

  /**
   * Fetch friendships once on mount
   */
  useEffect(() => {
    if (user?.uid) {
      fetchFriendships();
    }
  }, [user?.uid]);

  /**
   * Load feed photos when friendships are fetched
   */
  useEffect(() => {
    if (!user?.uid) return;

    // Initial load
    loadFeedPhotos();
  }, [user?.uid, friendUserIds.length]);

  /**
   * Set up real-time listener
   */
  useEffect(() => {
    // Don't set up listener until we have the user
    if (!user?.uid) return;

    // Set up real-time listener if enabled
    let unsubscribe = () => {};

    if (enableRealtime) {
      unsubscribe = subscribeFeedPhotos(
        result => {
          if (result.success) {
            // Update photos with latest data
            // Only update if not currently loading more
            if (!loadingMore) {
              // Curate feed to top 5 photos per friend
              const curatedPhotos = curateTopPhotosPerFriend(result.photos, 5);
              // Apply hot filter if enabled
              const filteredPhotos = filterHotPhotos(curatedPhotos, hotOnly);
              setPhotos(filteredPhotos);
            }
          } else {
            logger.error('Feed subscription error', { error: result.error });
          }
        },
        20,
        friendUserIds,
        user.uid
      );
    }

    // Cleanup
    return () => {
      unsubscribe();
    };
  }, [enableRealtime, loadingMore, friendUserIds, user?.uid, hotOnly]);

  return {
    photos,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    loadMorePhotos,
    refreshFeed,
    updatePhotoInState,
  };
};

export default useFeedPhotos;
