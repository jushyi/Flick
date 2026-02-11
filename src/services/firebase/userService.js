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

import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  Timestamp,
} from '@react-native-firebase/firestore';
import logger from '../../utils/logger';
import { withTrace } from './performanceService';

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
 * Check if a username is available
 * @param {string} username - Username to check (will be lowercased)
 * @param {string} currentUserId - Current user's ID (to exclude from check)
 * @returns {Promise} - { success, available, error }
 */
export const checkUsernameAvailability = async (username, currentUserId = null) => {
  try {
    const normalizedUsername = username.toLowerCase().trim();

    logger.debug('UserService.checkUsernameAvailability: Checking username', {
      username: normalizedUsername,
    });

    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('username', '==', normalizedUsername),
      limit(1) // Only need existence check, not all matching docs
    );
    const querySnapshot = await getDocs(q);

    // Check if any user has this username (excluding current user)
    let available = true;
    querySnapshot.forEach(docSnap => {
      if (currentUserId && docSnap.id === currentUserId) {
        // This is the current user's own username, still available for them
        return;
      }
      available = false;
    });

    logger.info('UserService.checkUsernameAvailability: Result', {
      username: normalizedUsername,
      available,
    });

    return { success: true, available };
  } catch (error) {
    logger.error('UserService.checkUsernameAvailability: Error', error);
    return { success: false, available: false, error: error.message };
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

/**
 * Get a user's public profile data
 * Fetches only public fields, excluding sensitive data like email and phone
 *
 * @param {string} userId - User ID to fetch
 * @returns {Promise<{success: boolean, profile?: object, error?: string}>}
 */
export const getUserProfile = async userId => {
  return withTrace('profile/load', async () => {
    try {
      if (!userId) {
        return { success: false, error: 'Invalid user ID' };
      }

      const userRef = doc(db, 'users', userId);
      const userDocSnap = await getDoc(userRef);

      if (!userDocSnap.exists()) {
        return { success: false, error: 'User not found' };
      }

      const userData = userDocSnap.data();

      // Return only public profile fields
      // DO NOT return sensitive data (email, phone, etc.)
      const profile = {
        userId: userDocSnap.id,
        displayName: userData.displayName || null,
        username: userData.username || null,
        bio: userData.bio || null,
        photoURL: userData.photoURL || null,
        profilePhotoURL: userData.profilePhotoURL || null,
        selects: userData.selects || [],
        profileSong: userData.profileSong || null,
        lastUsernameChange: userData.lastUsernameChange || null,
      };

      logger.info('UserService.getUserProfile: Fetched profile', {
        userId,
        hasDisplayName: !!profile.displayName,
        hasUsername: !!profile.username,
      });

      return { success: true, profile };
    } catch (error) {
      logger.error('UserService.getUserProfile: Error', error);
      return { success: false, error: error.message };
    }
  });
};

/**
 * Check if user can change username (14-day restriction)
 * @param {Date|Timestamp|null} lastUsernameChange - Last change timestamp
 * @returns {{canChange: boolean, daysRemaining?: number}}
 */
export const canChangeUsername = lastUsernameChange => {
  if (!lastUsernameChange) {
    return { canChange: true };
  }

  const lastChangeDate =
    lastUsernameChange instanceof Date
      ? lastUsernameChange
      : lastUsernameChange.toDate
        ? lastUsernameChange.toDate()
        : new Date(lastUsernameChange);

  const now = new Date();
  const daysSinceChange = Math.floor((now - lastChangeDate) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, 14 - daysSinceChange);

  if (daysSinceChange >= 14) {
    return { canChange: true };
  }

  return { canChange: false, daysRemaining };
};

/**
 * Update user profile with optional username change tracking
 * If username is changed, updates lastUsernameChange timestamp
 *
 * @param {string} userId - User ID
 * @param {object} updates - Profile fields to update (displayName, username, bio, photoURL)
 * @param {string} currentUsername - Current username for comparison
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updateUserProfile = async (userId, updates, currentUsername) => {
  return withTrace('profile/update', async () => {
    try {
      if (!userId) {
        return { success: false, error: 'Invalid user ID' };
      }

      logger.info('UserService.updateUserProfile: Starting', {
        userId,
        updatingUsername: !!updates.username && updates.username !== currentUsername,
      });

      const userRef = doc(db, 'users', userId);
      const updateData = { ...updates };

      if (updates.username && updates.username !== currentUsername) {
        const normalizedNewUsername = updates.username.toLowerCase().trim();
        const normalizedCurrentUsername = currentUsername?.toLowerCase().trim();

        if (normalizedNewUsername !== normalizedCurrentUsername) {
          const availabilityResult = await checkUsernameAvailability(normalizedNewUsername, userId);
          if (!availabilityResult.success) {
            return { success: false, error: 'Failed to check username availability' };
          }
          if (!availabilityResult.available) {
            return { success: false, error: 'Username is already taken' };
          }

          updateData.lastUsernameChange = Timestamp.now();
          updateData.username = normalizedNewUsername;

          logger.info('UserService.updateUserProfile: Username change detected', {
            oldUsername: normalizedCurrentUsername,
            newUsername: normalizedNewUsername,
          });
        }
      }

      await updateDoc(userRef, updateData);

      logger.info('UserService.updateUserProfile: Success', { userId });
      return { success: true };
    } catch (error) {
      logger.error('UserService.updateUserProfile: Error', error);
      return { success: false, error: error.message };
    }
  });
};

/**
 * Cancel profile setup by deleting the user document
 * Called when user wants to abort profile setup and start over
 *
 * @param {string} userId - User ID to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const cancelProfileSetup = async userId => {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid user ID' };
    }

    logger.info('UserService.cancelProfileSetup: Starting', { userId });

    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);

    logger.info('UserService.cancelProfileSetup: Success', { userId });
    return { success: true };
  } catch (error) {
    logger.error('UserService.cancelProfileSetup: Error', error);
    return { success: false, error: error.message };
  }
};
