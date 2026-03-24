/**
 * TanStack Query hook for contact sync flow
 *
 * Provides a mutation that runs the full contact sync:
 * permission -> normalize -> RPC lookup
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import * as contactSyncService from '@/services/supabase/contactSyncService';

import logger from '@/utils/logger';

export function useContactSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => contactSyncService.syncContacts(userId),
    onSuccess: (data, userId) => {
      // Cache the suggestions
      queryClient.setQueryData(queryKeys.contacts.suggestions(userId), data);
    },
    onError: (error) => {
      logger.error('Contact sync failed', { error: (error as Error).message });
    },
  });
}
