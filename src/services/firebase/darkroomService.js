import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
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
 * Ensure darkroom exists and has valid nextRevealAt for new photo capture
 * Called when user takes a photo to ensure timing is accurate
 * @param {string} userId - User ID
 * @returns {Promise}
 */
export const ensureDarkroomInitialized = async (userId) => {
  logger.info('DarkroomService.ensureDarkroomInitialized: ENTRY', { userId });

  try {
    logger.debug('DarkroomService.ensureDarkroomInitialized: Getting darkroom ref', { userId });
    const darkroomRef = doc(db, 'darkrooms', userId);

    logger.debug('DarkroomService.ensureDarkroomInitialized: Fetching darkroom doc');
    const darkroomDoc = await getDoc(darkroomRef);
    logger.debug('DarkroomService.ensureDarkroomInitialized: Doc fetched', {
      exists: darkroomDoc.exists(),
      userId
    });

    if (!darkroomDoc.exists()) {
      // Create new darkroom with initial reveal time
      logger.info('DarkroomService.ensureDarkroomInitialized: Darkroom does not exist, creating new one', { userId });
      const nextRevealAt = calculateNextRevealTime();
      logger.debug('DarkroomService.ensureDarkroomInitialized: Calculated nextRevealAt', {
        nextRevealAt: nextRevealAt.toDate().toISOString(),
        userId
      });

      await setDoc(darkroomRef, {
        userId,
        nextRevealAt,
        lastRevealedAt: null,
        createdAt: Timestamp.now(),
      });
      logger.info('DarkroomService.ensureDarkroomInitialized: SUCCESS - Created new darkroom', { userId });
      return { success: true, created: true };
    }

    // Darkroom exists - check if nextRevealAt is in the past (stale)
    const data = darkroomDoc.data();
    const { nextRevealAt } = data;
    const now = Timestamp.now();

    logger.debug('DarkroomService.ensureDarkroomInitialized: Checking if stale', {
      userId,
      nextRevealAt: nextRevealAt ? nextRevealAt.toDate().toISOString() : 'null',
      now: now.toDate().toISOString(),
      isStale: !nextRevealAt || nextRevealAt.seconds < now.seconds
    });

    if (!nextRevealAt || nextRevealAt.seconds < now.seconds) {
      // nextRevealAt is stale or missing - reveal overdue photos first, then set a new time
      logger.info('DarkroomService.ensureDarkroomInitialized: Revealing overdue photos before resetting', {
        userId,
        oldNextRevealAt: nextRevealAt ? nextRevealAt.toDate().toISOString() : 'null',
      });

      // Inline reveal logic to avoid circular import with photoService
      let revealedCount = 0;
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
        revealedCount = updates.length;
        logger.info('DarkroomService.ensureDarkroomInitialized: Revealed overdue photos', {
          userId,
          revealedCount,
        });
      } catch (revealError) {
        logger.error('DarkroomService.ensureDarkroomInitialized: Failed to reveal photos', {
          userId,
          error: revealError.message,
        });
        // Continue to update timing even if reveal failed
      }

      // Now schedule next reveal
      const newNextRevealAt = calculateNextRevealTime();
      logger.info('DarkroomService.ensureDarkroomInitialized: Scheduling next reveal', {
        userId,
        newNextRevealAt: newNextRevealAt.toDate().toISOString()
      });

      await updateDoc(darkroomRef, {
        nextRevealAt: newNextRevealAt,
        lastRevealedAt: serverTimestamp(),
      });
      logger.info('DarkroomService.ensureDarkroomInitialized: SUCCESS - Revealed and refreshed stale nextRevealAt', {
        userId,
        revealedCount,
      });
      return { success: true, refreshed: true, revealed: revealedCount };
    }

    // nextRevealAt is still in the future - no change needed
    logger.info('DarkroomService.ensureDarkroomInitialized: SUCCESS - No change needed, nextRevealAt still valid', { userId });
    return { success: true };
  } catch (error) {
    logger.error('DarkroomService.ensureDarkroomInitialized: FAILED', {
      userId,
      error: error.message,
      stack: error.stack
    });
    return { success: false, error: error.message };
  }
};

/**
 * Calculate random reveal time (0-15 minutes from now)
 * @returns {Timestamp} - Next reveal timestamp
 */
const calculateNextRevealTime = () => {
  const now = new Date();
  const randomMinutes = Math.random() * 15; // Random between 0-15 minutes
  const revealTime = new Date(now.getTime() + randomMinutes * 60 * 1000);
  return Timestamp.fromDate(revealTime);
};
