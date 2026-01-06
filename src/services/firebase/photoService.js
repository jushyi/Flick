import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { uploadPhoto, deletePhoto } from './storageService';

/**
 * Create a new photo document in Firestore
 * @param {string} userId - User ID who took the photo
 * @param {string} photoUri - Local photo URI
 * @returns {Promise} - Photo document data
 */
export const createPhoto = async (userId, photoUri) => {
  try {
    // Create photo document first to get ID
    const photoRef = await addDoc(collection(db, 'photos'), {
      userId,
      imageURL: '', // Placeholder, will be updated after upload
      capturedAt: Timestamp.now(),
      status: 'developing',
      photoState: null,
      visibility: 'friends-only',
      month: getCurrentMonth(),
      reactions: {},
      reactionCount: 0,
    });

    const photoId = photoRef.id;

    // Upload photo to Firebase Storage
    const uploadResult = await uploadPhoto(photoId, photoUri);

    if (!uploadResult.success) {
      // If upload fails, delete the document
      await deleteDoc(photoRef);
      return { success: false, error: uploadResult.error };
    }

    // Update document with imageURL
    await updateDoc(photoRef, {
      imageURL: uploadResult.url,
    });

    return {
      success: true,
      photoId,
    };
  } catch (error) {
    console.error('Error creating photo:', error);
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

    return { success: true, photos };
  } catch (error) {
    console.error('Error getting user photos:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get count of developing photos for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Count of developing photos
 */
export const getDevelopingPhotoCount = async (userId) => {
  try {
    const developingQuery = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('status', '==', 'developing')
    );

    const snapshot = await getDocs(developingQuery);
    return snapshot.size;
  } catch (error) {
    console.error('Error getting developing photo count:', error);
    return 0;
  }
};

/**
 * Get user's developing photos (both developing and revealed status)
 * @param {string} userId - User ID
 * @returns {Promise} - Array of developing photo documents
 */
export const getDevelopingPhotos = async (userId) => {
  try {
    // Get both developing and revealed photos
    // Note: Removed orderBy to avoid composite index requirement
    const developingQuery = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('status', '==', 'developing')
    );

    const revealedQuery = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('status', '==', 'revealed')
    );

    const [developingSnapshot, revealedSnapshot] = await Promise.all([
      getDocs(developingQuery),
      getDocs(revealedQuery),
    ]);

    const developingPhotos = developingSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    const revealedPhotos = revealedSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Combine and sort by capturedAt in JavaScript (client-side sorting)
    const allPhotos = [...developingPhotos, ...revealedPhotos].sort((a, b) => {
      return a.capturedAt?.seconds - b.capturedAt?.seconds;
    });

    return { success: true, photos: allPhotos };
  } catch (error) {
    console.error('Error getting developing photos:', error);
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
    const photosQuery = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('status', '==', 'developing')
    );

    const snapshot = await getDocs(photosQuery);
    const updates = [];

    // Reveal ALL developing photos
    snapshot.docs.forEach(doc => {
      updates.push(
        updateDoc(doc.ref, {
          status: 'revealed',
          revealedAt: Timestamp.now(),
        })
      );
    });

    await Promise.all(updates);

    return { success: true, count: updates.length };
  } catch (error) {
    console.error('Error revealing photos:', error);
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
      photoState: action, // 'journaled' or 'archived'
    });

    return { success: true };
  } catch (error) {
    console.error('Error triaging photo:', error);
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
    console.error('Error adding reaction:', error);
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
    console.error('Error removing reaction:', error);
    return { success: false, error: error.message };
  }
};