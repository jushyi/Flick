/**
 * Friendship Service (Supabase/PowerSync)
 *
 * All friendship operations use PowerSync local SQLite writes for instant UI updates.
 * PowerSync automatically syncs changes to Supabase in the background.
 *
 * ID ordering: friendships use CHECK(user1_id < user2_id) constraint,
 * so IDs are always sorted before insert/query.
 *
 * Error handling: functions throw on error (TanStack catches at hook level).
 */

import { powerSyncDb } from '@/lib/powersync/database';

/**
 * Generate a simple UUID v4 for local PowerSync writes.
 * Server assigns the canonical UUID on sync, but local needs one immediately.
 */
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Sort two user IDs to satisfy CHECK(user1_id < user2_id) constraint.
 */
function sortUserIds(id1: string, id2: string): [string, string] {
  return id1 < id2 ? [id1, id2] : [id2, id1];
}

// ============================================================================
// Write operations (PowerSync local writes)
// ============================================================================

/**
 * Send a friend request. Sorts IDs deterministically and inserts with status='pending'.
 */
export async function sendFriendRequest(
  fromUserId: string,
  toUserId: string,
): Promise<{
  id: string;
  user1Id: string;
  user2Id: string;
  status: string;
  initiatedBy: string;
}> {
  const id = generateUUID();
  const [user1Id, user2Id] = sortUserIds(fromUserId, toUserId);

  await powerSyncDb.execute(
    `INSERT INTO friendships (id, user1_id, user2_id, status, initiated_by, created_at) VALUES (?, ?, ?, 'pending', ?, datetime('now'))`,
    [id, user1Id, user2Id, fromUserId],
  );

  return { id, user1Id, user2Id, status: 'pending', initiatedBy: fromUserId };
}

/**
 * Accept a pending friend request. Updates status to 'accepted'.
 */
export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  await powerSyncDb.execute(
    `UPDATE friendships SET status = 'accepted' WHERE id = ?`,
    [friendshipId],
  );
}

/**
 * Decline a pending friend request. Deletes the friendship record.
 */
export async function declineFriendRequest(friendshipId: string): Promise<void> {
  await powerSyncDb.execute(`DELETE FROM friendships WHERE id = ?`, [friendshipId]);
}

/**
 * Remove an existing friend. Deletes the friendship record.
 */
export async function unfriend(friendshipId: string): Promise<void> {
  await powerSyncDb.execute(`DELETE FROM friendships WHERE id = ?`, [friendshipId]);
}

// ============================================================================
// Read operations (PowerSync local SQLite queries)
// ============================================================================

/**
 * Get all accepted friends for a user. Returns friend user IDs (not the user's own ID).
 */
export async function getFriends(
  userId: string,
): Promise<Array<{ id: string; friendUserId: string; createdAt: string }>> {
  const rows = await powerSyncDb.getAll<{
    id: string;
    user1_id: string;
    user2_id: string;
    created_at: string;
  }>(
    `SELECT id, user1_id, user2_id, created_at FROM friendships WHERE status = 'accepted' AND (user1_id = ? OR user2_id = ?)`,
    [userId, userId],
  );

  return rows.map((row) => ({
    id: row.id,
    friendUserId: row.user1_id === userId ? row.user2_id : row.user1_id,
    createdAt: row.created_at,
  }));
}

/**
 * Get pending friend requests received by the user (not initiated by them).
 */
export async function getPendingRequests(
  userId: string,
): Promise<
  Array<{
    id: string;
    user1Id: string;
    user2Id: string;
    initiatedBy: string;
    createdAt: string;
  }>
> {
  const rows = await powerSyncDb.getAll<{
    id: string;
    user1_id: string;
    user2_id: string;
    initiated_by: string;
    created_at: string;
  }>(
    `SELECT id, user1_id, user2_id, initiated_by, created_at FROM friendships WHERE status = 'pending' AND initiated_by != ? AND (user1_id = ? OR user2_id = ?)`,
    [userId, userId, userId],
  );

  return rows.map((row) => ({
    id: row.id,
    user1Id: row.user1_id,
    user2Id: row.user2_id,
    initiatedBy: row.initiated_by,
    createdAt: row.created_at,
  }));
}

/**
 * Get pending friend requests sent by the user.
 */
export async function getSentRequests(
  userId: string,
): Promise<
  Array<{
    id: string;
    user1Id: string;
    user2Id: string;
    initiatedBy: string;
    createdAt: string;
  }>
> {
  const rows = await powerSyncDb.getAll<{
    id: string;
    user1_id: string;
    user2_id: string;
    initiated_by: string;
    created_at: string;
  }>(
    `SELECT id, user1_id, user2_id, initiated_by, created_at FROM friendships WHERE status = 'pending' AND initiated_by = ?`,
    [userId],
  );

  return rows.map((row) => ({
    id: row.id,
    user1Id: row.user1_id,
    user2Id: row.user2_id,
    initiatedBy: row.initiated_by,
    createdAt: row.created_at,
  }));
}

/**
 * Get the friendship status between two users. Returns status string or null if none.
 */
export async function getFriendshipStatus(
  userId1: string,
  userId2: string,
): Promise<string | null> {
  const [user1Id, user2Id] = sortUserIds(userId1, userId2);

  const rows = await powerSyncDb.getAll<{ status: string }>(
    `SELECT status FROM friendships WHERE user1_id = ? AND user2_id = ?`,
    [user1Id, user2Id],
  );

  return rows[0]?.status ?? null;
}

/**
 * Get all friend user IDs for a user (accepted friendships only).
 * Useful for mention autocomplete and feed filtering.
 */
export async function getFriendIds(userId: string): Promise<string[]> {
  const rows = await powerSyncDb.getAll<{ user1_id: string; user2_id: string }>(
    `SELECT user1_id, user2_id FROM friendships WHERE status = 'accepted' AND (user1_id = ? OR user2_id = ?)`,
    [userId, userId],
  );

  return rows.map((row) => (row.user1_id === userId ? row.user2_id : row.user1_id));
}
