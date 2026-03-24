/**
 * Streak Service (Supabase / PowerSync)
 *
 * Pure TypeScript functions for client-side streak state derivation and color mapping.
 * All streak write logic is handled by the PostgreSQL trigger from Plan 01.
 * This service reads streak data from PowerSync local SQLite (streaks table is synced).
 *
 * NO Supabase imports -- pure functions only.
 *
 * Streak states:
 * - default:  No streak activity
 * - building: One or both parties snapped, streak not yet established
 * - pending:  Current user snapped but friend has not
 * - active:   Streak dayCount >= 3
 * - warning:  Streak about to expire (warning_sent flag set by PG trigger)
 *
 * Active tier colors:
 * - Tier 1 (3-9 days):  Light amber
 * - Tier 2 (10-49 days): Orange
 * - Tier 3 (50+ days):  Deep orange
 */

// ============================================================================
// Types
// ============================================================================

export type StreakState = 'default' | 'building' | 'pending' | 'active' | 'warning';

export interface StreakData {
  id: string;
  user1_id: string;
  user2_id: string;
  day_count: number;
  last_snap_at_user1: string | null;
  last_snap_at_user2: string | null;
  last_mutual_at: string | null;
  expires_at: string | null;
  warning_sent: number; // SQLite boolean (0/1)
}

// ============================================================================
// Streak color palette (inline -- colors.streak not defined in design system)
// ============================================================================

const STREAK_COLORS = {
  default: '#7B7B9E',   // Muted pixel gray-blue (matches text.secondary)
  building: '#00D4FF',  // Electric cyan (matches brand.purple / interactive.primary)
  pending: '#FFD700',   // Coin gold (matches brand.lime)
  warning: '#FF3333',   // Pixel red (matches status.danger)
  activeTier1: '#F5A623', // Light amber
  activeTier2: '#FF8C00', // Orange (matches status.developing)
  activeTier3: '#E65100', // Deep orange
} as const;

// ============================================================================
// Exported functions
// ============================================================================

/**
 * Generate a deterministic streak ID from two user IDs.
 * Sorts both IDs alphabetically and joins with underscore.
 *
 * @param userId1 - First user ID
 * @param userId2 - Second user ID
 * @returns Streak ID in format: lower_higher
 */
export const generateStreakId = (userId1: string, userId2: string): string => {
  const [lower, higher] = [userId1, userId2].sort();
  return `${lower}_${higher}`;
};

/**
 * Derive the visual streak state from streak data and the current user.
 * Pure function -- no side effects, no network calls.
 *
 * @param streak - Streak data from PowerSync local SQLite (or null)
 * @param currentUserId - The current user's ID
 * @returns One of the 5 streak states
 */
export const deriveStreakState = (
  streak: StreakData | null,
  currentUserId: string
): StreakState => {
  if (!streak) return 'default';

  const isUser1 = streak.user1_id === currentUserId;
  const mySnap = isUser1 ? streak.last_snap_at_user1 : streak.last_snap_at_user2;
  const theirSnap = isUser1 ? streak.last_snap_at_user2 : streak.last_snap_at_user1;

  if (!streak.expires_at) {
    // No active streak period -- check if building
    if (mySnap && !theirSnap) return 'pending';
    if (mySnap || theirSnap) return 'building';
    return 'default';
  }

  // Active streak period (has expires_at)
  if (streak.warning_sent === 1) return 'warning';
  if (streak.day_count >= 3) return 'active';

  // day_count 1-2: building toward visible streak
  if (mySnap && !theirSnap) return 'pending';
  return 'building';
};

/**
 * Map a streak state and day count to a color hex string.
 * Pure function -- uses inline STREAK_COLORS palette.
 *
 * Active state has 3 tiers based on day_count:
 * - Tier 1: day_count 3-9 (light amber)
 * - Tier 2: day_count 10-49 (orange)
 * - Tier 3: day_count 50+ (deep orange)
 *
 * @param streakState - One of the 5 streak states
 * @param dayCount - Current streak day count
 * @returns Hex color string
 */
export const getStreakColor = (streakState: StreakState, dayCount: number): string => {
  if (streakState === 'warning') return STREAK_COLORS.warning;
  if (streakState === 'active') {
    if (dayCount >= 50) return STREAK_COLORS.activeTier3;
    if (dayCount >= 10) return STREAK_COLORS.activeTier2;
    return STREAK_COLORS.activeTier1;
  }
  if (streakState === 'pending') return STREAK_COLORS.pending;
  if (streakState === 'building') return STREAK_COLORS.building;
  return STREAK_COLORS.default;
};
