/**
 * Generate a dynamic cache key for profile photos that invalidates when the URL changes.
 * @param {string} prefix - Base cache key (e.g., 'profile-abc123')
 * @param {string} photoURL - The photo URL
 * @returns {string} Cache key that changes when the URL changes
 */
export const profileCacheKey = (prefix, photoURL) => {
  if (!photoURL) return prefix;
  // Use last 8 chars of URL path (before query params) as a cheap content identifier
  const base = photoURL.split('?')[0];
  return `${prefix}-${base.slice(-8)}`;
};
