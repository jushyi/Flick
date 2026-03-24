/**
 * Profile Service (Supabase)
 *
 * User profile CRUD via Supabase client. This is the service layer --
 * hooks (useProfile, useUpdateProfile) call these functions.
 *
 * Throw-on-error pattern: all functions throw on failure.
 */

import { supabase } from '@/lib/supabase';

import logger from '../../utils/logger';

// =============================================================================
// Types
// =============================================================================

export interface UserProfile {
  id: string;
  displayName: string | null;
  username: string | null;
  bio: string | null;
  profilePhotoPath: string | null;
  selects: string[];
  song: Record<string, unknown> | null;
  pinnedSnapData: Record<string, unknown> | null;
  friendCount: number;
  nameColor: string | null;
  dailyPhotoCount: number;
  lastPhotoDate: string | null;
  profileSetupCompleted: boolean;
  readReceiptsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Fields allowed for profile updates */
export type UserProfileUpdatable = Partial<
  Pick<
    UserProfile,
    | 'displayName'
    | 'username'
    | 'bio'
    | 'profilePhotoPath'
    | 'selects'
    | 'song'
    | 'pinnedSnapData'
    | 'nameColor'
    | 'profileSetupCompleted'
    | 'readReceiptsEnabled'
  >
>;

// =============================================================================
// Mapping helpers
// =============================================================================

/** Map a database row (snake_case) to a UserProfile object (camelCase) */
export const mapToUserProfile = (row: any): UserProfile => ({
  id: row.id,
  displayName: row.display_name ?? null,
  username: row.username ?? null,
  bio: row.bio ?? null,
  profilePhotoPath: row.profile_photo_path ?? null,
  selects: row.selects ?? [],
  song: row.song ?? null,
  pinnedSnapData: row.pinned_snap_data ?? null,
  friendCount: row.friend_count ?? 0,
  nameColor: row.name_color ?? null,
  dailyPhotoCount: row.daily_photo_count ?? 0,
  lastPhotoDate: row.last_photo_date ?? null,
  profileSetupCompleted: row.profile_setup_completed ?? false,
  readReceiptsEnabled: row.read_receipts_enabled ?? true,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** Map camelCase update fields to snake_case for Supabase */
const mapUpdatesToSnakeCase = (updates: UserProfileUpdatable): Record<string, unknown> => {
  const mapping: Record<string, string> = {
    displayName: 'display_name',
    username: 'username',
    bio: 'bio',
    profilePhotoPath: 'profile_photo_path',
    selects: 'selects',
    song: 'song',
    pinnedSnapData: 'pinned_snap_data',
    nameColor: 'name_color',
    profileSetupCompleted: 'profile_setup_completed',
    readReceiptsEnabled: 'read_receipts_enabled',
  };

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    const snakeKey = mapping[key];
    if (snakeKey) {
      result[snakeKey] = value;
    }
  }
  return result;
};

// =============================================================================
// Profile CRUD
// =============================================================================

const USER_SELECT_FIELDS =
  'id, display_name, username, bio, profile_photo_path, selects, song, pinned_snap_data, friend_count, name_color, daily_photo_count, last_photo_date, profile_setup_completed, read_receipts_enabled, created_at, updated_at';

/**
 * Fetch a user profile by ID.
 * Throws if user not found.
 */
export const getUserProfile = async (userId: string): Promise<UserProfile> => {
  // Cast needed: Database types are placeholder until schema is deployed and types regenerated
  const { data, error } = await (supabase as any)
    .from('users')
    .select(USER_SELECT_FIELDS)
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch user profile: ${error.message}`);
  }

  return mapToUserProfile(data);
};

/**
 * Update a user profile. Returns the updated profile.
 * Throws on error.
 */
export const updateUserProfile = async (
  userId: string,
  updates: UserProfileUpdatable,
): Promise<UserProfile> => {
  const snakeCaseUpdates = mapUpdatesToSnakeCase(updates);

  // Cast needed: Database types are placeholder until schema is deployed and types regenerated
  const { data, error } = await (supabase as any)
    .from('users')
    .update(snakeCaseUpdates)
    .eq('id', userId)
    .select(USER_SELECT_FIELDS)
    .single();

  if (error) {
    throw new Error(`Failed to update user profile: ${error.message}`);
  }

  logger.info('profileService.updateUserProfile: Updated', { userId });
  return mapToUserProfile(data);
};

/**
 * Check if a username is available.
 * Returns true if available (no user has it, or only currentUserId has it).
 */
export const checkUsernameAvailability = async (
  username: string,
  currentUserId?: string,
): Promise<boolean> => {
  const normalized = username.toLowerCase().trim();

  // Cast needed: Database types are placeholder until schema is deployed and types regenerated
  const { data, error } = await (supabase as any)
    .from('users')
    .select('id')
    .eq('username', normalized)
    .limit(1);

  if (error) {
    throw new Error(`Failed to check username availability: ${error.message}`);
  }

  if (!data || data.length === 0) return true;
  if (currentUserId && data.length === 1 && data[0].id === currentUserId) return true;
  return false;
};

// =============================================================================
// Daily Photo Count
// =============================================================================

/**
 * Get the current daily photo count for a user.
 * Resets to 0 if last_photo_date is not today.
 */
export const getDailyPhotoCount = async (
  userId: string,
): Promise<{ count: number; limitReached: boolean }> => {
  // Cast needed: Database types are placeholder until schema is deployed and types regenerated
  const { data, error } = await (supabase as any)
    .from('users')
    .select('daily_photo_count, last_photo_date')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to get daily photo count: ${error.message}`);
  }

  const today = new Date().toISOString().split('T')[0];
  const isToday = data?.last_photo_date === today;

  if (!isToday) {
    return { count: 0, limitReached: false };
  }

  const count = data?.daily_photo_count ?? 0;
  return { count, limitReached: count >= 36 };
};

/**
 * Atomically increment the daily photo count.
 * Uses the increment_daily_photo_count RPC to prevent race conditions.
 * Returns the new count.
 * Throws if user not found or daily limit already reached.
 */
export const incrementDailyPhotoCount = async (userId: string): Promise<number> => {
  const { data, error } = await (supabase as any).rpc('increment_daily_photo_count', {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(`Failed to increment daily photo count: ${error.message}`);
  }

  return data as number;
};
