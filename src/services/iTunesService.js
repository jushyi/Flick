/**
 * iTunes Search API Service
 *
 * Provides song search functionality using the iTunes Search API.
 * Returns normalized song data for profile song feature.
 */

import logger from '../utils/logger';

/**
 * @typedef {Object} Song
 * @property {string} id - iTunes trackId as string
 * @property {string} title - Track name
 * @property {string} artist - Artist name
 * @property {string} album - Album/collection name
 * @property {string} albumArt - Artwork URL (300x300)
 * @property {string} previewUrl - 30-second preview URL
 * @property {number} duration - Track duration in ms
 */

const ITUNES_API_BASE = 'https://itunes.apple.com/search';

/**
 * Search for songs using the iTunes Search API.
 *
 * @param {string} query - Search term
 * @param {number} limit - Maximum number of results (default 25)
 * @returns {Promise<Song[]>} Array of song results
 */
export const searchSongs = async (query, limit = 25) => {
  // Return early if query is empty or whitespace
  if (!query || !query.trim()) {
    logger.debug('iTunesService: Empty query, returning empty results');
    return [];
  }

  const trimmedQuery = query.trim();
  logger.debug('iTunesService: Searching for', { query: trimmedQuery, limit });

  try {
    const params = new URLSearchParams({
      term: trimmedQuery,
      media: 'music',
      entity: 'song',
      limit: String(limit),
    });

    const url = `${ITUNES_API_BASE}?${params.toString()}`;
    logger.debug('iTunesService: Fetching', { url });

    const response = await fetch(url);

    if (!response.ok) {
      logger.error('iTunesService: API error', {
        status: response.status,
        statusText: response.statusText,
      });
      return [];
    }

    const data = await response.json();
    logger.debug('iTunesService: Received results', { count: data.resultCount });

    // Map results to Song type
    const songs = data.results.map(track => ({
      id: String(track.trackId),
      title: track.trackName,
      artist: track.artistName,
      album: track.collectionName || '',
      // Replace 100x100 with 300x300 for higher quality artwork
      albumArt: track.artworkUrl100 ? track.artworkUrl100.replace(/100x100/, '300x300') : '',
      previewUrl: track.previewUrl || '',
      duration: track.trackTimeMillis || 0,
    }));

    logger.info('iTunesService: Search complete', {
      query: trimmedQuery,
      resultCount: songs.length,
    });

    return songs;
  } catch (error) {
    logger.error('iTunesService: Search failed', { error: error?.message });
    return [];
  }
};

/**
 * Format duration in milliseconds to "M:SS" display format.
 *
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration (e.g., "4:03")
 */
export const formatDuration = ms => {
  if (!ms || ms <= 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
