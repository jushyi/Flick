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
import { uploadPhoto, deletePhoto } from './storageService';
import { ensureDarkroomInitialized } from './darkroomService';
import logger from '../../utils/logger';

// Initialize Firestore once at module level
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
    logger.debug('PhotoService.createPhoto: Uploading to Storage', { photoId });
    const uploadResult = await uploadPhoto(photoId, photoUri);

    if (!uploadResult.success) {
      logger.warn('PhotoService.createPhoto: Upload failed, rolling back', {
        photoId,
        error: uploadResult.error
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
      size: uploadResult.size
    });

    // Ensure darkroom has valid timing for this new photo
    logger.info('PhotoService.createPhoto: Calling ensureDarkroomInitialized', { userId, photoId });
    const darkroomResult = await ensureDarkroomInitialized(userId);
    logger.info('PhotoService.createPhoto: ensureDarkroomInitialized result', {
      userId,
      photoId,
      darkroomResult
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
 * Get user's photos
 * @param {string} userId - User ID
 * @returns {Promise} - Array of photo documents
 */
export const getUserPhotos = async (userId) => {
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
      count: photos.length
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
export const getDevelopingPhotoCount = async (userId) => {
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
      count
    });

    return count;
  } catch (error) {
    logger.error('PhotoService.getDevelopingPhotoCount: Failed', {
      userId,
      error: error.message
    });
    return 0;
  }
};

/**
 * Get darkroom photo counts (developing + revealed)
 * @param {string} userId - User ID
 * @returns {Promise<object>} - { totalCount, developingCount, revealedCount }
 */
export const getDarkroomCounts = async (userId) => {
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
      error: error.message
    });
    return { totalCount: 0, developingCount: 0, revealedCount: 0 };
  }
};

/**
 * Get user's developing photos (both developing and revealed status)
 * @param {string} userId - User ID
 * @returns {Promise} - Array of developing photo documents
 */
export const getDevelopingPhotos = async (userId) => {
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
      revealedCount: revealedPhotos.length
    });

    // Combine and sort by capturedAt in JavaScript (client-side sorting)
    const allPhotos = [...developingPhotos, ...revealedPhotos].sort((a, b) => {
      return a.capturedAt?.seconds - b.capturedAt?.seconds;
    });

    logger.info('PhotoService.getDevelopingPhotos: Retrieved photos', {
      userId,
      totalCount: allPhotos.length
    });

    return { success: true, photos: allPhotos };
  } catch (error) {
    logger.error('PhotoService.getDevelopingPhotos: Failed', {
      userId,
      error: error.message
    });
    return { success: false, error: error.message };
  }
};

/**
 * Reveal ALL developing photos at once (called when darkroom is ready)
 * @param {string} userId - User ID
 * @returns {Promise}
 */
export const revealPhotos = async (userId) => {
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
      // Delete photo from Storage
      await deletePhoto(photoId);
      // Delete photo document
      await deleteDoc(photoRef);
      return { success: true };
    }

    // Update photo state
    await updateDoc(photoRef, {
      status: 'triaged',
      photoState: action, // 'journal' or 'archive'
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
 * Batch triage multiple photos at once
 * Used by darkroom when user taps Done to save all decisions
 * @param {Array} decisions - Array of { photoId, action } objects
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const batchTriagePhotos = async (decisions) => {
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
