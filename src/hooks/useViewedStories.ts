import { useState, useEffect, useCallback, useRef } from 'react';
// TODO(20-01): viewedStoriesService - no supabase equivalent yet, needs migration
const loadViewedPhotos = async (_userId: string): Promise<{ success: boolean; photoIds?: Set<string>; error?: string }> => ({ success: true, data: new Set() } as unknown as { success: boolean; photoIds?: Set<string> });
const markPhotosAsViewedInFirestore = async (_userId: string, _photoIds: string[]): Promise<{ success: boolean; error?: string }> => ({ success: true });
import { useAuth } from '../context/AuthContext';
import logger from '../utils/logger';

type PhotoWithId = {
  id: string;
  [key: string]: unknown;
};

type UseViewedStoriesReturn = {
  isViewed: (friendId: string) => boolean;
  markAsViewed: (friendId: string) => Promise<void>;
  markPhotosAsViewed: (photoIds: string[]) => Promise<void>;
  getFirstUnviewedIndex: (photos: PhotoWithId[]) => number;
  hasViewedAllPhotos: (photos: PhotoWithId[]) => boolean;
  reloadViewedState: () => Promise<void>;
  loading: boolean;
  viewedPhotoCount: number;
};

export const useViewedStories = (): UseViewedStoriesReturn => {
  const { user } = useAuth() as unknown as { user: { uid: string } | null };
  const userId = user?.uid;

  const [viewedFriends, setViewedFriends] = useState<Set<string>>(new Set());
  const [viewedPhotos, setViewedPhotos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const viewedPhotosRef = useRef<Set<string>>(new Set());

  const fetchAndApplyViewedPhotos = useCallback(
    async (isInitial: boolean) => {
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
          const merged = new Set([...viewedPhotosRef.current, ...result.photoIds]);
          setViewedPhotos(merged);
          viewedPhotosRef.current = merged;
          logger.info('useViewedStories: Loaded viewed photos', {
            firestoreCount: result.photoIds.size,
            mergedCount: merged.size,
          });
        } else {
          logger.warn('useViewedStories: Failed to load viewed photos', { error: result.error });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('useViewedStories: Error loading viewed state', { error: message });
      } finally {
        if (isInitial) setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    fetchAndApplyViewedPhotos(true);
  }, [fetchAndApplyViewedPhotos]);

  const reloadViewedState = useCallback(() => {
    return fetchAndApplyViewedPhotos(false);
  }, [fetchAndApplyViewedPhotos]);

  const markAsViewed = useCallback(async (friendId: string) => {
    setViewedFriends(prev => new Set([...prev, friendId]));
    logger.info('useViewedStories: Marked friend as viewed', { friendId });
  }, []);

  const markPhotosAsViewed = useCallback(
    async (photoIds: string[]) => {
      if (!photoIds || photoIds.length === 0) return;
      if (!userId) {
        logger.warn('useViewedStories: Cannot mark photos without userId');
        return;
      }

      try {
        const newSet = new Set([...viewedPhotosRef.current, ...photoIds]);
        viewedPhotosRef.current = newSet;

        setViewedPhotos(newSet);

        const result = await markPhotosAsViewedInFirestore(userId, photoIds);
        if (!result.success) {
          logger.warn('useViewedStories: Failed to persist to Firestore', { error: result.error });
        }

        logger.debug('useViewedStories: Marked photos as viewed', { count: photoIds.length });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('useViewedStories: Failed to mark photos as viewed', { error: message });
      }
    },
    [userId]
  );

  const getFirstUnviewedIndex = useCallback(
    (photos: PhotoWithId[]): number => {
      if (!photos || photos.length === 0) return 0;

      const viewed = viewedPhotosRef.current;
      const firstUnviewedIdx = photos.findIndex(photo => !viewed.has(photo.id));

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
    [viewedPhotos] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const isViewed = useCallback(
    (friendId: string): boolean => {
      return viewedFriends.has(friendId);
    },
    [viewedFriends]
  );

  const hasViewedAllPhotos = useCallback(
    (photos: PhotoWithId[]): boolean => {
      if (!photos || photos.length === 0) return false;
      const viewed = viewedPhotosRef.current;
      return photos.every(photo => viewed.has(photo.id));
    },
    [viewedPhotos] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return {
    isViewed,
    markAsViewed,
    markPhotosAsViewed,
    getFirstUnviewedIndex,
    hasViewedAllPhotos,
    reloadViewedState,
    loading,
    viewedPhotoCount: viewedPhotos.size,
  };
};
