/**
 * Viewed Stories Service
 *
 * Manages viewed stories state in Firestore for per-user persistence.
 * Data structure: users/{userId}/viewedPhotos/{photoId}
 *
 * Benefits:
 * - Data persists per user account
 * - Works across devices
 * - Survives app reinstall
 * - Account switching loads correct data
 */
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from '@react-native-firebase/firestore';
import logger from '../../utils/logger';
import { withTrace } from './performanceService';

const db = getFirestore();
const EXPIRY_HOURS = 168; // 7 days — matches STORIES_VISIBILITY_DAYS in feedService

/**
 * Get the viewed photos collection reference for a user
 * @param {string} userId - User's ID
 * @returns {CollectionReference} Firestore collection reference
 */
const getViewedPhotosCollection = userId => {
  return collection(db, 'users', userId, 'viewedPhotos');
};

/**
 * Load all viewed photo IDs for a user (filtered by 24-hour expiry)
 * @param {string} userId - User's ID
 * @returns {Promise<{success: boolean, photoIds?: Set<string>, error?: string}>}
 */
export const loadViewedPhotos = async userId => {
  if (!userId) {
    logger.warn('viewedStoriesService.loadViewedPhotos: No userId provided');
    return { success: false, error: 'No userId provided' };
  }

  try {
    logger.debug('viewedStoriesService.loadViewedPhotos: Loading viewed photos', { userId });

    const viewedCollection = getViewedPhotosCollection(userId);
    const expiryTime = Timestamp.fromDate(new Date(Date.now() - EXPIRY_HOURS * 60 * 60 * 1000));

    const q = query(viewedCollection, where('viewedAt', '>=', expiryTime));
    const snapshot = await getDocs(q);

    const photoIds = new Set();
    snapshot.forEach(doc => {
      photoIds.add(doc.id);
    });

    logger.info('viewedStoriesService.loadViewedPhotos: Loaded viewed photos', {
      userId,
      count: photoIds.size,
    });

    return { success: true, photoIds };
  } catch (error) {
    logger.error('viewedStoriesService.loadViewedPhotos: Failed', {
      userId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Mark photos as viewed in Firestore
 * Uses batch writes for efficiency
 * @param {string} userId - User's ID
 * @param {Array<string>} photoIds - Array of photo IDs to mark as viewed
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const markPhotosAsViewedInFirestore = async (userId, photoIds) => {
  if (!userId) {
    logger.warn('viewedStoriesService.markPhotosAsViewed: No userId provided');
    return { success: false, error: 'No userId provided' };
  }

  if (!photoIds || photoIds.length === 0) {
    logger.debug('viewedStoriesService.markPhotosAsViewed: No photoIds provided');
    return { success: true }; // No-op is success
  }

  return withTrace('stories/mark_viewed', async () => {
    try {
      logger.debug('viewedStoriesService.markPhotosAsViewed: Marking photos as viewed', {
        userId,
        count: photoIds.length,
      });

      const viewedCollection = getViewedPhotosCollection(userId);
      const batch = writeBatch(db);

      photoIds.forEach(photoId => {
        const photoRef = doc(viewedCollection, photoId);
        batch.set(photoRef, {
          viewedAt: serverTimestamp(),
        });
      });

      await batch.commit();

      logger.info('viewedStoriesService.markPhotosAsViewed: Photos marked as viewed', {
        userId,
        count: photoIds.length,
      });

      return { success: true };
    } catch (error) {
      logger.error('viewedStoriesService.markPhotosAsViewed: Failed', {
        userId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  });
};
