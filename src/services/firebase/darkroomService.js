import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from '@react-native-firebase/firestore';
import logger from '../../utils/logger';

// Initialize Firestore once at module level
const db = getFirestore();

/**
 * Get or create darkroom document for user
 * @param {string} userId - User ID
 * @returns {Promise} - Darkroom data
 */
export const getDarkroom = async (userId) => {
  try {
    const darkroomRef = doc(db, 'darkrooms', userId);
    const darkroomDoc = await getDoc(darkroomRef);

    // In modular API, exists() is a method
    if (!darkroomDoc.exists()) {
      // Create new darkroom with initial reveal time
      const nextRevealAt = calculateNextRevealTime();
      const createdAt = Timestamp.now();
      await setDoc(darkroomRef, {
        userId,
        nextRevealAt,
        lastRevealedAt: null,
        createdAt,
      });

      return {
        success: true,
        darkroom: {
          userId,
          nextRevealAt,
          lastRevealedAt: null,
          createdAt,
        },
      };
    }

    return {
      success: true,
      darkroom: darkroomDoc.data(),
    };
  } catch (error) {
    logger.error('Error getting darkroom', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if darkroom is ready to reveal photos
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - True if ready to reveal
 */
export const isDarkroomReadyToReveal = async (userId) => {
  try {
    const result = await getDarkroom(userId);
    if (!result.success) return false;

    const { nextRevealAt } = result.darkroom;
    const now = Timestamp.now();

    return nextRevealAt && nextRevealAt.seconds <= now.seconds;
  } catch (error) {
    logger.error('Error checking darkroom reveal status', error);
    return false;
  }
};

/**
 * Set next reveal time after revealing photos
 * @param {string} userId - User ID
 * @returns {Promise}
 */
export const scheduleNextReveal = async (userId) => {
  try {
    const darkroomRef = doc(db, 'darkrooms', userId);
    const nextRevealAt = calculateNextRevealTime();

    await updateDoc(darkroomRef, {
      nextRevealAt,
      lastRevealedAt: serverTimestamp(),
    });

    return { success: true, nextRevealAt };
  } catch (error) {
    logger.error('Error scheduling next reveal', error);
    return { success: false, error: error.message };
  }
};

/**
 * Calculate random reveal time (0-2 hours from now)
 * @returns {Timestamp} - Next reveal timestamp
 */
const calculateNextRevealTime = () => {
  const now = new Date();
  const randomHours = Math.random() * 2; // Random between 0-2 hours
  const revealTime = new Date(now.getTime() + randomHours * 60 * 60 * 1000);
  return Timestamp.fromDate(revealTime);
};
