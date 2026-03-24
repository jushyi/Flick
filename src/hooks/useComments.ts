/**
 * useComments Hook (Supabase + TanStack Query + Realtime)
 *
 * Provides comment data via TanStack useQuery, with live updates
 * via Supabase Realtime channel subscriptions that invalidate cache.
 *
 * Also exports mutation hooks for add, delete, like, and unlike operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';
import * as commentService from '@/services/supabase/commentService';
import type { AddCommentParams } from '@/services/supabase/commentService';

import logger from '@/utils/logger';

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
 * Invalidates comments list on success.
 */
export function useAddComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: AddCommentParams) => commentService.addComment(params),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.comments.list(variables.photoId),
      });
    },
    onError: (error) => {
      logger.error('Failed to add comment', { error: (error as Error).message });
    },
  });
}

/**
 * Mutation hook for deleting a comment.
 * Invalidates comments list on success.
 */
export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId }: { commentId: string; photoId: string }) =>
      commentService.deleteComment(commentId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.comments.list(variables.photoId),
      });
    },
    onError: (error) => {
      logger.error('Failed to delete comment', { error: (error as Error).message });
    },
  });
}

/**
 * Mutation hook for liking a comment.
 * Optimistic update: increments like_count in cached data.
 */
export function useLikeComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, userId }: { commentId: string; userId: string; photoId: string }) =>
      commentService.likeComment(commentId, userId),
    onMutate: async (variables) => {
      const key = queryKeys.comments.list(variables.photoId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);

      queryClient.setQueryData(key, (old: any[] | undefined) =>
        old?.map((c) =>
          c.id === variables.commentId ? { ...c, likeCount: (c.likeCount ?? 0) + 1 } : c
        )
      );

      return { previous };
    },
    onError: (_error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.comments.list(variables.photoId), context.previous);
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.comments.list(variables.photoId),
      });
    },
  });
}

/**
 * Mutation hook for unliking a comment.
 * Optimistic update: decrements like_count in cached data.
 */
export function useUnlikeComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, userId }: { commentId: string; userId: string; photoId: string }) =>
      commentService.unlikeComment(commentId, userId),
    onMutate: async (variables) => {
      const key = queryKeys.comments.list(variables.photoId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);

      queryClient.setQueryData(key, (old: any[] | undefined) =>
        old?.map((c) =>
          c.id === variables.commentId
            ? { ...c, likeCount: Math.max(0, (c.likeCount ?? 0) - 1) }
            : c
        )
      );

      return { previous };
    },
    onError: (_error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.comments.list(variables.photoId), context.previous);
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.comments.list(variables.photoId),
      });
    },
  });
}
