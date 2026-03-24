/**
 * Darkroom Service (Supabase + PowerSync)
 *
 * Manages the batch photo reveal system. Photos are captured in "developing"
 * status and revealed together when their reveal_at timestamp expires.
 *
 * Key concepts:
 * - Batch reveal: multiple rapid captures share the same reveal_at timestamp
 * - calculateBatchRevealAt joins an existing batch or creates a new 0-5 min window
 * - checkAndRevealPhotos flips all ready photos to 'revealed' status
 *
 * All operations use PowerSync local reads/writes (synced to Supabase automatically).
 * Throw-on-error pattern.
 */

import { getPowerSyncDb } from '@/lib/powersync/PowerSyncProvider';

import { mapToPhoto, Photo } from './photoService';

import logger from '../../utils/logger';

// =============================================================================
// Reveal Operations
// =============================================================================

/**
 * Check for photos ready to reveal and update their status.
 * Returns the number of photos revealed.
 */
export const checkAndRevealPhotos = async (userId: string): Promise<number> => {
  const db = getPowerSyncDb();
  if (!db) {
    throw new Error('PowerSync database not initialized');
  }

  const now = new Date().toISOString();

  const readyPhotos = await db.getAll(
    'SELECT id FROM photos WHERE user_id = ? AND status = ? AND reveal_at <= ? AND deleted_at IS NULL',
    [userId, 'developing', now],
  );

  if (readyPhotos.length === 0) {
    return 0;
  }

  for (const photo of readyPhotos) {
    await db.execute(
      'UPDATE photos SET status = ? WHERE id = ?',
      ['revealed', photo.id],
    );
  }

  logger.info('darkroomService.checkAndRevealPhotos: Revealed batch', {
    userId,
    count: readyPhotos.length,
  });

  return readyPhotos.length;
};

/**
 * Get the next reveal time for a user's developing photos.
 * Returns the earliest reveal_at timestamp, or null if no developing photos.
 */
export const getNextRevealTime = async (userId: string): Promise<string | null> => {
  const db = getPowerSyncDb();
  if (!db) {
    throw new Error('PowerSync database not initialized');
  }

  const result = await db.get(
    'SELECT MIN(reveal_at) as next_reveal FROM photos WHERE user_id = ? AND status = ? AND deleted_at IS NULL',
    [userId, 'developing'],
  );

  return result?.next_reveal ?? null;
};

/**
 * Calculate the reveal_at timestamp for a new photo.
 * If there's an existing batch of developing photos with a future reveal_at,
 * the new photo joins that batch (returns the same timestamp).
 * If no existing batch, generates a random 0-5 minute future timestamp.
 */
export const calculateBatchRevealAt = async (userId: string): Promise<string> => {
  const db = getPowerSyncDb();
  if (!db) {
    throw new Error('PowerSync database not initialized');
  }

  const now = new Date().toISOString();

  const result = await db.get(
    'SELECT MIN(reveal_at) as batch_reveal_at FROM photos WHERE user_id = ? AND status = ? AND deleted_at IS NULL AND reveal_at > ?',
    [userId, 'developing', now],
  );

  if (result?.batch_reveal_at) {
    logger.info('darkroomService.calculateBatchRevealAt: Joining existing batch', {
      userId,
      revealAt: result.batch_reveal_at,
    });
    return result.batch_reveal_at;
  }

  // No existing batch -- generate random 0-5 minute future timestamp
  const revealAt = new Date(Date.now() + Math.random() * 5 * 60 * 1000).toISOString();

  logger.info('darkroomService.calculateBatchRevealAt: New batch', {
    userId,
    revealAt,
  });

  return revealAt;
};

// =============================================================================
// Photo Queries
// =============================================================================

/**
 * Get all developing (unrevealed) photos for a user
 */
export const getDevelopingPhotos = async (userId: string): Promise<Photo[]> => {
  const db = getPowerSyncDb();
  if (!db) {
    throw new Error('PowerSync database not initialized');
  }

  const rows = await db.getAll(
    'SELECT * FROM photos WHERE user_id = ? AND status = ? AND deleted_at IS NULL ORDER BY created_at DESC',
    [userId, 'developing'],
  );

  return rows.map(mapToPhoto);
};

/**
 * Get all revealed photos for a user
 */
export const getRevealedPhotos = async (userId: string): Promise<Photo[]> => {
  const db = getPowerSyncDb();
  if (!db) {
    throw new Error('PowerSync database not initialized');
  }

  const rows = await db.getAll(
    'SELECT * FROM photos WHERE user_id = ? AND status = ? AND deleted_at IS NULL ORDER BY created_at DESC',
    [userId, 'revealed'],
  );

  return rows.map(mapToPhoto);
};
