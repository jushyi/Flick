/**
 * Deterministic emoji rotation based on photo ID.
 * Ensures the same photo always shows the same curated emojis.
 */

import { EMOJI_POOLS, POOL_KEYS } from '../constants/emojiPools';

/**
 * Simple hash function for strings.
 * Produces consistent numeric hash from string input.
 */
function hashCode(str) {
  let hash = 0;
  if (!str || str.length === 0) return hash;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash);
}

/**
 * Get curated emojis for a specific photo.
 * Uses photo ID to deterministically select emojis from different categories.
 *
 * @param {string} photoId - The unique identifier of the photo
 * @param {number} count - Number of emojis to return (default: 5)
 * @returns {string[]} Array of emoji characters
 */
export function getCuratedEmojis(photoId, count = 5) {
  if (!photoId) {
    // Fallback to first emoji from each pool if no photoId
    return POOL_KEYS.slice(0, count).map(key => EMOJI_POOLS[key][0]);
  }

  const hash = hashCode(photoId);
  const result = [];
  const usedPools = new Set();

  // Prime multiplier for better distribution across pools
  const prime = 31;

  for (let i = 0; i < count; i++) {
    // Select pool index, ensuring variety by using different pools
    let poolIndex = (hash + i * prime) % POOL_KEYS.length;

    // If we've used this pool, find the next available one
    let attempts = 0;
    while (usedPools.has(poolIndex) && attempts < POOL_KEYS.length) {
      poolIndex = (poolIndex + 1) % POOL_KEYS.length;
      attempts++;
    }

    usedPools.add(poolIndex);

    const poolKey = POOL_KEYS[poolIndex];
    const pool = EMOJI_POOLS[poolKey];

    // Select emoji within pool based on hash variation
    const emojiIndex = (hash + i * prime * 7) % pool.length;

    result.push(pool[emojiIndex]);
  }

  return result;
}
