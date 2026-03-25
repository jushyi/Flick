export const profileCacheKey = (prefix: string, photoURL: string | null | undefined): string => {
  if (!photoURL) return prefix;
  const tokenMatch = photoURL.match(/token=([^&]+)/);
  if (tokenMatch) {
    return `${prefix}-${tokenMatch[1].slice(-8)}`;
  }
  return `${prefix}-${photoURL.slice(-8)}`;
};
