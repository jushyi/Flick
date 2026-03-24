/**
 * useFeedPhotos hook (Supabase + TanStack Query)
 *
 * Provides paginated feed data via TanStack useInfiniteQuery wrapping the
 * get_feed RPC. Groups feed photos by userId for stories-style display.
 *
 * This is the NEW hook (.ts) for the Supabase migration. The old .js file
 * is preserved for strangler fig -- screens will be switched later.
 */

import { useMemo, useCallback } from 'react';

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';

import { getFeed, FeedPhoto } from '@/services/supabase/feedService';
import { queryKeys } from '@/lib/queryKeys';

import logger from '@/utils/logger';

// =============================================================================
// Types
// =============================================================================

export interface FeedGroup {
  userId: string;
  username: string;
  displayName: string | null;
  profilePhotoPath: string | null;
  nameColor: string | null;
  photos: FeedPhoto[];
}

// =============================================================================
// Pure Functions (exported for direct testing)
// =============================================================================

/**
 * Curate feed to show top N photos per friend, ranked by engagement.
 * Ported from the existing JS implementation.
 */
export const curateTopPhotosPerFriend = (
  photos: FeedPhoto[],
  limit = 5,
): FeedPhoto[] => {
  if (!photos || photos.length === 0) return [];

  const photosByUser: Record<string, FeedPhoto[]> = {};
  photos.forEach((photo) => {
    if (!photosByUser[photo.userId]) {
      photosByUser[photo.userId] = [];
    }
    photosByUser[photo.userId].push(photo);
  });

  const curated: FeedPhoto[] = [];
  Object.values(photosByUser).forEach((userPhotos) => {
    userPhotos.sort((a, b) => {
      const countDiff = (b.reactionCount || 0) - (a.reactionCount || 0);
      if (countDiff !== 0) return countDiff;
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
    curated.push(...userPhotos.slice(0, limit));
  });

  curated.sort((a, b) => (b.reactionCount || 0) - (a.reactionCount || 0));

  logger.debug('useFeedPhotos: Curated feed', {
    totalPhotos: photos.length,
    curatedPhotos: curated.length,
    friendCount: Object.keys(photosByUser).length,
    limit,
  });

  return curated;
};

/**
 * Group photos by userId for stories-style display.
 */
export const groupByUser = (photos: FeedPhoto[]): FeedGroup[] => {
  const groups: Record<string, FeedGroup> = {};
  photos.forEach((photo) => {
    if (!groups[photo.userId]) {
      groups[photo.userId] = {
        userId: photo.userId,
        username: photo.username,
        displayName: photo.displayName,
        profilePhotoPath: photo.profilePhotoPath,
        nameColor: photo.nameColor,
        photos: [],
      };
    }
    groups[photo.userId].photos.push(photo);
  });
  return Object.values(groups);
};

// =============================================================================
// Hook
// =============================================================================

const PAGE_SIZE = 20;

export function useFeedPhotos(userId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: queryKeys.photos.feed(),
    queryFn: async ({ pageParam }) => {
      if (!userId) return [];
      return getFeed({ userId, cursor: pageParam, limit: PAGE_SIZE });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.length === PAGE_SIZE
        ? lastPage[lastPage.length - 1].createdAt
        : undefined,
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
    meta: { persist: true },
  });

  // Flatten all pages into single array
  const allPhotos = useMemo(() => {
    if (!query.data?.pages) return [];
    return query.data.pages.flat();
  }, [query.data]);

  // Curate and group
  const curatedPhotos = useMemo(
    () => curateTopPhotosPerFriend(allPhotos),
    [allPhotos],
  );
  const feedGroups = useMemo(() => groupByUser(curatedPhotos), [curatedPhotos]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.photos.feed(),
    });
  }, [queryClient]);

  return {
    photos: curatedPhotos, // Flat curated list (for backwards compat)
    feedGroups, // Grouped by user (for stories UI)
    allPhotos, // All pages flattened (uncurated)
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    isRefreshing: query.isRefetching && !query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    refresh,
    error: query.error,
  };
}

export default useFeedPhotos;
