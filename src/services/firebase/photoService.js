/**
 * Photo Service
 *
 * Manages photo CRUD operations and lifecycle transitions. Photos flow through
 * statuses: developing -> revealed -> triaged (with photoState: journal/archive).
 *
 * Key functions:
 * - createPhoto: Create photo document and upload to Storage
 * - getUserPhotos: Get all photos for a user
 * - getDevelopingPhotos: Get developing/revealed photos for darkroom
 * - revealPhotos: Batch reveal all developing photos
 * - triagePhoto: Journal, archive, or delete a photo
 * - batchTriagePhotos: Batch triage multiple photos
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
  writeBatch,
  Timestamp,
} from '@react-native-firebase/firestore';
import { uploadPhoto, deletePhoto } from './storageService';
import { ensureDarkroomInitialized } from './darkroomService';
import { getUserAlbums, removePhotoFromAlbum, deleteAlbum } from './albumService';
import logger from '../../utils/logger';

const db = getFirestore();

/**
 * Create a new photo document in Firestore
 * @param {string} userId - User ID who took the photo
 * @param {string} photoUri - Local photo URI
 * @returns {Promise} - Photo document data
 */
export const createPhoto = async (userId, photoUri) => {
  logger.debug('PhotoService.createPhoto: Starting', { userId });

  try {
    // Create photo document first to get ID
    logger.debug('PhotoService.createPhoto: Creating Firestore document');
    const photosCollection = collection(db, 'photos');
    const photoRef = await addDoc(photosCollection, {
      userId,
      imageURL: '', // Placeholder, will be updated after upload
      capturedAt: serverTimestamp(),
      status: 'developing',
      photoState: null,
      visibility: 'friends-only',
      month: getCurrentMonth(),
      reactions: {},
      reactionCount: 0,
    });

    const photoId = photoRef.id;
    logger.debug('PhotoService.createPhoto: Document created', { photoId });

    // Upload photo to Firebase Storage
    logger.debug('PhotoService.createPhoto: Uploading to Storage', { userId, photoId });
    const uploadResult = await uploadPhoto(userId, photoId, photoUri);

    if (!uploadResult.success) {
      logger.warn('PhotoService.createPhoto: Upload failed, rolling back', {
        photoId,
        error: uploadResult.error,
      });
      // If upload fails, delete the document
      await deleteDoc(photoRef);
      return { success: false, error: uploadResult.error };
    }

    // Update document with imageURL
    logger.debug('PhotoService.createPhoto: Updating document with imageURL', { photoId });
    await updateDoc(photoRef, {
      imageURL: uploadResult.url,
    });

    logger.info('PhotoService.createPhoto: Photo created successfully', {
      photoId,
      userId,
      size: uploadResult.size,
    });

    // Ensure darkroom has valid timing for this new photo
    logger.info('PhotoService.createPhoto: Calling ensureDarkroomInitialized', { userId, photoId });
    const darkroomResult = await ensureDarkroomInitialized(userId);
    logger.info('PhotoService.createPhoto: ensureDarkroomInitialized result', {
      userId,
      photoId,
      darkroomResult,
    });

    return {
      success: true,
      photoId,
    };
  } catch (error) {
    logger.error('PhotoService.createPhoto: Failed', { userId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Get current month in YYYY-MM format
 * @returns {string} - Current month
 */
const getCurrentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * Get month in YYYY-MM format from a Firestore timestamp
 * @param {Object} timestamp - Firestore Timestamp object
 * @returns {string} - Month in YYYY-MM format
 */
const getMonthFromTimestamp = timestamp => {
  if (!timestamp) return getCurrentMonth();

  // Handle Firestore Timestamp object (has toDate method or seconds property)
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * Get user's photos
 * @param {string} userId - User ID
 * @returns {Promise} - Array of photo documents
 */
export const getUserPhotos = async userId => {
  logger.debug('PhotoService.getUserPhotos: Starting', { userId });

  try {
    const photosQuery = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      orderBy('capturedAt', 'desc')
    );
    const snapshot = await getDocs(photosQuery);

    const photos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    logger.info('PhotoService.getUserPhotos: Retrieved photos', {
      userId,
      count: photos.length,
    });

    return { success: true, photos };
  } catch (error) {
    logger.error('PhotoService.getUserPhotos: Failed', { userId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Get count of developing photos for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Count of developing photos
 */
export const getDevelopingPhotoCount = async userId => {
  logger.debug('PhotoService.getDevelopingPhotoCount: Starting', { userId });

  try {
    const developingQuery = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('status', '==', 'developing')
    );
    const snapshot = await getDocs(developingQuery);

    const count = snapshot.size;

    logger.info('PhotoService.getDevelopingPhotoCount: Retrieved count', {
      userId,
      count,
    });

    return count;
  } catch (error) {
    logger.error('PhotoService.getDevelopingPhotoCount: Failed', {
      userId,
      error: error.message,
    });
    return 0;
  }
};

/**
 * Get darkroom photo counts (developing + revealed)
 * @param {string} userId - User ID
 * @returns {Promise<object>} - { totalCount, developingCount, revealedCount }
 */
export const getDarkroomCounts = async userId => {
  logger.debug('PhotoService.getDarkroomCounts: Starting', { userId });

  try {
    // Query for developing photos
    const developingQuery = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('status', '==', 'developing')
    );
    const developingPromise = getDocs(developingQuery);

    // Query for revealed photos
    const revealedQuery = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('status', '==', 'revealed')
    );
    const revealedPromise = getDocs(revealedQuery);

    const [developingSnapshot, revealedSnapshot] = await Promise.all([
      developingPromise,
      revealedPromise,
    ]);

    const developingCount = developingSnapshot.size;
    const revealedCount = revealedSnapshot.size;
    const totalCount = developingCount + revealedCount;

    logger.info('PhotoService.getDarkroomCounts: Retrieved counts', {
      userId,
      developingCount,
      revealedCount,
      totalCount,
    });

    return { totalCount, developingCount, revealedCount };
  } catch (error) {
    logger.error('PhotoService.getDarkroomCounts: Failed', {
      userId,
      error: error.message,
    });
    return { totalCount: 0, developingCount: 0, revealedCount: 0 };
  }
};

/**
 * Get user's developing photos (both developing and revealed status)
 * @param {string} userId - User ID
 * @returns {Promise} - Array of developing photo documents
 */
export const getDevelopingPhotos = async userId => {
  logger.debug('PhotoService.getDevelopingPhotos: Starting', { userId });

  try {
    // Get both developing and revealed photos
    // Note: Removed orderBy to avoid composite index requirement
    logger.debug('PhotoService.getDevelopingPhotos: Querying developing and revealed photos');

    const developingQuery = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('status', '==', 'developing')
    );
    const developingPromise = getDocs(developingQuery);

    const revealedQuery = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('status', '==', 'revealed')
    );
    const revealedPromise = getDocs(revealedQuery);

    const [developingSnapshot, revealedSnapshot] = await Promise.all([
      developingPromise,
      revealedPromise,
    ]);

    const developingPhotos = developingSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    const revealedPhotos = revealedSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    logger.debug('PhotoService.getDevelopingPhotos: Query results', {
      developingCount: developingPhotos.length,
      revealedCount: revealedPhotos.length,
    });

    // Combine and sort by capturedAt in JavaScript (client-side sorting)
    const allPhotos = [...developingPhotos, ...revealedPhotos].sort((a, b) => {
      return a.capturedAt?.seconds - b.capturedAt?.seconds;
    });

    logger.info('PhotoService.getDevelopingPhotos: Retrieved photos', {
      userId,
      totalCount: allPhotos.length,
    });

    return { success: true, photos: allPhotos };
  } catch (error) {
    logger.error('PhotoService.getDevelopingPhotos: Failed', {
      userId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Reveal ALL developing photos at once (called when darkroom is ready)
 * @param {string} userId - User ID
 * @returns {Promise}
 */
export const revealPhotos = async userId => {
  try {
    // Get ALL developing photos for this user
    const developingQuery = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('status', '==', 'developing')
    );
    const snapshot = await getDocs(developingQuery);

    const updates = [];

    // Reveal ALL developing photos
    snapshot.docs.forEach(docSnap => {
      updates.push(
        updateDoc(docSnap.ref, {
          status: 'revealed',
          revealedAt: serverTimestamp(),
        })
      );
    });

    await Promise.all(updates);

    return { success: true, count: updates.length };
  } catch (error) {
    logger.error('Error revealing photos', error);
    return { success: false, error: error.message };
  }
};

/**
 * Triage photo after reveal (Journal, Archive, or Delete)
 * @param {string} photoId - Photo document ID
 * @param {string} action - 'journal', 'archive', or 'delete'
 * @returns {Promise}
 */
export const triagePhoto = async (photoId, action) => {
  try {
    const photoRef = doc(db, 'photos', photoId);

    if (action === 'delete') {
      // Get photo document to retrieve userId for storage path
      const photoDoc = await getDoc(photoRef);
      if (photoDoc.exists()) {
        const { userId } = photoDoc.data();
        // Delete photo from Storage (path: photos/{userId}/{photoId}.jpg)
        await deletePhoto(userId, photoId);
      }
      // Delete photo document
      await deleteDoc(photoRef);
      return { success: true };
    }

    // Get photo document to retrieve capturedAt for correct month assignment
    // ISS-010 fix: Old photos need month derived from capturedAt, not creation time
    const photoDoc = await getDoc(photoRef);
    const photoData = photoDoc.exists() ? photoDoc.data() : {};
    const correctMonth = getMonthFromTimestamp(photoData.capturedAt);

    // Update photo state with correct month and triage timestamp
    await updateDoc(photoRef, {
      status: 'triaged',
      photoState: action, // 'journal' or 'archive'
      month: correctMonth, // ISS-010: Ensure month matches capturedAt
      triagedAt: serverTimestamp(), // UAT-004: Track when photo was triaged for visibility windows
    });

    return { success: true };
  } catch (error) {
    logger.error('Error triaging photo', error);
    return { success: false, error: error.message };
  }
};

/**
 * Add reaction to photo
 * @param {string} photoId - Photo document ID
 * @param {string} userId - User ID
 * @param {string} emoji - Emoji reaction
 * @returns {Promise}
 */
export const addReaction = async (photoId, userId, emoji) => {
  try {
    const photoRef = doc(db, 'photos', photoId);
    const photoDoc = await getDoc(photoRef);

    // In modular API, exists() is a method
    if (!photoDoc.exists()) {
      return { success: false, error: 'Photo not found' };
    }

    const reactions = photoDoc.data().reactions || {};
    reactions[userId] = emoji;

    await updateDoc(photoRef, {
      reactions,
      reactionCount: Object.keys(reactions).length,
    });

    return { success: true };
  } catch (error) {
    logger.error('Error adding reaction', error);
    return { success: false, error: error.message };
  }
};

/**
 * Remove reaction from photo
 * @param {string} photoId - Photo document ID
 * @param {string} userId - User ID
 * @returns {Promise}
 */
export const removeReaction = async (photoId, userId) => {
  try {
    const photoRef = doc(db, 'photos', photoId);
    const photoDoc = await getDoc(photoRef);

    // In modular API, exists() is a method
    if (!photoDoc.exists()) {
      return { success: false, error: 'Photo not found' };
    }

    const reactions = photoDoc.data().reactions || {};
    delete reactions[userId];

    await updateDoc(photoRef, {
      reactions,
      reactionCount: Object.keys(reactions).length,
    });

    return { success: true };
  } catch (error) {
    logger.error('Error removing reaction', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get photos by their IDs
 * @param {string[]} photoIds - Array of photo document IDs
 * @returns {Promise<{success: boolean, photos?: object[], error?: string}>}
 */
export const getPhotosByIds = async photoIds => {
  logger.debug('PhotoService.getPhotosByIds: Starting', { count: photoIds?.length });

  try {
    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return { success: true, photos: [] };
    }

    // Fetch each photo document
    const photoPromises = photoIds.map(async photoId => {
      const photoRef = doc(db, 'photos', photoId);
      const photoDoc = await getDoc(photoRef);
      if (photoDoc.exists()) {
        return {
          id: photoDoc.id,
          ...photoDoc.data(),
        };
      }
      return null;
    });

    const photos = (await Promise.all(photoPromises)).filter(p => p !== null);

    logger.info('PhotoService.getPhotosByIds: Retrieved photos', {
      requested: photoIds.length,
      found: photos.length,
    });

    return { success: true, photos };
  } catch (error) {
    logger.error('PhotoService.getPhotosByIds: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Batch triage multiple photos at once
 * Used by darkroom when user taps Done to save all decisions
 * @param {Array} decisions - Array of { photoId, action } objects
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const batchTriagePhotos = async decisions => {
  try {
    logger.debug('PhotoService.batchTriagePhotos: Starting batch', { count: decisions.length });

    for (const { photoId, action } of decisions) {
      await triagePhoto(photoId, action);
    }

    logger.info('PhotoService.batchTriagePhotos: Batch complete', { count: decisions.length });
    return { success: true };
  } catch (error) {
    logger.error('PhotoService.batchTriagePhotos: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Migrate older photos that have photoState: null
 * One-time migration to fix photos triaged before photoState was added
 * Sets photoState to 'journal' and ensures triagedAt is set
 * Only migrates photos belonging to the specified user (required for security rules)
 *
 * @param {string} userId - The user ID whose photos to migrate
 * @returns {Promise<{success: boolean, migratedCount?: number, error?: string}>}
 */
export const migratePhotoStateField = async userId => {
  logger.info('PhotoService.migratePhotoStateField: Starting migration', { userId });

  if (!userId) {
    return { success: false, error: 'User ID is required' };
  }

  try {
    // Query user's triaged photos (security rules allow reading own photos)
    const q = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('status', '==', 'triaged')
    );
    const snapshot = await getDocs(q);

    logger.info('PhotoService.migratePhotoStateField: Found triaged photos', {
      totalCount: snapshot.size,
    });

    // Filter client-side for photos where photoState is null or undefined
    const photosToMigrate = snapshot.docs.filter(photoDoc => {
      const data = photoDoc.data();
      return data.photoState === null || data.photoState === undefined;
    });

    logger.info('PhotoService.migratePhotoStateField: Photos needing migration', {
      count: photosToMigrate.length,
    });

    if (photosToMigrate.length === 0) {
      return { success: true, migratedCount: 0 };
    }

    // Batch writes for efficiency (max 500 per batch)
    const BATCH_SIZE = 500;
    let migratedCount = 0;

    for (let i = 0; i < photosToMigrate.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const batchPhotos = photosToMigrate.slice(i, i + BATCH_SIZE);

      for (const photoDoc of batchPhotos) {
        const data = photoDoc.data();
        const photoRef = doc(db, 'photos', photoDoc.id);

        // Set photoState to 'journal' as default (matches existing behavior)
        // Set triagedAt to updatedAt or capturedAt if missing
        const triagedAt = data.triagedAt || data.updatedAt || data.capturedAt || Timestamp.now();

        batch.update(photoRef, {
          photoState: 'journal',
          triagedAt: triagedAt,
        });
      }

      await batch.commit();
      migratedCount += batchPhotos.length;

      logger.debug('PhotoService.migratePhotoStateField: Batch committed', {
        batchNumber: Math.floor(i / BATCH_SIZE) + 1,
        photosInBatch: batchPhotos.length,
        totalMigrated: migratedCount,
      });
    }

    logger.info('PhotoService.migratePhotoStateField: Migration complete', {
      migratedCount,
    });

    return { success: true, migratedCount };
  } catch (error) {
    logger.error('PhotoService.migratePhotoStateField: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Permanently delete a photo with full cascade cleanup
 * Removes from albums, deletes comments, deletes from storage, then deletes document
 *
 * @param {string} photoId - Photo document ID
 * @param {string} userId - User ID (for ownership verification)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deletePhotoCompletely = async (photoId, userId) => {
  logger.info('PhotoService.deletePhotoCompletely: Starting cascade delete', { photoId, userId });

  try {
    // Step 1: Get photo document and verify ownership
    const photoRef = doc(db, 'photos', photoId);
    const photoDoc = await getDoc(photoRef);

    if (!photoDoc.exists()) {
      logger.warn('PhotoService.deletePhotoCompletely: Photo not found', { photoId });
      return { success: false, error: 'Photo not found' };
    }

    const photoData = photoDoc.data();

    if (photoData.userId !== userId) {
      logger.warn('PhotoService.deletePhotoCompletely: Unauthorized - user does not own photo', {
        photoId,
        photoOwnerId: photoData.userId,
        requestingUserId: userId,
      });
      return { success: false, error: 'Unauthorized: You do not own this photo' };
    }

    logger.debug('PhotoService.deletePhotoCompletely: Ownership verified', { photoId, userId });

    // Step 2: Remove from all albums containing this photo
    logger.debug('PhotoService.deletePhotoCompletely: Removing from albums', { photoId });
    const albumsResult = await getUserAlbums(userId);

    if (albumsResult.success && albumsResult.albums) {
      for (const album of albumsResult.albums) {
        if (album.photoIds && album.photoIds.includes(photoId)) {
          // Check if this is the last photo in the album
          if (album.photoIds.length === 1) {
            // Delete the album entirely since it would be empty
            logger.debug('PhotoService.deletePhotoCompletely: Deleting album (last photo)', {
              albumId: album.id,
              albumName: album.name,
            });
            const deleteAlbumResult = await deleteAlbum(album.id);
            if (!deleteAlbumResult.success) {
              logger.warn('PhotoService.deletePhotoCompletely: Failed to delete album', {
                albumId: album.id,
                error: deleteAlbumResult.error,
              });
            }
          } else {
            // Remove photo from album
            logger.debug('PhotoService.deletePhotoCompletely: Removing from album', {
              albumId: album.id,
              albumName: album.name,
            });
            const removeResult = await removePhotoFromAlbum(album.id, photoId);
            if (!removeResult.success) {
              logger.warn('PhotoService.deletePhotoCompletely: Failed to remove from album', {
                albumId: album.id,
                error: removeResult.error,
              });
            }
          }
        }
      }
    }

    // Step 3: Delete all comments in the photo's subcollection
    logger.debug('PhotoService.deletePhotoCompletely: Deleting comments', { photoId });
    const commentsRef = collection(db, 'photos', photoId, 'comments');
    const commentsSnapshot = await getDocs(commentsRef);

    if (!commentsSnapshot.empty) {
      logger.debug('PhotoService.deletePhotoCompletely: Found comments to delete', {
        photoId,
        commentCount: commentsSnapshot.size,
      });

      // Delete each comment and its likes subcollection
      for (const commentDoc of commentsSnapshot.docs) {
        // Delete likes subcollection for this comment
        const likesRef = collection(db, 'photos', photoId, 'comments', commentDoc.id, 'likes');
        const likesSnapshot = await getDocs(likesRef);

        for (const likeDoc of likesSnapshot.docs) {
          await deleteDoc(likeDoc.ref);
        }

        // Delete the comment itself
        await deleteDoc(commentDoc.ref);
      }

      logger.debug('PhotoService.deletePhotoCompletely: Comments deleted', {
        photoId,
        deletedCount: commentsSnapshot.size,
      });
    }

    // Step 4: Delete photo from Firebase Storage
    logger.debug('PhotoService.deletePhotoCompletely: Deleting from storage', { photoId, userId });
    const storageResult = await deletePhoto(userId, photoId);

    if (!storageResult.success) {
      // Log warning but continue - storage file might not exist
      logger.warn('PhotoService.deletePhotoCompletely: Storage delete failed (continuing)', {
        photoId,
        error: storageResult.error,
      });
    }

    // Step 5: Delete photo document from Firestore
    logger.debug('PhotoService.deletePhotoCompletely: Deleting document', { photoId });
    await deleteDoc(photoRef);

    logger.info('PhotoService.deletePhotoCompletely: Cascade delete complete', { photoId, userId });
    return { success: true };
  } catch (error) {
    logger.error('PhotoService.deletePhotoCompletely: Failed', {
      photoId,
      userId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};
