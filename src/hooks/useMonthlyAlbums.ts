/**
 * useMonthlyAlbums Hook
 *
 * TanStack Query hook wrapping the monthly photos server-side RPC.
 */

import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import * as albumService from '@/services/supabase/albumService';

/**
 * Fetch monthly photo groups for a user via Supabase RPC.
 */
export function useMonthlyAlbums(userId: string) {
  return useQuery({
    queryKey: queryKeys.albums.monthly(userId),
    queryFn: () => albumService.getMonthlyPhotos(userId),
    enabled: !!userId,
  });
}
