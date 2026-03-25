import { EMOJI_POOLS, POOL_KEYS } from '../constants/emojiPools';

function hashCode(str: string): number {
  let hash = 0;
  if (!str || str.length === 0) return hash;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return Math.abs(hash);
}

export function getCuratedEmojis(photoId: string | null | undefined, count = 5): string[] {
  if (!photoId) {
    return POOL_KEYS.slice(0, count).map(key => EMOJI_POOLS[key][0]);
  }

  const hash = hashCode(photoId);
  const result: string[] = [];
  const usedPools = new Set<number>();
  const prime = 31;

  for (let i = 0; i < count; i++) {
    let poolIndex = (hash + i * prime) % POOL_KEYS.length;

    let attempts = 0;
    while (usedPools.has(poolIndex) && attempts < POOL_KEYS.length) {
      poolIndex = (poolIndex + 1) % POOL_KEYS.length;
      attempts++;
    }

    usedPools.add(poolIndex);

    const poolKey = POOL_KEYS[poolIndex];
    const pool = EMOJI_POOLS[poolKey];
    const emojiIndex = (hash + i * prime * 7) % pool.length;

    result.push(pool[emojiIndex]);
  }

  return result;
}
