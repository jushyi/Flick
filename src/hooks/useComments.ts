/**
 * useComments Hook (Supabase + TanStack Query + Realtime)
 *
 * Provides comment data via TanStack useQuery, with live updates
 * via Supabase Realtime channel subscriptions that invalidate cache.
 *
 * Also exports mutation hooks for add, delete, like, and unlike operations.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';
import * as commentService from '@/services/supabase/commentService';
import type { AddCommentParams } from '@/services/supabase/commentService';

import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';

type AddCommentMutationParams = AddCommentParams & {
  username?: string;
  displayName?: string;
};

import logger from '@/utils/logger';

type CachedComment = {
  id: string;
  photoId?: string;
  userId?: string;
  text?: string;
  mentions?: string[];
  createdAt?: string;
  likeCount?: number;
  username?: string;
  displayName?: string;
};

/**
 * Fetch and subscribe to comments for a photo.
 * Uses TanStack Query for caching + Supabase Realtime for live updates.
 */
export function useComments(photoId: string) {
  const queryClient = useQueryClient();

  const queryResult = useQuery({
    queryKey: queryKeys.comments.list(photoId),
    queryFn: () => commentService.getComments(photoId),
    enabled: !!photoId,
  });

  // Subscribe to Supabase Realtime for live comment updates
  useEffect(() => {
    if (!photoId) return;

    const channel = supabase
      .channel(`comments:${photoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `photo_id=eq.${photoId}`,
        },
        () => {
          logger.debug('useComments: Realtime event, invalidating cache', { photoId });
          queryClient.invalidateQueries({ queryKey: queryKeys.comments.list(photoId) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [photoId, queryClient]);

  return queryResult;
}

/**
 * Mutation hook for adding a comment.
 * Optimistic update: appends temporary comment to cache, rolls back on error.
 */
export function useAddComment() {
  return useOptimisticMutation({
    mutationFn: (params: AddCommentMutationParams) => commentService.addComment(params),
    queryKey: (vars) => queryKeys.comments.list(vars.photoId),
    updater: (old: CachedComment[] | undefined, vars) => [
      ...(old || []),
      {
        id: `temp-${Date.now()}`,
        photoId: vars.photoId,
        userId: vars.userId,
        text: vars.text,
        mentions: vars.mentions || [],
        createdAt: new Date().toISOString(),
        likeCount: 0,
        username: vars.username ?? '',
        displayName: vars.displayName ?? '',
      },
    ],
    errorMessage: 'Failed to post comment',
  });
}

/**
 * Mutation hook for deleting a comment.
 * Optimistic update: removes comment from cache, rolls back on error.
 */
export function useDeleteComment() {
  return useOptimisticMutation({
    mutationFn: ({ commentId }: { commentId: string; photoId: string }) =>
      commentService.deleteComment(commentId),
    queryKey: (vars) => queryKeys.comments.list(vars.photoId),
    updater: (old: CachedComment[] | undefined, vars) =>
      (old || []).filter((c: CachedComment) => c.id !== vars.commentId),
    errorMessage: 'Failed to delete comment',
  });
}

/**
 * Mutation hook for liking a comment.
 * Optimistic update: increments like_count in cached data.
 */
export function useLikeComment() {
  return useOptimisticMutation({
    mutationFn: ({ commentId, userId }: { commentId: string; userId: string; photoId: string }) =>
      commentService.likeComment(commentId, userId),
    queryKey: (vars) => queryKeys.comments.list(vars.photoId),
    updater: (old: CachedComment[] | undefined, vars) =>
      (old || []).map((c: CachedComment) =>
        c.id === vars.commentId ? { ...c, likeCount: (c.likeCount ?? 0) + 1 } : c
      ),
    errorMessage: 'Failed to like comment',
  });
}

/**
 * Mutation hook for unliking a comment.
 * Optimistic update: decrements like_count in cached data.
 */
export function useUnlikeComment() {
  return useOptimisticMutation({
    mutationFn: ({ commentId, userId }: { commentId: string; userId: string; photoId: string }) =>
      commentService.unlikeComment(commentId, userId),
    queryKey: (vars) => queryKeys.comments.list(vars.photoId),
    updater: (old: CachedComment[] | undefined, vars) =>
      (old || []).map((c: CachedComment) =>
        c.id === vars.commentId
          ? { ...c, likeCount: Math.max(0, (c.likeCount ?? 0) - 1) }
          : c
      ),
    errorMessage: 'Failed to unlike comment',
  });
}
