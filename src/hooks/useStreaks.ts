/**
 * useStreak and useStreakMap Hooks (Supabase + PowerSync)
 *
 * Provides reactive streak data from PowerSync local SQLite with pure-function
 * state derivation via streakService. PowerSync handles sync from Supabase;
 * no direct REST calls or Realtime subscriptions needed.
 *
 * This is the NEW hook (.ts) for the Supabase migration. The old .js file
 * is preserved for strangler fig -- screens will be switched later.
 *
 * Two hooks:
 * - useStreak(friendId): Single streak for one conversation
 * - useStreakMap(friendIds): Batch streaks for conversation list
 */
import { useMemo } from 'react';

import { useQuery as usePowerSyncQuery } from '@powersync/react';

import {
  deriveStreakState,
  getStreakColor,
  generateStreakId,
  type StreakData,
  type StreakState,
} from '../services/supabase/streakService';

import { useAuth } from '../context/AuthContext';

// ============================================================================
// Types
// ============================================================================

export interface StreakInfo {
  streak: StreakData | null;
  state: StreakState;
  dayCount: number;
  color: string;
  loading: boolean;
}

export interface StreakMapEntry {
  state: StreakState;
  dayCount: number;
  color: string;
}

// ============================================================================
// useStreak
// ============================================================================

/**
 * Single streak for one friend.
 *
 * Generates the deterministic streak ID from currentUserId + friendId,
 * queries PowerSync local SQLite, and derives state/color.
 *
 * @param friendId - Friend's user ID
 * @returns Streak data with derived state and color
 */
export function useStreak(friendId: string): StreakInfo {
  const { userProfile } = useAuth() as { userProfile: { uid: string } | null };
  const userId = userProfile?.uid;

  const streakId = userId && friendId ? generateStreakId(userId, friendId) : '';

  const { data: rows, isLoading } = usePowerSyncQuery('SELECT * FROM streaks WHERE id = ?', [
    streakId,
  ]);

  const result = useMemo(() => {
    const streak = (rows && rows.length > 0 ? rows[0] : null) as StreakData | null;

    if (!streak || !userId) {
      return {
        streak: null,
        state: 'default' as StreakState,
        dayCount: 0,
        color: getStreakColor('default', 0),
        loading: isLoading,
      };
    }

    const state = deriveStreakState(streak, userId);
    const dayCount = streak.day_count || 0;
    const color = getStreakColor(state, dayCount);

    return { streak, state, dayCount, color, loading: isLoading };
  }, [rows, userId, isLoading]);

  return result;
}

// ============================================================================
// useStreakMap
// ============================================================================

/**
 * Batch streaks for conversation list.
 *
 * Queries ALL streaks where current user is user1 or user2 from PowerSync,
 * then builds a Map keyed by friendId with derived state and color.
 *
 * @param friendIds - Array of friend user IDs (optional, for documentation; all user streaks are fetched)
 * @returns Map of friendId to streak info, plus loading state
 */
export function useStreakMap(friendIds?: string[]): {
  streakMap: Map<string, StreakMapEntry>;
  loading: boolean;
} {
  const { userProfile } = useAuth() as { userProfile: { uid: string } | null };
  const userId = userProfile?.uid;

  const { data: rows, isLoading } = usePowerSyncQuery(
    'SELECT * FROM streaks WHERE user1_id = ? OR user2_id = ?',
    [userId ?? '', userId ?? '']
  );

  const streakMap = useMemo(() => {
    const map = new Map<string, StreakMapEntry>();

    if (!userId || !rows) return map;

    const now = Date.now();

    (rows as StreakData[]).forEach(streak => {
      // Determine the friend ID (the other participant)
      const friendId = streak.user1_id === userId ? streak.user2_id : streak.user1_id;

      let state = deriveStreakState(streak, userId);
      let dayCount = streak.day_count || 0;

      // Check local expiry: override to default if expires_at has passed
      if (streak.expires_at) {
        const expiresAtMs = new Date(streak.expires_at).getTime();
        if (expiresAtMs <= now) {
          state = 'default';
          dayCount = 0;
        }
      }

      const color = getStreakColor(state, dayCount);
      map.set(friendId, { state, dayCount, color });
    });

    return map;
  }, [rows, userId]);

  return { streakMap, loading: isLoading };
}
