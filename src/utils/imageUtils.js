/**
 * Generate a dynamic cache key for profile photos that invalidates when the URL changes.
 * @param {string} prefix - Base cache key (e.g., 'profile-abc123')
 * @param {string} photoURL - The photo URL
 * @returns {string} Cache key that changes when the URL changes
 */
export const profileCacheKey = (prefix, photoURL) => {
  if (!photoURL) return prefix;
  // Firebase Storage URLs use the same path for re-uploads (profile-photos/{userId}/profile.jpg)
  // but generate a unique token query param each time. Extract the token to differentiate uploads.
  const tokenMatch = photoURL.match(/token=([^&]+)/);
  if (tokenMatch) {
    return `${prefix}-${tokenMatch[1].slice(-8)}`;
  }
  // Fallback: use last 8 chars of full URL (includes any varying query params)
  return `${prefix}-${photoURL.slice(-8)}`;
};
