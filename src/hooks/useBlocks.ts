/**
 * TanStack Query hooks for block and report operations
 *
 * Provides useBlockedUsers, useBlockUser, useUnblockUser, useReportUser
 * with proper cache invalidation on mutations.
 */

import { useQuery, useMutation } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import * as blockService from '@/services/supabase/blockService';
import * as reportService from '@/services/supabase/reportService';

import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';

import logger from '@/utils/logger';

export function useBlockedUsers(userId: string) {
  return useQuery({
    queryKey: queryKeys.blocks.list(userId),
    queryFn: () => blockService.getBlockedUsers(userId),
    enabled: !!userId,
  });
}

export function useBlockUser() {
  return useOptimisticMutation({
    mutationFn: ({
      blockerId,
      blockedId,
    }: {
      blockerId: string;
      blockedId: string;
    }) => blockService.blockUser(blockerId, blockedId),
    queryKey: (vars) => queryKeys.blocks.list(vars.blockerId),
    updater: (old: { blockedId: string; createdAt: string }[] | undefined, vars) => [
      ...(old || []),
      { blockedId: vars.blockedId, createdAt: new Date().toISOString() },
    ],
    errorMessage: 'Failed to block user',
    invalidateKeys: [queryKeys.friendships.all, queryKeys.photos.feed()],
  });
}

export function useUnblockUser() {
  return useOptimisticMutation({
    mutationFn: ({
      blockerId,
      blockedId,
    }: {
      blockerId: string;
      blockedId: string;
    }) => blockService.unblockUser(blockerId, blockedId),
    queryKey: (vars) => queryKeys.blocks.list(vars.blockerId),
    updater: (old: { blockedId: string }[] | undefined, vars) =>
      (old || []).filter((b) => b.blockedId !== vars.blockedId),
    errorMessage: 'Failed to unblock user',
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
