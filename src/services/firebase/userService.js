/**
 * User Service
 *
 * Manages user profile data and daily photo limits. Tracks photo counts
 * per day with automatic reset at midnight.
 *
 * Key functions:
 * - getDailyPhotoCount: Get user's daily photo count
 * - incrementDailyPhotoCount: Increment daily count after capture
 * - checkDailyLimit: Check if user can take more photos (36/day limit)
 */

import { getFirestore, doc, getDoc, updateDoc } from '@react-native-firebase/firestore';
import logger from '../../utils/logger';

const db = getFirestore();

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string}
 */
const getTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get user's daily photo count
 * @param {string} userId - User ID
 * @returns {Promise} - Daily photo count
 */
export const getDailyPhotoCount = async userId => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userRef);

    if (!userDocSnap.exists()) {
      return { success: false, error: 'User not found' };
    }

    const userData = userDocSnap.data();
    const today = getTodayDate();

    // Check if it's a new day, reset count if so
    if (userData.lastPhotoDate !== today) {
      await updateDoc(userRef, {
        dailyPhotoCount: 0,
        lastPhotoDate: today,
      });
      return { success: true, count: 0 };
    }

    return { success: true, count: userData.dailyPhotoCount || 0 };
  } catch (error) {
    logger.error('Error getting daily photo count', error);
    return { success: false, error: error.message };
  }
};

/**
 * Increment user's daily photo count
 * @param {string} userId - User ID
 * @returns {Promise}
 */
export const incrementDailyPhotoCount = async userId => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userRef);

    if (!userDocSnap.exists()) {
      return { success: false, error: 'User not found' };
    }

    const userData = userDocSnap.data();
    const today = getTodayDate();

    let newCount;
    if (userData.lastPhotoDate !== today) {
      // New day, reset to 1
      newCount = 1;
    } else {
      // Same day, increment
      newCount = (userData.dailyPhotoCount || 0) + 1;
    }

    await updateDoc(userRef, {
      dailyPhotoCount: newCount,
      lastPhotoDate: today,
    });

    return { success: true, count: newCount };
  } catch (error) {
    logger.error('Error incrementing daily photo count', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if user can take more photos today
 * @param {string} userId - User ID
 * @returns {Promise} - { canTakePhoto, remainingShots }
 */
export const checkDailyLimit = async userId => {
  try {
    const result = await getDailyPhotoCount(userId);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const remainingShots = Math.max(0, 36 - result.count);
    const canTakePhoto = result.count < 36;

    return {
      success: true,
      canTakePhoto,
      currentCount: result.count,
      remainingShots,
    };
  } catch (error) {
    logger.error('Error checking daily limit', error);
    return { success: false, error: error.message };
  }
};
