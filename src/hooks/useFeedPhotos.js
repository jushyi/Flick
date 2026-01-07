import { useState, useEffect, useCallback } from 'react';
import { getFeedPhotos, subscribeFeedPhotos } from '../services/firebase/feedService';

/**
 * Custom hook for managing feed photos
 * Handles initial load, pagination, real-time updates, and refresh
 *
 * @param {boolean} enableRealtime - Enable real-time listener (default: true)
 * @returns {object} - Feed state and control functions
 */
const useFeedPhotos = (enableRealtime = true) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);

  /**
   * Initial load of feed photos
   */
  const loadFeedPhotos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getFeedPhotos(20, null);

      if (result.success) {
        setPhotos(result.photos);
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('Error loading feed photos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Load more photos (pagination)
   */
  const loadMorePhotos = useCallback(async () => {
    // Don't load if already loading or no more photos
    if (loadingMore || !hasMore || !lastDoc) return;

    try {
      setLoadingMore(true);

      const result = await getFeedPhotos(10, lastDoc);

      if (result.success) {
        setPhotos((prev) => [...prev, ...result.photos]);
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('Error loading more photos:', err);
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, lastDoc]);

  /**
   * Refresh feed (pull-to-refresh)
   */
  const refreshFeed = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);

      const result = await getFeedPhotos(20, null);

      if (result.success) {
        setPhotos(result.photos);
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('Error refreshing feed:', err);
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  /**
   * Update a single photo in state (for optimistic UI updates)
   * Used for reactions without refetching entire feed
   */
  const updatePhotoInState = useCallback((photoId, updatedPhoto) => {
    setPhotos((prevPhotos) =>
      prevPhotos.map((photo) => (photo.id === photoId ? updatedPhoto : photo))
    );
  }, []);

  /**
   * Set up real-time listener on mount
   */
  useEffect(() => {
    // Initial load
    loadFeedPhotos();

    // Set up real-time listener if enabled
    let unsubscribe = () => {};

    if (enableRealtime) {
      unsubscribe = subscribeFeedPhotos((result) => {
        if (result.success) {
          // Update photos with latest data
          // Only update if not currently loading more
          if (!loadingMore) {
            setPhotos(result.photos);
          }
        } else {
          console.error('Feed subscription error:', result.error);
        }
      }, 20);
    }

    // Cleanup
    return () => {
      unsubscribe();
    };
  }, [enableRealtime, loadFeedPhotos, loadingMore]);

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
