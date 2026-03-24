/**
 * TanStack Query hooks for friendship operations
 *
 * Wraps friendshipService.ts (PowerSync local writes) with TanStack Query
 * for reactive UI updates. PowerSync handles real-time sync to Supabase
 * automatically -- no Supabase Realtime channel needed for friendships.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import * as friendshipService from '@/services/supabase/friendshipService';

import logger from '@/utils/logger';

// ============================================================================
// Query hooks
// ============================================================================

export function useFriends(userId: string) {
  return useQuery({
    queryKey: queryKeys.friendships.list(userId),
    queryFn: () => friendshipService.getFriends(userId),
    enabled: !!userId,
  });
}

export function usePendingRequests(userId: string) {
  return useQuery({
    queryKey: queryKeys.friendships.pending(userId),
    queryFn: () => friendshipService.getPendingRequests(userId),
    enabled: !!userId,
  });
}

export function useSentRequests(userId: string) {
  return useQuery({
    queryKey: queryKeys.friendships.sent(userId),
    queryFn: () => friendshipService.getSentRequests(userId),
    enabled: !!userId,
  });
}

export function useFriendshipStatus(userId1: string, userId2: string) {
  return useQuery({
    queryKey: queryKeys.friendships.status(userId1, userId2),
    queryFn: () => friendshipService.getFriendshipStatus(userId1, userId2),
    enabled: !!userId1 && !!userId2,
  });
}

// ============================================================================
// Mutation hooks
// ============================================================================

export function useSendFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ fromUserId, toUserId }: { fromUserId: string; toUserId: string }) =>
      friendshipService.sendFriendRequest(fromUserId, toUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.friendships.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.all });
    },
    onError: (error) => {
      logger.error('useSendFriendRequest: Failed', { error: (error as Error).message });
    },
  });
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ friendshipId }: { friendshipId: string }) =>
      friendshipService.acceptFriendRequest(friendshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.friendships.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.all });
    },
    onError: (error) => {
      logger.error('useAcceptFriendRequest: Failed', { error: (error as Error).message });
    },
  });
}

export function useDeclineFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ friendshipId }: { friendshipId: string }) =>
      friendshipService.declineFriendRequest(friendshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.friendships.all });
    },
    onError: (error) => {
      logger.error('useDeclineFriendRequest: Failed', { error: (error as Error).message });
    },
  });
}

export function useUnfriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ friendshipId }: { friendshipId: string }) =>
      friendshipService.unfriend(friendshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.friendships.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.all });
    },
    onError: (error) => {
      logger.error('useUnfriend: Failed', { error: (error as Error).message });
    },
  });
}
