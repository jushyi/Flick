/**
 * Generate a dynamic cache key for profile photos that invalidates when the URL changes.
 * @param {string} prefix - Base cache key (e.g., 'profile-abc123')
 * @param {string} photoURL - The photo URL
 * @returns {string} Cache key that changes when the URL changes
 */
export const profileCacheKey = (prefix, photoURL) => {
  if (!photoURL) return prefix;
  // Firebase Storage URLs contain a unique token param that changes on re-upload.
  // Use the last 8 chars of the token as a cheap cache-busting identifier.
  const tokenMatch = photoURL.match(/token=([^&]+)/);
  if (tokenMatch) {
    return `${prefix}-${tokenMatch[1].slice(-8)}`;
  }
  // Fallback: use last 8 chars of full URL (includes query params) for non-Firebase URLs
  return `${prefix}-${photoURL.slice(-8)}`;
};
