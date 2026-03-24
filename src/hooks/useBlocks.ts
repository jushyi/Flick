/**
 * TanStack Query hooks for block and report operations
 *
 * Provides useBlockedUsers, useBlockUser, useUnblockUser, useReportUser
 * with proper cache invalidation on mutations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import * as blockService from '@/services/supabase/blockService';
import * as reportService from '@/services/supabase/reportService';

import logger from '@/utils/logger';

export function useBlockedUsers(userId: string) {
  return useQuery({
    queryKey: queryKeys.blocks.list(userId),
    queryFn: () => blockService.getBlockedUsers(userId),
    enabled: !!userId,
  });
}

export function useBlockUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      blockerId,
      blockedId,
    }: {
      blockerId: string;
      blockedId: string;
    }) => blockService.blockUser(blockerId, blockedId),
    onSuccess: (_, { blockerId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blocks.list(blockerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.friendships.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.photos.feed() });
    },
    onError: (error) => {
      logger.error('useBlockUser: Failed', { error: (error as Error).message });
    },
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      blockerId,
      blockedId,
    }: {
      blockerId: string;
      blockedId: string;
    }) => blockService.unblockUser(blockerId, blockedId),
    onSuccess: (_, { blockerId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blocks.list(blockerId) });
    },
    onError: (error) => {
      logger.error('useUnblockUser: Failed', {
        error: (error as Error).message,
      });
    },
  });
}

export function useReportUser() {
  return useMutation({
    mutationFn: ({
      reporterId,
      reportedId,
      reason,
      details,
    }: {
      reporterId: string;
      reportedId: string;
      reason: string;
      details?: string;
    }) => reportService.reportUser(reporterId, reportedId, reason, details),
    onError: (error) => {
      logger.error('useReportUser: Failed', {
        error: (error as Error).message,
      });
    },
  });
}
