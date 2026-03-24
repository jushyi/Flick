/**
 * useMentionSuggestions Hook (PowerSync + TanStack Query)
 *
 * Provides @mention autocomplete for comments.
 * Queries PowerSync local SQLite for accepted friend IDs,
 * then looks up cached user profiles from TanStack Query cache.
 *
 * Works offline since PowerSync data is local and profiles are cached.
 */

import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { powerSyncDb } from '@/lib/powersync/database';
import { queryKeys } from '@/lib/queryKeys';

import logger from '@/utils/logger';

export interface MentionSuggestion {
  id: string;
  username: string;
  displayName: string;
  profilePhotoPath: string | null;
}

/**
 * @param currentUserId - The current user's ID
 * @param searchText - Text to filter suggestions by (after the @)
 * @returns Array of matching friend profiles for autocomplete
 */
export function useMentionSuggestions(
  currentUserId: string,
  searchText: string
): MentionSuggestion[] {
  const queryClient = useQueryClient();
  const [friendProfiles, setFriendProfiles] = useState<MentionSuggestion[]>([]);

  // Load friend IDs from PowerSync local SQLite and resolve profiles from TanStack cache
  useEffect(() => {
    if (!currentUserId) {
      setFriendProfiles([]);
      return;
    }

    const loadFriends = async () => {
      try {
        // Query PowerSync for accepted friendships
        const rows = await powerSyncDb.getAll<{ user1_id: string; user2_id: string }>(
          `SELECT user1_id, user2_id FROM friendships WHERE status = 'accepted' AND (user1_id = ? OR user2_id = ?)`,
          [currentUserId, currentUserId]
        );

        // Extract friend IDs (the other user in each friendship)
        const friendIds = rows.map((row) =>
          row.user1_id === currentUserId ? row.user2_id : row.user1_id
        );

        // Look up each friend's profile from TanStack Query cache
        const profiles: MentionSuggestion[] = [];
        for (const friendId of friendIds) {
          const cachedProfile = queryClient.getQueryData<any>(
            queryKeys.profile.detail(friendId)
          );

          if (cachedProfile) {
            profiles.push({
              id: friendId,
              username: cachedProfile.username || '',
              displayName: cachedProfile.display_name || cachedProfile.displayName || '',
              profilePhotoPath: cachedProfile.profile_photo_path || cachedProfile.profilePhotoPath || null,
            });
          }
        }

        setFriendProfiles(profiles);
        logger.debug('useMentionSuggestions: Loaded friend profiles', {
          friendCount: friendIds.length,
          cachedCount: profiles.length,
        });
      } catch (error) {
        logger.error('useMentionSuggestions: Failed to load friends', {
          error: (error as Error).message,
        });
        setFriendProfiles([]);
      }
    };

    loadFriends();
  }, [currentUserId, queryClient]);

  // Filter by searchText (case-insensitive startsWith on username or displayName)
  const filtered = useMemo(() => {
    if (!searchText) return friendProfiles;

    const lower = searchText.toLowerCase();
    return friendProfiles.filter(
      (p) =>
        p.username.toLowerCase().startsWith(lower) ||
        p.displayName.toLowerCase().startsWith(lower)
    );
  }, [friendProfiles, searchText]);

  return filtered;
}
