/**
 * Album Service
 *
 * Manages album CRUD operations for user-created photo albums.
 * Albums contain photos organized by the user with a cover photo.
 *
 * Key functions:
 * - createAlbum: Create new album with name and initial photos
 * - getAlbum: Get single album by ID
 * - getUserAlbums: Get all albums for a user
 * - updateAlbum: Update album fields (name, coverPhotoId)
 * - deleteAlbum: Delete album (photos remain in app)
 * - addPhotosToAlbum: Add photos to existing album
 * - removePhotoFromAlbum: Remove single photo from album
 * - setCoverPhoto: Set album cover photo
 */

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import logger from '../../utils/logger';
import { sanitizeInput } from '../../utils/validation';

const db = getFirestore();

const MAX_NAME_LENGTH = 24;

/**
 * Create a new album
 * @param {string} userId - User ID who owns the album
 * @param {string} name - Album name (max 24 chars, required)
 * @param {string[]} photoIds - Initial photo IDs (at least 1 required)
 * @returns {Promise<{success: boolean, album?: object, error?: string}>}
 */
export const createAlbum = async (userId, name, photoIds) => {
  logger.debug('AlbumService.createAlbum: Starting', {
    userId,
    name,
    photoCount: photoIds?.length,
  });

  try {
    // Validate inputs
    if (!name || typeof name !== 'string') {
      return { success: false, error: 'Album name is required' };
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return { success: false, error: 'Album name cannot be empty' };
    }

    if (trimmedName.length > MAX_NAME_LENGTH) {
      return { success: false, error: `Album name must be ${MAX_NAME_LENGTH} characters or less` };
    }

    // Sanitize album name (strip HTML/script injection)
    const sanitizedName = sanitizeInput(trimmedName);

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return { success: false, error: 'At least one photo is required' };
    }

    // Create album document
    const albumsCollection = collection(db, 'albums');
    const albumRef = await addDoc(albumsCollection, {
      userId,
      name: sanitizedName,
      coverPhotoId: photoIds[0], // First photo becomes cover
      photoIds,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const album = {
      id: albumRef.id,
      userId,
      name: sanitizedName,
      coverPhotoId: photoIds[0],
      photoIds,
    };

    logger.info('AlbumService.createAlbum: Album created successfully', {
      albumId: albumRef.id,
      userId,
      photoCount: photoIds.length,
    });

    return { success: true, album };
  } catch (error) {
    logger.error('AlbumService.createAlbum: Failed', { userId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Get single album by ID
 * @param {string} albumId - Album document ID
 * @returns {Promise<{success: boolean, album?: object, error?: string}>}
 */
export const getAlbum = async albumId => {
  logger.debug('AlbumService.getAlbum: Starting', { albumId });

  try {
    const albumRef = doc(db, 'albums', albumId);
    const albumDoc = await getDoc(albumRef);

    if (!albumDoc.exists()) {
      return { success: false, error: 'Album not found' };
    }

    const album = {
      id: albumDoc.id,
      ...albumDoc.data(),
    };

    logger.info('AlbumService.getAlbum: Retrieved album', { albumId });

    return { success: true, album };
  } catch (error) {
    logger.error('AlbumService.getAlbum: Failed', { albumId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Get all albums for a user, ordered by updatedAt desc
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, albums?: object[], error?: string}>}
 */
export const getUserAlbums = async userId => {
  logger.debug('AlbumService.getUserAlbums: Starting', { userId });

  try {
    const albumsQuery = query(
      collection(db, 'albums'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    const snapshot = await getDocs(albumsQuery);

    const albums = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    logger.info('AlbumService.getUserAlbums: Retrieved albums', {
      userId,
      count: albums.length,
    });

    return { success: true, albums };
  } catch (error) {
    logger.error('AlbumService.getUserAlbums: Failed', { userId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Update album fields (name, coverPhotoId)
 * @param {string} albumId - Album document ID
 * @param {object} updates - Fields to update { name?, coverPhotoId? }
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updateAlbum = async (albumId, updates) => {
  logger.debug('AlbumService.updateAlbum: Starting', { albumId, updates });

  try {
    const albumRef = doc(db, 'albums', albumId);
    const albumDoc = await getDoc(albumRef);

    if (!albumDoc.exists()) {
      return { success: false, error: 'Album not found' };
    }

    const validUpdates = {};

    // Validate name if provided
    if (updates.name !== undefined) {
      if (typeof updates.name !== 'string') {
        return { success: false, error: 'Album name must be a string' };
      }

      const trimmedName = updates.name.trim();
      if (trimmedName.length === 0) {
        return { success: false, error: 'Album name cannot be empty' };
      }

      if (trimmedName.length > MAX_NAME_LENGTH) {
        return {
          success: false,
          error: `Album name must be ${MAX_NAME_LENGTH} characters or less`,
        };
      }

      // Sanitize album name (strip HTML/script injection)
      validUpdates.name = sanitizeInput(trimmedName);
    }

    // Validate coverPhotoId if provided
    if (updates.coverPhotoId !== undefined) {
      const albumData = albumDoc.data();
      if (!albumData.photoIds.includes(updates.coverPhotoId)) {
        return { success: false, error: 'Cover photo must be a photo in the album' };
      }
      validUpdates.coverPhotoId = updates.coverPhotoId;
    }

    if (Object.keys(validUpdates).length === 0) {
      return { success: false, error: 'No valid updates provided' };
    }

    // Add updatedAt timestamp
    validUpdates.updatedAt = serverTimestamp();

    await updateDoc(albumRef, validUpdates);

    logger.info('AlbumService.updateAlbum: Album updated successfully', { albumId });

    return { success: true };
  } catch (error) {
    logger.error('AlbumService.updateAlbum: Failed', { albumId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Delete album (photos remain in app)
 * @param {string} albumId - Album document ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteAlbum = async albumId => {
  logger.debug('AlbumService.deleteAlbum: Starting', { albumId });

  try {
    const albumRef = doc(db, 'albums', albumId);
    const albumDoc = await getDoc(albumRef);

    if (!albumDoc.exists()) {
      return { success: false, error: 'Album not found' };
    }

    await deleteDoc(albumRef);

    logger.info('AlbumService.deleteAlbum: Album deleted successfully', { albumId });

    return { success: true };
  } catch (error) {
    logger.error('AlbumService.deleteAlbum: Failed', { albumId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Add photos to existing album
 * @param {string} albumId - Album document ID
 * @param {string[]} photoIds - Photo IDs to add
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const addPhotosToAlbum = async (albumId, photoIds) => {
  logger.debug('AlbumService.addPhotosToAlbum: Starting', {
    albumId,
    photoCount: photoIds?.length,
  });

  try {
    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return { success: false, error: 'At least one photo ID is required' };
    }

    const albumRef = doc(db, 'albums', albumId);
    const albumDoc = await getDoc(albumRef);

    if (!albumDoc.exists()) {
      return { success: false, error: 'Album not found' };
    }

    const albumData = albumDoc.data();
    const existingPhotoIds = albumData.photoIds || [];

    // Filter out photos already in album
    const newPhotoIds = photoIds.filter(id => !existingPhotoIds.includes(id));

    if (newPhotoIds.length === 0) {
      return { success: false, error: 'All photos are already in the album' };
    }

    // Add new photos to the beginning (newest first)
    const updatedPhotoIds = [...newPhotoIds, ...existingPhotoIds];

    await updateDoc(albumRef, {
      photoIds: updatedPhotoIds,
      updatedAt: serverTimestamp(),
    });

    logger.info('AlbumService.addPhotosToAlbum: Photos added successfully', {
      albumId,
      addedCount: newPhotoIds.length,
    });

    return { success: true };
  } catch (error) {
    logger.error('AlbumService.addPhotosToAlbum: Failed', { albumId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Remove single photo from album
 * @param {string} albumId - Album document ID
 * @param {string} photoId - Photo ID to remove
 * @returns {Promise<{success: boolean, warning?: string, error?: string}>}
 */
export const removePhotoFromAlbum = async (albumId, photoId) => {
  logger.debug('AlbumService.removePhotoFromAlbum: Starting', { albumId, photoId });

  try {
    const albumRef = doc(db, 'albums', albumId);
    const albumDoc = await getDoc(albumRef);

    if (!albumDoc.exists()) {
      return { success: false, error: 'Album not found' };
    }

    const albumData = albumDoc.data();
    const existingPhotoIds = albumData.photoIds || [];

    if (!existingPhotoIds.includes(photoId)) {
      return { success: false, error: 'Photo not in album' };
    }

    // Check if this is the last photo
    if (existingPhotoIds.length === 1) {
      return {
        success: false,
        warning: 'Cannot remove the last photo. Delete the album instead.',
        error: 'Album must have at least one photo',
      };
    }

    // Remove the photo
    const updatedPhotoIds = existingPhotoIds.filter(id => id !== photoId);

    const updates = {
      photoIds: updatedPhotoIds,
      updatedAt: serverTimestamp(),
    };

    // If removing cover photo, set new cover to first remaining photo
    if (albumData.coverPhotoId === photoId) {
      updates.coverPhotoId = updatedPhotoIds[0];
      logger.debug('AlbumService.removePhotoFromAlbum: Updating cover photo', {
        albumId,
        newCover: updatedPhotoIds[0],
      });
    }

    await updateDoc(albumRef, updates);

    logger.info('AlbumService.removePhotoFromAlbum: Photo removed successfully', {
      albumId,
      photoId,
    });

    return { success: true };
  } catch (error) {
    logger.error('AlbumService.removePhotoFromAlbum: Failed', { albumId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Set album cover photo (must be photo in album)
 * @param {string} albumId - Album document ID
 * @param {string} photoId - Photo ID to set as cover
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const setCoverPhoto = async (albumId, photoId) => {
  logger.debug('AlbumService.setCoverPhoto: Starting', { albumId, photoId });

  try {
    const albumRef = doc(db, 'albums', albumId);
    const albumDoc = await getDoc(albumRef);

    if (!albumDoc.exists()) {
      return { success: false, error: 'Album not found' };
    }

    const albumData = albumDoc.data();

    if (!albumData.photoIds.includes(photoId)) {
      return { success: false, error: 'Photo must be in the album to set as cover' };
    }

    await updateDoc(albumRef, {
      coverPhotoId: photoId,
      updatedAt: serverTimestamp(),
    });

    logger.info('AlbumService.setCoverPhoto: Cover photo set successfully', { albumId, photoId });

    return { success: true };
  } catch (error) {
    logger.error('AlbumService.setCoverPhoto: Failed', { albumId, error: error.message });
    return { success: false, error: error.message };
  }
};
