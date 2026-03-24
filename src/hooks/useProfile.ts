import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';

import logger from '@/utils/logger';

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  profile_photo_path: string | null;
  phone_number: string;
  friend_count: number;
  selects: unknown;
  song: unknown;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile(userId: string) {
  return useQuery({
    queryKey: queryKeys.profile.detail(userId),
    queryFn: async (): Promise<UserProfile> => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data as UserProfile;
    },
    enabled: !!userId,
    meta: { persist: true },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<UserProfile> & { id: string }) => {
      const { id, ...fields } = updates;
      const { data, error } = await supabase
        .from('users')
        .update(fields)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as UserProfile;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.profile.detail(data.id) });
    },
    onError: (error) => {
      logger.error('Profile update failed', { error: (error as Error).message });
    },
  });
}
