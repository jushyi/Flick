import logger from '../utils/logger';

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  previewUrl: string;
  duration: number;
}

interface ITunesSearchResponse {
  resultCount: number;
  results: ITunesTrack[];
}

interface ITunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
}

const ITUNES_API_BASE = 'https://itunes.apple.com/search';

export const searchSongs = async (searchQuery: string, limit = 25): Promise<Song[]> => {
  if (!searchQuery || !searchQuery.trim()) {
    logger.debug('iTunesService: Empty query, returning empty results');
    return [];
  }

  const trimmedQuery = searchQuery.trim();
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

    const data: ITunesSearchResponse = await response.json();
    logger.debug('iTunesService: Received results', { count: data.resultCount });

    const songs: Song[] = data.results.map(track => ({
      id: String(track.trackId),
      title: track.trackName,
      artist: track.artistName,
      album: track.collectionName || '',
      albumArt: track.artworkUrl100 ? track.artworkUrl100.replace(/100x100/, '300x300') : '',
      previewUrl: track.previewUrl || '',
      duration: track.trackTimeMillis || 0,
    }));

    logger.info('iTunesService: Search complete', {
      query: trimmedQuery,
      resultCount: songs.length,
    });

    return songs;
  } catch (err) {
    const error = err as Error;
    logger.error('iTunesService: Search failed', { error: error?.message });
    return [];
  }
};

export const formatDuration = (ms: number | null | undefined): string => {
  if (!ms || ms <= 0) return '0:00';

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
