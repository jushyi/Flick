/**
 * Feed Service (Supabase)
 *
 * Fetches the user's friend feed via a single SQL RPC call that JOINs
 * photos + users + friendships with block filtering and cursor pagination.
 *
 * Throw-on-error pattern: all functions throw on failure.
 */

import { supabase } from '@/lib/supabase';

import logger from '../../utils/logger';

// =============================================================================
// Types
// =============================================================================

export interface FeedPhoto {
  id: string;
  userId: string;
  imageUrl: string;
  thumbnailDataUrl: string | null;
  status: string;
  photoState: string;
  mediaType: string;
  caption: string | null;
  storagePath: string | null;
  commentCount: number;
  reactionCount: number;
  createdAt: string;
  // Joined user data
  username: string;
  displayName: string | null;
  profilePhotoPath: string | null;
  nameColor: string | null;
}

/**
 * Map a database row (snake_case) to a FeedPhoto object (camelCase)
 */
const mapToFeedPhoto = (row: any): FeedPhoto => ({
  id: row.id,
  userId: row.user_id,
  imageUrl: row.image_url,
  thumbnailDataUrl: row.thumbnail_data_url ?? null,
  status: row.status,
  photoState: row.photo_state,
  mediaType: row.media_type,
  caption: row.caption ?? null,
  storagePath: row.storage_path ?? null,
  commentCount: row.comment_count ?? 0,
  reactionCount: row.reaction_count ?? 0,
  createdAt: row.created_at,
  username: row.username,
  displayName: row.display_name ?? null,
  profilePhotoPath: row.profile_photo_path ?? null,
  nameColor: row.name_color ?? null,
});

// =============================================================================
// Feed Queries
// =============================================================================

/**
 * Fetch the user's friend feed via the get_feed RPC.
 * Returns revealed, journal-state photos from accepted friends,
 * excluding blocked users, with cursor-based pagination.
 */
export const getFeed = async (params: {
  userId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<FeedPhoto[]> => {
  const start = Date.now();

  const { data, error } = await (supabase as any).rpc('get_feed', {
    p_user_id: params.userId,
    p_cursor: params.cursor ?? null,
    p_limit: params.limit ?? 20,
  });

  if (error) {
    throw new Error(`Failed to fetch feed: ${error.message}`);
  }

  const photos = (data ?? []).map(mapToFeedPhoto);

  logger.debug('feedService.getFeed: Fetched', {
    count: photos.length,
    durationMs: Date.now() - start,
  });

  return photos;
};

/**
 * Fetch a single photo with joined user data for the PhotoDetail screen.
 * Returns null if photo not found.
 */
export const getPhotoByIdWithUser = async (photoId: string): Promise<FeedPhoto | null> => {
  const { data, error } = await (supabase as any)
    .from('photos')
    .select(
      '*, users!inner(username, display_name, profile_photo_path, name_color)',
    )
    .eq('id', photoId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw new Error(`Failed to fetch photo: ${error.message}`);
  }

  if (!data) return null;

  // Flatten the nested users object into the photo row
  const row = {
    ...data,
    username: data.users?.username,
    display_name: data.users?.display_name,
    profile_photo_path: data.users?.profile_photo_path,
    name_color: data.users?.name_color,
  };

  return mapToFeedPhoto(row);
};
