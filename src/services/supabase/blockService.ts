/**
 * Supabase Block Service
 *
 * Handles user blocking operations via Supabase.
 * Block cleanup (comments, reactions, friendship removal) is handled
 * server-side by a DB trigger (see 20260324000002_create_social_triggers.sql).
 */

import { supabase } from '@/lib/supabase';

import logger from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface BlockedUser {
  blockedId: string;
  createdAt: string;
  user?: {
    username: string;
    displayName: string;
    profilePhotoPath: string | null;
  };
}

// ============================================================================
// Exported functions
// ============================================================================

/**
 * Block a user
 * Inserts into blocks table. DB trigger handles cleanup automatically.
 */
export async function blockUser(
  blockerId: string,
  blockedId: string
): Promise<void> {
  if (!blockerId || !blockedId) {
    throw new Error('Invalid user IDs');
  }

  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: blockerId, blocked_id: blockedId });

  if (error) {
    logger.error('blockService.blockUser: Failed', {
      blockerId,
      error: error.message,
    });
    throw new Error(error.message);
  }

  logger.info('blockService.blockUser: Success', { blockerId, blockedId });
}

/**
 * Unblock a user
 * Removes block record. Does NOT restore previously removed content.
 */
export async function unblockUser(
  blockerId: string,
  blockedId: string
): Promise<void> {
  if (!blockerId || !blockedId) {
    throw new Error('Invalid user IDs');
  }

  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);

  if (error) {
    logger.error('blockService.unblockUser: Failed', {
      blockerId,
      error: error.message,
    });
    throw new Error(error.message);
  }

  logger.info('blockService.unblockUser: Success', { blockerId, blockedId });
}

/**
 * Get all blocked users with profile info
 * Uses Supabase foreign key join to fetch user data in one query.
 */
export async function getBlockedUsers(
  userId: string
): Promise<BlockedUser[]> {
  const { data, error } = await supabase
    .from('blocks')
    .select(
      'blocked_id, created_at, user:users!blocked_id(username, display_name, profile_photo_path)'
    )
    .eq('blocker_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('blockService.getBlockedUsers: Failed', {
      userId,
      error: error.message,
    });
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    blockedId: row.blocked_id,
    createdAt: row.created_at,
    user: row.user
      ? {
          username: row.user.username,
          displayName: row.user.display_name,
          profilePhotoPath: row.user.profile_photo_path,
        }
      : undefined,
  }));
}

/**
 * Check if a user has blocked another user
 */
export async function isBlocked(
  blockerId: string,
  blockedId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocker_id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .maybeSingle();

  if (error) {
    logger.error('blockService.isBlocked: Failed', {
      blockerId,
      blockedId,
      error: error.message,
    });
    throw new Error(error.message);
  }

  return !!data;
}
