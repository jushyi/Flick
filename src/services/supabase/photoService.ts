/**
 * Photo Service (Supabase + PowerSync)
 *
 * Handles all photo CRUD, triage, and reaction operations.
 * Photo mutations use PowerSync local writes (synced to Supabase automatically).
 * Reactions use Supabase client directly (photo_reactions is not in PowerSync schema).
 *
 * Throw-on-error pattern: all functions throw on failure instead of returning { success, error }.
 */

import { getPowerSyncDb } from '@/lib/powersync/PowerSyncProvider';
import { supabase } from '@/lib/supabase';

import logger from '../../utils/logger';

// =============================================================================
// Types
// =============================================================================

export interface Photo {
  id: string;
  userId: string;
  imageUrl: string | null;
  localUri: string | null;
  thumbnailDataUrl: string | null;
  status: 'developing' | 'revealed';
  photoState: 'journal' | 'archive' | null;
  mediaType: 'photo' | 'video';
  caption: string | null;
  revealAt: string | null;
  storagePath: string | null;
  commentCount: number;
  reactionCount: number;
  deletedAt: string | null;
  createdAt: string;
}

/**
 * Map a database row (snake_case) to a Photo object (camelCase)
 */
export const mapToPhoto = (row: any): Photo => ({
  id: row.id,
  userId: row.user_id,
  imageUrl: row.image_url ?? null,
  localUri: row.local_uri ?? null,
  thumbnailDataUrl: row.thumbnail_data_url ?? null,
  status: row.status,
  photoState: row.photo_state ?? null,
  mediaType: row.media_type ?? 'photo',
  caption: row.caption ?? null,
  revealAt: row.reveal_at ?? null,
  storagePath: row.storage_path ?? null,
  commentCount: row.comment_count ?? 0,
  reactionCount: row.reaction_count ?? 0,
  deletedAt: row.deleted_at ?? null,
  createdAt: row.created_at,
});

// =============================================================================
// Photo CRUD (PowerSync local writes)
// =============================================================================

/**
 * Create a new photo record in developing status.
 * Called immediately after capture so photo appears in darkroom.
 */
export const createPhotoRecord = async (
  userId: string,
  photoId: string,
  localUri: string,
  revealAt: string,
  mediaType: 'photo' | 'video' = 'photo',
  thumbnailDataUrl: string | null = null,
): Promise<void> => {
  const db = getPowerSyncDb();
  if (!db) {
    throw new Error('PowerSync database not initialized');
  }

  const createdAt = new Date().toISOString();

  await db.execute(
    'INSERT INTO photos (id, user_id, status, photo_state, local_uri, image_url, storage_path, thumbnail_data_url, reveal_at, media_type, caption, comment_count, reaction_count, deleted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [photoId, userId, 'developing', null, localUri, null, null, thumbnailDataUrl, revealAt, mediaType, null, 0, 0, null, createdAt],
  );

  logger.info('photoService.createPhotoRecord: Created', { photoId, userId });
};

/**
 * Update photo record after upload completes with the public URL and storage path.
 * Called by uploadQueueService after successful upload.
 */
export const updatePhotoAfterUpload = async (
  photoId: string,
  imageUrl: string,
  storagePath: string,
): Promise<void> => {
  const db = getPowerSyncDb();
  if (!db) {
    throw new Error('PowerSync database not initialized');
  }

  await db.execute(
    'UPDATE photos SET image_url = ?, storage_path = ? WHERE id = ?',
    [imageUrl, storagePath, photoId],
  );

  logger.info('photoService.updatePhotoAfterUpload: Updated', { photoId });
};

/**
 * Triage a photo (journal or archive)
 */
export const triagePhoto = async (
  photoId: string,
  action: 'journal' | 'archive',
): Promise<void> => {
  const db = getPowerSyncDb();
  if (!db) {
    throw new Error('PowerSync database not initialized');
  }

  await db.execute(
    'UPDATE photos SET photo_state = ? WHERE id = ?',
    [action, photoId],
  );

  logger.info('photoService.triagePhoto: Triaged', { photoId, action });
};

/**
 * Batch triage multiple photos
 */
export const batchTriagePhotos = async (
  photoIds: string[],
  action: 'journal' | 'archive',
): Promise<void> => {
  const db = getPowerSyncDb();
  if (!db) {
    throw new Error('PowerSync database not initialized');
  }

  for (const photoId of photoIds) {
    await db.execute(
      'UPDATE photos SET photo_state = ? WHERE id = ?',
      [action, photoId],
    );
  }

  logger.info('photoService.batchTriagePhotos: Triaged batch', { count: photoIds.length, action });
};

/**
 * Soft delete a photo (sets deleted_at timestamp)
 */
export const softDeletePhoto = async (photoId: string): Promise<void> => {
  const db = getPowerSyncDb();
  if (!db) {
    throw new Error('PowerSync database not initialized');
  }

  await db.execute(
    'UPDATE photos SET deleted_at = ? WHERE id = ?',
    [new Date().toISOString(), photoId],
  );

  logger.info('photoService.softDeletePhoto: Soft deleted', { photoId });
};

/**
 * Restore a soft-deleted photo
 */
export const restorePhoto = async (photoId: string): Promise<void> => {
  const db = getPowerSyncDb();
  if (!db) {
    throw new Error('PowerSync database not initialized');
  }

  await db.execute(
    'UPDATE photos SET deleted_at = ? WHERE id = ?',
    [null, photoId],
  );

  logger.info('photoService.restorePhoto: Restored', { photoId });
};

/**
 * Get all non-deleted photos for a user, newest first
 */
export const getUserPhotos = async (userId: string): Promise<Photo[]> => {
  const db = getPowerSyncDb();
  if (!db) {
    throw new Error('PowerSync database not initialized');
  }

  const rows = await db.getAll(
    'SELECT * FROM photos WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
    [userId],
  );

  return rows.map(mapToPhoto);
};

/**
 * Get a single photo by ID (non-deleted only)
 */
export const getPhotoById = async (photoId: string): Promise<Photo | null> => {
  const db = getPowerSyncDb();
  if (!db) {
    throw new Error('PowerSync database not initialized');
  }

  const row = await db.get(
    'SELECT * FROM photos WHERE id = ? AND deleted_at IS NULL',
    [photoId],
  );

  return row ? mapToPhoto(row) : null;
};

/**
 * Update photo caption
 */
export const updatePhotoCaption = async (
  photoId: string,
  caption: string,
): Promise<void> => {
  const db = getPowerSyncDb();
  if (!db) {
    throw new Error('PowerSync database not initialized');
  }

  await db.execute(
    'UPDATE photos SET caption = ? WHERE id = ?',
    [caption, photoId],
  );

  logger.info('photoService.updatePhotoCaption: Updated', { photoId });
};

// =============================================================================
// Reactions (Supabase client -- not in PowerSync schema)
// =============================================================================

/**
 * Add a reaction to a photo.
 * Uses upsert to handle duplicate reactions gracefully.
 * Note: reaction_count on photos table is NOT updated here --
 * Phase 18 will add a database trigger for that.
 */
export const addReaction = async (
  photoId: string,
  userId: string,
  emoji: string,
): Promise<void> => {
  // Cast needed: Database types are placeholder until schema is deployed and types regenerated
  const { error } = await (supabase as any)
    .from('photo_reactions')
    .upsert(
      { photo_id: photoId, user_id: userId, emoji },
      { onConflict: 'photo_id,user_id,emoji' },
    );

  if (error) {
    throw new Error(`Failed to add reaction: ${error.message}`);
  }

  logger.info('photoService.addReaction: Added', { photoId, emoji });
};

/**
 * Remove a reaction from a photo
 */
export const removeReaction = async (
  photoId: string,
  userId: string,
  emoji: string,
): Promise<void> => {
  // Cast needed: Database types are placeholder until schema is deployed and types regenerated
  const { error } = await (supabase as any)
    .from('photo_reactions')
    .delete()
    .match({ photo_id: photoId, user_id: userId, emoji });

  if (error) {
    throw new Error(`Failed to remove reaction: ${error.message}`);
  }

  logger.info('photoService.removeReaction: Removed', { photoId, emoji });
};
