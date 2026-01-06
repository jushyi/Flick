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
      revealAt: calculateRevealTime(),
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
      revealAt: calculateRevealTime(),
    };
  } catch (error) {
    console.error('Error creating photo:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Calculate random reveal time (1-3 hours from now)
 * @returns {Timestamp} - Reveal timestamp
 */
const calculateRevealTime = () => {
  const now = new Date();
  const randomHours = 1 + Math.random() * 2; // Random between 1-3 hours
  const revealTime = new Date(now.getTime() + randomHours * 60 * 60 * 1000);
  return Timestamp.fromDate(revealTime);
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
 * Get user's developing photos
 * @param {string} userId - User ID
 * @returns {Promise} - Array of developing photo documents
 */
export const getDevelopingPhotos = async (userId) => {
  try {
    const photosQuery = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('status', '==', 'developing'),
      orderBy('revealAt', 'asc')
    );

    const snapshot = await getDocs(photosQuery);
    const photos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { success: true, photos };
  } catch (error) {
    console.error('Error getting developing photos:', error);
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