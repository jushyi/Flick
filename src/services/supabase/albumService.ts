/**
 * Album Service (Supabase)
 *
 * Manages album CRUD operations using Supabase with junction table pattern.
 * Custom albums use albums + album_photos tables.
 * Monthly albums use server-side RPC (get_monthly_photos).
 */

import { supabase } from '@/lib/supabase';

import logger from '../../utils/logger';

// =============================================================================
// Types
// =============================================================================

export interface Album {
  id: string;
  userId: string;
  title: string;
  type: 'custom' | 'monthly';
  monthKey: string | null;
  coverPhotoId: string | null;
  createdAt: string;
  photoCount?: number;
}

export interface MonthlyAlbumGroup {
  monthKey: string;
  photoCount: number;
  photos: Array<{
    id: string;
    imageUrl: string;
    createdAt: string;
    photoState: string;
  }>;
}

// =============================================================================
// Constants
// =============================================================================

export const MAX_TITLE_LENGTH = 24;

// =============================================================================
// Helpers
// =============================================================================

function mapAlbumRow(row: any): Album {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    type: row.type,
    monthKey: row.month_key,
    coverPhotoId: row.cover_photo_id,
    createdAt: row.created_at,
    photoCount: row.album_photos?.[0]?.count ?? undefined,
  };
}

// =============================================================================
// Album CRUD
// =============================================================================

/**
 * Create a new album with initial photos.
 * First photo becomes the cover photo.
 */
export async function createAlbum(
  userId: string,
  title: string,
  photoIds: string[]
): Promise<Album> {
  logger.debug('AlbumService.createAlbum: Starting', {
    userId,
    title,
    photoCount: photoIds?.length,
  });

  const trimmedTitle = title?.trim();
  if (!trimmedTitle || trimmedTitle.length === 0) {
    throw new Error('Album name is required');
  }

  if (trimmedTitle.length > MAX_TITLE_LENGTH) {
    throw new Error(
      `Album name must be ${MAX_TITLE_LENGTH} characters or less`
    );
  }

  if (!photoIds || photoIds.length === 0) {
    throw new Error('At least one photo is required');
  }

  // Insert album record
  const { data: album, error: albumError } = await supabase
    .from('albums')
    .insert({
      user_id: userId,
      title: trimmedTitle,
      type: 'custom',
      cover_photo_id: photoIds[0],
    })
    .select()
    .single();

  if (albumError) throw albumError;

  // Batch-insert album_photos junction rows
  const { error: photosError } = await supabase
    .from('album_photos')
    .insert(
      photoIds.map((photoId) => ({
        album_id: album.id,
        photo_id: photoId,
      }))
    );

  if (photosError) throw photosError;

  logger.info('AlbumService.createAlbum: Album created successfully', {
    albumId: album.id,
    userId,
    photoCount: photoIds.length,
  });

  return mapAlbumRow(album);
}

/**
 * Get a single album with its photo IDs.
 */
export async function getAlbum(
  albumId: string
): Promise<Album & { photos: string[] }> {
  logger.debug('AlbumService.getAlbum: Starting', { albumId });

  const { data: album, error: albumError } = await supabase
    .from('albums')
    .select('*')
    .eq('id', albumId)
    .single();

  if (albumError) throw albumError;

  const { data: photoRows, error: photosError } = await supabase
    .from('album_photos')
    .select('photo_id')
    .eq('album_id', albumId)
    .order('added_at', { ascending: true });

  if (photosError) throw photosError;

  const photos = (photoRows || []).map((row: any) => row.photo_id);

  logger.info('AlbumService.getAlbum: Retrieved album', { albumId });

  return {
    ...mapAlbumRow(album),
    photos,
  };
}

/**
 * Get all custom albums for a user, ordered by created_at DESC.
 * Includes photo count per album via Supabase count aggregation.
 */
export async function getUserAlbums(userId: string): Promise<Album[]> {
  logger.debug('AlbumService.getUserAlbums: Starting', { userId });

  const { data, error } = await supabase
    .from('albums')
    .select('*, album_photos(count)')
    .eq('user_id', userId)
    .eq('type', 'custom')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const albums = (data || []).map(mapAlbumRow);

  logger.info('AlbumService.getUserAlbums: Retrieved albums', {
    userId,
    count: albums.length,
  });

  return albums;
}

/**
 * Update album fields (title, coverPhotoId).
 */
export async function updateAlbum(
  albumId: string,
  updates: { title?: string; coverPhotoId?: string }
): Promise<void> {
  logger.debug('AlbumService.updateAlbum: Starting', { albumId, updates });

  const mapped: Record<string, any> = {};

  if (updates.title !== undefined) {
    const trimmed = updates.title.trim();
    if (trimmed.length === 0) {
      throw new Error('Album name is required');
    }
    if (trimmed.length > MAX_TITLE_LENGTH) {
      throw new Error(
        `Album name must be ${MAX_TITLE_LENGTH} characters or less`
      );
    }
    mapped.title = trimmed;
  }

  if (updates.coverPhotoId !== undefined) {
    mapped.cover_photo_id = updates.coverPhotoId;
  }

  const { error } = await supabase
    .from('albums')
    .update(mapped)
    .eq('id', albumId);

  if (error) throw error;

  logger.info('AlbumService.updateAlbum: Album updated successfully', {
    albumId,
  });
}

/**
 * Delete album. CASCADE removes album_photos entries.
 */
export async function deleteAlbum(albumId: string): Promise<void> {
  logger.debug('AlbumService.deleteAlbum: Starting', { albumId });

  const { error } = await supabase
    .from('albums')
    .delete()
    .eq('id', albumId);

  if (error) throw error;

  logger.info('AlbumService.deleteAlbum: Album deleted successfully', {
    albumId,
  });
}

/**
 * Add photos to an existing album via junction table.
 */
export async function addPhotosToAlbum(
  albumId: string,
  photoIds: string[]
): Promise<void> {
  logger.debug('AlbumService.addPhotosToAlbum: Starting', {
    albumId,
    photoCount: photoIds?.length,
  });

  const { error } = await supabase
    .from('album_photos')
    .insert(
      photoIds.map((photoId) => ({
        album_id: albumId,
        photo_id: photoId,
      }))
    );

  if (error) throw error;

  logger.info('AlbumService.addPhotosToAlbum: Photos added successfully', {
    albumId,
    addedCount: photoIds.length,
  });
}

/**
 * Remove a single photo from an album via junction table.
 */
export async function removePhotoFromAlbum(
  albumId: string,
  photoId: string
): Promise<void> {
  logger.debug('AlbumService.removePhotoFromAlbum: Starting', {
    albumId,
    photoId,
  });

  const { error } = await supabase
    .from('album_photos')
    .delete()
    .eq('album_id', albumId)
    .eq('photo_id', photoId);

  if (error) throw error;

  logger.info('AlbumService.removePhotoFromAlbum: Photo removed successfully', {
    albumId,
    photoId,
  });
}

/**
 * Set album cover photo.
 */
export async function setCoverPhoto(
  albumId: string,
  photoId: string
): Promise<void> {
  logger.debug('AlbumService.setCoverPhoto: Starting', { albumId, photoId });

  const { error } = await supabase
    .from('albums')
    .update({ cover_photo_id: photoId })
    .eq('id', albumId);

  if (error) throw error;

  logger.info('AlbumService.setCoverPhoto: Cover photo set successfully', {
    albumId,
    photoId,
  });
}

// =============================================================================
// Monthly Albums (RPC)
// =============================================================================

/**
 * Get monthly photo groups via server-side RPC.
 * The database function groups revealed photos by YYYY-MM.
 */
export async function getMonthlyPhotos(
  userId: string
): Promise<MonthlyAlbumGroup[]> {
  logger.debug('AlbumService.getMonthlyPhotos: Starting', { userId });

  const { data, error } = await supabase.rpc('get_monthly_photos', {
    target_user_id: userId,
  });

  if (error) throw error;

  const groups: MonthlyAlbumGroup[] = (data || []).map((row: any) => ({
    monthKey: row.month_key,
    photoCount: row.photo_count,
    photos: (row.photos || []).map((photo: any) => ({
      id: photo.id,
      imageUrl: photo.image_url,
      createdAt: photo.created_at,
      photoState: photo.photo_state,
    })),
  }));

  logger.info('AlbumService.getMonthlyPhotos: Retrieved monthly photos', {
    userId,
    monthCount: groups.length,
  });

  return groups;
}
