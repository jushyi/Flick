/**
 * Streak Service (Read-Only)
 *
 * Client-side streak state derivation and Firestore subscription helpers.
 * All streak writes are server-authoritative (Cloud Functions only).
 * This service provides:
 * - Deterministic streak ID generation (mirrors conversation ID pattern)
 * - Pure state derivation from streak document fields
 * - Color mapping based on streak state and tier
 * - Real-time Firestore subscriptions for single and multi-streak listeners
 *
 * Streak document structure (written by Cloud Functions):
 * streaks/{lowerUserId_higherUserId}
 * {
 *   participants: [userId1, userId2],
 *   dayCount: number,
 *   expiresAt: Timestamp | null,
 *   warning: boolean,
 *   lastSnapBy: { [userId]: Timestamp },
 *   createdAt: Timestamp,
 *   updatedAt: Timestamp,
 * }
 */

import {
  getFirestore,
  doc,
  collection,
  query,
  where,
  onSnapshot,
} from '@react-native-firebase/firestore';

import { colors } from '../../constants/colors';

import logger from '../../utils/logger';

const db = getFirestore();

/**
 * Generate a deterministic streak ID from two user IDs.
 * Sorts both IDs alphabetically and joins with underscore.
 * Duplicates the 3-line pattern from messageService to avoid circular dependencies.
 *
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {string} Streak ID in format: [lowerUserId]_[higherUserId]
 */
export const generateStreakId = (userId1, userId2) => {
  const [lower, higher] = [userId1, userId2].sort();
  return `${lower}_${higher}`;
};

/**
 * Derive the visual streak state from a streak document and the current user.
 * Pure function — no side effects or Firestore calls.
 *
 * States:
 * - 'default': No streak activity
 * - 'building': Both or one party snapped, streak not yet established
 * - 'pending': Current user snapped but friend has not
 * - 'active': Streak dayCount >= 3
 * - 'warning': Streak about to expire
 *
 * @param {object|null} streak - Streak document data
 * @param {string} currentUserId - The current user's ID
 * @returns {'default'|'building'|'pending'|'active'|'warning'}
 */
export const deriveStreakState = (streak, currentUserId) => {
  if (!streak) return 'default';

  if (!streak.expiresAt) {
    // No active streak period — check if building
    const mySnap = streak.lastSnapBy?.[currentUserId];
    const otherUserId = streak.participants?.find(p => p !== currentUserId);
    const theirSnap = otherUserId ? streak.lastSnapBy?.[otherUserId] : null;
    if (mySnap && !theirSnap) return 'pending';
    if (mySnap || theirSnap) return 'building';
    return 'default';
  }

  if (streak.warning) return 'warning';
  if (streak.dayCount >= 3) return 'active';

  // dayCount 1-2: building toward visible streak
  // Check if current user has snapped in current cycle
  const mySnap = streak.lastSnapBy?.[currentUserId];
  const otherUserId = streak.participants?.find(p => p !== currentUserId);
  const theirSnap = otherUserId ? streak.lastSnapBy?.[otherUserId] : null;
  if (mySnap && !theirSnap) return 'pending';
  return 'building';
};

/**
 * Map a streak state and day count to a color hex string.
 * Pure function — uses STREAK_COLORS from the design system.
 *
 * Color tiers for active state:
 * - Day 3-9:  Light amber (#F5A623)
 * - Day 10-49: Orange (#FF8C00)
 * - Day 50+:  Deep orange (#E65100)
 *
 * @param {'default'|'building'|'pending'|'active'|'warning'} streakState
 * @param {number} dayCount
 * @returns {string} Hex color string
 */
export const getStreakColor = (streakState, dayCount) => {
  if (streakState === 'warning') return colors.streak.warning;
  if (streakState === 'active') {
    if (dayCount >= 50) return colors.streak.activeTier3;
    if (dayCount >= 10) return colors.streak.activeTier2;
    return colors.streak.activeTier1;
  }
  if (streakState === 'pending') return colors.streak.pending;
  if (streakState === 'building') return colors.streak.building;
  return colors.streak.default;
};

/**
 * Subscribe to a single streak document between two users.
 * Uses onSnapshot for real-time updates.
 *
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @param {function} callback - Called with streak data object or null
 * @returns {function} Unsubscribe function
 */
export const subscribeToStreak = (userId1, userId2, callback) => {
  const streakId = generateStreakId(userId1, userId2);
  const streakRef = doc(db, 'streaks', streakId);

  const unsubscribe = onSnapshot(
    streakRef,
    snapshot => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() });
      } else {
        callback(null);
      }
    },
    error => {
      logger.error('Streak subscription error', { streakId, error: error.message });
      callback(null);
    }
  );

  return unsubscribe;
};

/**
 * Subscribe to ALL streaks for a user.
 * Uses a single collection query with array-contains to avoid N+1 subscriptions.
 * (Research Pitfall 6: single-listener approach)
 *
 * @param {string} userId - The user ID to subscribe for
 * @param {function} callback - Called with array of streak objects [{id, ...data}, ...]
 * @returns {function} Unsubscribe function
 */
export const subscribeToUserStreaks = (userId, callback) => {
  const streaksRef = collection(db, 'streaks');
  const q = query(streaksRef, where('participants', 'array-contains', userId));

  const unsubscribe = onSnapshot(
    q,
    snapshot => {
      const streaks = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      callback(streaks);
    },
    error => {
      logger.error('User streaks subscription error', { userId, error: error.message });
      callback([]);
    }
  );

  return unsubscribe;
};
