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
  FieldValue,
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
    const developingQuery = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('status', '==', 'developing')
    );
    const snapshot = await getDocs(developingQuery);

    const updates = [];

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
      // Soft delete: Set photoState to 'deleted' with 30-day grace period
      // Photo will be permanently deleted by Cloud Function after grace period
      const scheduledForPermanentDeletionAt = Timestamp.fromDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );
      await updateDoc(photoRef, {
        status: 'triaged',
        photoState: 'deleted',
        scheduledForPermanentDeletionAt,
        deletionScheduledAt: serverTimestamp(),
      });
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
 * @param {Object} [photoTags] - Optional mapping of photoId to taggedUserIds array
 * @returns {Promise<{success: boolean, journaledCount?: number, error?: string}>}
 */
export const batchTriagePhotos = async (decisions, photoTags = {}) => {
  try {
    logger.debug('PhotoService.batchTriagePhotos: Starting batch', {
      count: decisions.length,
      taggedPhotoCount: Object.keys(photoTags).length,
    });

    // Count how many photos are being journaled (posted to story)
    const journaledCount = decisions.filter(d => d.action === 'journal').length;

    for (const { photoId, action } of decisions) {
      // Write taggedUserIds before triaging if photo has tags
      const tags = photoTags[photoId];
      if (tags && tags.length > 0) {
        const photoRef = doc(db, 'photos', photoId);
        await updateDoc(photoRef, {
          taggedUserIds: tags,
          taggedAt: serverTimestamp(),
        });
        logger.debug('PhotoService.batchTriagePhotos: Wrote tags for photo', {
          photoId,
          tagCount: tags.length,
        });
      }

      await triagePhoto(photoId, action);
    }

    logger.info('PhotoService.batchTriagePhotos: Batch complete', {
      count: decisions.length,
      journaledCount,
    });
    return { success: true, journaledCount };
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

/**
 * Archive a photo (hide from active views while preserving in albums)
 * Updates photoState to 'archive' and resets triagedAt timestamp
 *
 * @param {string} photoId - Photo document ID
 * @param {string} userId - User ID (for ownership verification)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const archivePhoto = async (photoId, userId) => {
  logger.info('PhotoService.archivePhoto: Starting', { photoId, userId });

  try {
    // Get photo document and verify ownership
    const photoRef = doc(db, 'photos', photoId);
    const photoDoc = await getDoc(photoRef);

    if (!photoDoc.exists()) {
      logger.warn('PhotoService.archivePhoto: Photo not found', { photoId });
      return { success: false, error: 'Photo not found' };
    }

    const photoData = photoDoc.data();

    if (photoData.userId !== userId) {
      logger.warn('PhotoService.archivePhoto: Unauthorized - user does not own photo', {
        photoId,
        photoOwnerId: photoData.userId,
        requestingUserId: userId,
      });
      return { success: false, error: 'Unauthorized: You do not own this photo' };
    }

    await updateDoc(photoRef, {
      photoState: 'archive',
      triagedAt: serverTimestamp(), // Reset visibility window
    });

    logger.info('PhotoService.archivePhoto: Photo archived successfully', { photoId, userId });
    return { success: true };
  } catch (error) {
    logger.error('PhotoService.archivePhoto: Failed', {
      photoId,
      userId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Restore an archived photo back to the journal (active views)
 * Updates photoState to 'journal' and resets triagedAt timestamp
 *
 * @param {string} photoId - Photo document ID
 * @param {string} userId - User ID (for ownership verification)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const restorePhoto = async (photoId, userId) => {
  logger.info('PhotoService.restorePhoto: Starting', { photoId, userId });

  try {
    // Get photo document and verify ownership
    const photoRef = doc(db, 'photos', photoId);
    const photoDoc = await getDoc(photoRef);

    if (!photoDoc.exists()) {
      logger.warn('PhotoService.restorePhoto: Photo not found', { photoId });
      return { success: false, error: 'Photo not found' };
    }

    const photoData = photoDoc.data();

    if (photoData.userId !== userId) {
      logger.warn('PhotoService.restorePhoto: Unauthorized - user does not own photo', {
        photoId,
        photoOwnerId: photoData.userId,
        requestingUserId: userId,
      });
      return { success: false, error: 'Unauthorized: You do not own this photo' };
    }

    await updateDoc(photoRef, {
      photoState: 'journal',
      triagedAt: serverTimestamp(), // Reset visibility window for re-sharing
    });

    logger.info('PhotoService.restorePhoto: Photo restored successfully', { photoId, userId });
    return { success: true };
  } catch (error) {
    logger.error('PhotoService.restorePhoto: Failed', {
      photoId,
      userId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Soft delete a photo (move to Recently Deleted with 30-day grace period)
 * Used by PhotoDetailScreen and Album menu for non-Darkroom deletion
 *
 * @param {string} photoId - Photo document ID
 * @param {string} userId - User ID (for ownership verification)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const softDeletePhoto = async (photoId, userId) => {
  logger.info('PhotoService.softDeletePhoto: Starting', { photoId, userId });

  try {
    // Get photo document and verify ownership
    const photoRef = doc(db, 'photos', photoId);
    const photoDoc = await getDoc(photoRef);

    if (!photoDoc.exists()) {
      logger.warn('PhotoService.softDeletePhoto: Photo not found', { photoId });
      return { success: false, error: 'Photo not found' };
    }

    const photoData = photoDoc.data();

    if (photoData.userId !== userId) {
      logger.warn('PhotoService.softDeletePhoto: Unauthorized - user does not own photo', {
        photoId,
        photoOwnerId: photoData.userId,
        requestingUserId: userId,
      });
      return { success: false, error: 'Unauthorized: You do not own this photo' };
    }

    // Set soft delete fields with 30-day grace period
    const scheduledForPermanentDeletionAt = Timestamp.fromDate(
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    );

    await updateDoc(photoRef, {
      status: 'triaged',
      photoState: 'deleted',
      scheduledForPermanentDeletionAt,
      deletionScheduledAt: serverTimestamp(),
    });

    logger.info('PhotoService.softDeletePhoto: Photo soft deleted successfully', {
      photoId,
      userId,
      scheduledForPermanentDeletionAt: scheduledForPermanentDeletionAt.toDate(),
    });
    return { success: true };
  } catch (error) {
    logger.error('PhotoService.softDeletePhoto: Failed', {
      photoId,
      userId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Restore a deleted photo from Recently Deleted back to the journal
 * Clears deletion fields and resets visibility window
 *
 * @param {string} photoId - Photo document ID
 * @param {string} userId - User ID (for ownership verification)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const restoreDeletedPhoto = async (photoId, userId) => {
  logger.info('PhotoService.restoreDeletedPhoto: Starting', { photoId, userId });

  try {
    // Get photo document and verify ownership
    const photoRef = doc(db, 'photos', photoId);
    const photoDoc = await getDoc(photoRef);

    if (!photoDoc.exists()) {
      logger.warn('PhotoService.restoreDeletedPhoto: Photo not found', { photoId });
      return { success: false, error: 'Photo not found' };
    }

    const photoData = photoDoc.data();

    if (photoData.userId !== userId) {
      logger.warn('PhotoService.restoreDeletedPhoto: Unauthorized - user does not own photo', {
        photoId,
        photoOwnerId: photoData.userId,
        requestingUserId: userId,
      });
      return { success: false, error: 'Unauthorized: You do not own this photo' };
    }

    // Can only restore photos in 'deleted' state
    if (photoData.photoState !== 'deleted') {
      logger.warn('PhotoService.restoreDeletedPhoto: Photo is not in deleted state', {
        photoId,
        currentState: photoData.photoState,
      });
      return { success: false, error: 'Photo is not in deleted state' };
    }

    // Restore to journal and clear deletion fields
    await updateDoc(photoRef, {
      photoState: 'journal',
      scheduledForPermanentDeletionAt: FieldValue.delete(),
      deletionScheduledAt: FieldValue.delete(),
      triagedAt: serverTimestamp(), // Reset visibility window
    });

    logger.info('PhotoService.restoreDeletedPhoto: Photo restored successfully', {
      photoId,
      userId,
    });
    return { success: true };
  } catch (error) {
    logger.error('PhotoService.restoreDeletedPhoto: Failed', {
      photoId,
      userId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Get all deleted photos for a user (Recently Deleted)
 * Returns photos with photoState === 'deleted', ordered by deletion date
 *
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, photos?: object[], error?: string}>}
 */
export const getDeletedPhotos = async userId => {
  logger.info('PhotoService.getDeletedPhotos: Starting', { userId });

  try {
    // Query photos where userId matches AND photoState === 'deleted'
    const deletedQuery = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('photoState', '==', 'deleted'),
      orderBy('deletionScheduledAt', 'desc')
    );
    const snapshot = await getDocs(deletedQuery);

    const photos = snapshot.docs.map(photoDoc => ({
      id: photoDoc.id,
      ...photoDoc.data(),
    }));

    logger.info('PhotoService.getDeletedPhotos: Retrieved deleted photos', {
      userId,
      count: photos.length,
    });

    return { success: true, photos };
  } catch (error) {
    logger.error('PhotoService.getDeletedPhotos: Failed', {
      userId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Permanently delete a photo immediately (bypasses 30-day grace period)
 * Full cascade deletion: albums, comments, storage, document
 *
 * @param {string} photoId - Photo document ID
 * @param {string} userId - User ID (for ownership verification)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const permanentlyDeletePhoto = async (photoId, userId) => {
  logger.info('PhotoService.permanentlyDeletePhoto: Starting', { photoId, userId });

  try {
    // Get photo document and verify ownership
    const photoRef = doc(db, 'photos', photoId);
    const photoDoc = await getDoc(photoRef);

    if (!photoDoc.exists()) {
      logger.warn('PhotoService.permanentlyDeletePhoto: Photo not found', { photoId });
      return { success: false, error: 'Photo not found' };
    }

    const photoData = photoDoc.data();

    if (photoData.userId !== userId) {
      logger.warn('PhotoService.permanentlyDeletePhoto: Unauthorized - user does not own photo', {
        photoId,
        photoOwnerId: photoData.userId,
        requestingUserId: userId,
      });
      return { success: false, error: 'Unauthorized: You do not own this photo' };
    }

    // Use internal cascade delete (ownership already verified)
    return await cascadeDeletePhoto(photoId, userId);
  } catch (error) {
    logger.error('PhotoService.permanentlyDeletePhoto: Failed', {
      photoId,
      userId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Update tagged user IDs on a photo document
 * If taggedUserIds is empty, removes the fields entirely (no empty arrays in Firestore)
 *
 * @param {string} photoId - Photo document ID
 * @param {string[]} taggedUserIds - Array of user IDs to tag (empty = remove tags)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updatePhotoTags = async (photoId, taggedUserIds) => {
  logger.info('PhotoService.updatePhotoTags: Starting', {
    photoId,
    tagCount: taggedUserIds?.length,
  });

  try {
    const photoRef = doc(db, 'photos', photoId);

    if (!taggedUserIds || taggedUserIds.length === 0) {
      // Clean up: remove tag fields entirely instead of storing empty array
      await updateDoc(photoRef, {
        taggedUserIds: FieldValue.delete(),
        taggedAt: FieldValue.delete(),
      });
      logger.info('PhotoService.updatePhotoTags: Tags removed (fields deleted)', { photoId });
    } else {
      await updateDoc(photoRef, {
        taggedUserIds,
        taggedAt: serverTimestamp(),
      });
      logger.info('PhotoService.updatePhotoTags: Tags updated', {
        photoId,
        tagCount: taggedUserIds.length,
      });
    }

    return { success: true };
  } catch (error) {
    logger.error('PhotoService.updatePhotoTags: Failed', { photoId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Internal cascade delete function
 * Removes photo from albums, deletes comments, storage, and document
 * Called by permanentlyDeletePhoto (after ownership check)
 *
 * @param {string} photoId - Photo document ID
 * @param {string} userId - User ID (ownership already verified by caller)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
const cascadeDeletePhoto = async (photoId, userId) => {
  logger.debug('PhotoService.cascadeDeletePhoto: Starting cascade delete', { photoId, userId });

  try {
    const photoRef = doc(db, 'photos', photoId);

    // Step 1: Remove from all albums containing this photo
    logger.debug('PhotoService.cascadeDeletePhoto: Removing from albums', { photoId });
    const albumsResult = await getUserAlbums(userId);

    if (albumsResult.success && albumsResult.albums) {
      for (const album of albumsResult.albums) {
        if (album.photoIds && album.photoIds.includes(photoId)) {
          if (album.photoIds.length === 1) {
            // Delete the album entirely since it would be empty
            logger.debug('PhotoService.cascadeDeletePhoto: Deleting album (last photo)', {
              albumId: album.id,
              albumName: album.name,
            });
            const deleteAlbumResult = await deleteAlbum(album.id);
            if (!deleteAlbumResult.success) {
              logger.warn('PhotoService.cascadeDeletePhoto: Failed to delete album', {
                albumId: album.id,
                error: deleteAlbumResult.error,
              });
            }
          } else {
            // Remove photo from album
            logger.debug('PhotoService.cascadeDeletePhoto: Removing from album', {
              albumId: album.id,
              albumName: album.name,
            });
            const removeResult = await removePhotoFromAlbum(album.id, photoId);
            if (!removeResult.success) {
              logger.warn('PhotoService.cascadeDeletePhoto: Failed to remove from album', {
                albumId: album.id,
                error: removeResult.error,
              });
            }
          }
        }
      }
    }

    // Step 2: Delete all comments in the photo's subcollection
    logger.debug('PhotoService.cascadeDeletePhoto: Deleting comments', { photoId });
    const commentsRef = collection(db, 'photos', photoId, 'comments');
    const commentsSnapshot = await getDocs(commentsRef);

    if (!commentsSnapshot.empty) {
      logger.debug('PhotoService.cascadeDeletePhoto: Found comments to delete', {
        photoId,
        commentCount: commentsSnapshot.size,
      });

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

      logger.debug('PhotoService.cascadeDeletePhoto: Comments deleted', {
        photoId,
        deletedCount: commentsSnapshot.size,
      });
    }

    // Step 3: Delete photo from Firebase Storage
    logger.debug('PhotoService.cascadeDeletePhoto: Deleting from storage', { photoId, userId });
    const storageResult = await deletePhoto(userId, photoId);

    if (!storageResult.success) {
      logger.warn('PhotoService.cascadeDeletePhoto: Storage delete failed (continuing)', {
        photoId,
        error: storageResult.error,
      });
    }

    // Step 4: Delete photo document from Firestore
    logger.debug('PhotoService.cascadeDeletePhoto: Deleting document', { photoId });
    await deleteDoc(photoRef);

    logger.info('PhotoService.cascadeDeletePhoto: Cascade delete complete', { photoId, userId });
    return { success: true };
  } catch (error) {
    logger.error('PhotoService.cascadeDeletePhoto: Failed', {
      photoId,
      userId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};
