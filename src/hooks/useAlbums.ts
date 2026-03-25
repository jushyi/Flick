/**
 * useAlbums Hooks
 *
 * TanStack Query hooks for album CRUD operations.
 * Includes optimistic updates for add/remove photo mutations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import * as albumService from '@/services/supabase/albumService';
import type { Album } from '@/services/supabase/albumService';

import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';

import logger from '@/utils/logger';

/**
 * Fetch all custom albums for a user.
 */
export function useUserAlbums(userId: string) {
  return useQuery({
    queryKey: queryKeys.albums.list(userId),
    queryFn: () => albumService.getUserAlbums(userId),
    enabled: !!userId,
  });
}

/**
 * Fetch a single album with its photo IDs.
 */
export function useAlbum(albumId: string) {
  return useQuery({
    queryKey: queryKeys.albums.detail(albumId),
    queryFn: () => albumService.getAlbum(albumId),
    enabled: !!albumId,
  });
}

/**
 * Create a new album. Invalidates album list on success.
 */
export function useCreateAlbum() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      title,
      photoIds,
    }: {
      userId: string;
      title: string;
      photoIds: string[];
    }) => albumService.createAlbum(userId, title, photoIds),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.albums.list(data.userId) });
    },
    onError: (error) => {
      logger.error('useCreateAlbum failed', {
        error: (error as Error).message,
      });
    },
  });
}

/**
 * Update album fields with optimistic update.
 * Immediately updates title/coverPhotoId in cache.
 */
export function useUpdateAlbum() {
  return useOptimisticMutation({
    mutationFn: ({
      albumId,
      updates,
    }: {
      albumId: string;
      updates: { title?: string; coverPhotoId?: string };
    }) => albumService.updateAlbum(albumId, updates),
    queryKey: (vars: { albumId: string }) => queryKeys.albums.detail(vars.albumId),
    updater: (old: any, vars: { updates: { title?: string; coverPhotoId?: string } }) => {
      if (!old) return old;
      return { ...old, ...vars.updates };
    },
    errorMessage: 'Failed to update album',
  });
}

/**
 * Delete album. Invalidates album list on success.
 */
export function useDeleteAlbum() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      albumId,
      userId,
    }: {
      albumId: string;
      userId: string;
    }) => albumService.deleteAlbum(albumId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: queryKeys.albums.list(variables.userId),
      });
    },
  });
}

/**
 * Add photos to album with optimistic update.
 * Immediately appends photo IDs to cached album detail.
 */
export function useAddPhotosToAlbum() {
  return useOptimisticMutation({
    mutationFn: ({
      albumId,
      photoIds,
    }: {
      albumId: string;
      photoIds: string[];
    }) => albumService.addPhotosToAlbum(albumId, photoIds),
    queryKey: (vars: { albumId: string }) => queryKeys.albums.detail(vars.albumId),
    updater: (old: any, vars: { photoIds: string[] }) => {
      if (!old) return old;
      return { ...old, photos: [...(old.photos || []), ...vars.photoIds] };
    },
    errorMessage: 'Failed to update album',
  });
}

/**
 * Remove photo from album with optimistic update.
 * Immediately removes photo ID from cached album detail.
 */
export function useRemovePhotoFromAlbum() {
  return useOptimisticMutation({
    mutationFn: ({
      albumId,
      photoId,
    }: {
      albumId: string;
      photoId: string;
    }) => albumService.removePhotoFromAlbum(albumId, photoId),
    queryKey: (vars: { albumId: string }) => queryKeys.albums.detail(vars.albumId),
    updater: (old: any, vars: { photoId: string }) => {
      if (!old) return old;
      return {
        ...old,
        photos: (old.photos || []).filter((id: string) => id !== vars.photoId),
      };
    },
    errorMessage: 'Failed to update album',
  });
}

/**
 * Set album cover photo. Invalidates album detail on settle.
 */
export function useSetCoverPhoto() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      albumId,
      photoId,
    }: {
      albumId: string;
      photoId: string;
    }) => albumService.setCoverPhoto(albumId, photoId),
    onSettled: (_data, _error, variables) => {
      qc.invalidateQueries({
        queryKey: queryKeys.albums.detail(variables.albumId),
      });
    },
  });
}
