/**
 * Monthly Album Service
 *
 * Provides read-only access to photos organized by month. Monthly albums are
 * auto-generated from user's triaged photos (journal + archive).
 *
 * Key functions:
 * - getUserPhotosByMonth: Get all user photos grouped by month/year
 * - getMonthPhotos: Get all photos for a specific month
 */

import { getFirestore, collection, getDocs, query, where } from '@react-native-firebase/firestore';
import logger from '../../utils/logger';

const db = getFirestore();

/**
 * Get user's photos grouped by month and year
 * Only includes triaged photos (photoState: 'journal' or 'archive')
 *
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, monthlyData?: object, error?: string}>}
 *
 * Returns structure:
 * {
 *   success: true,
 *   monthlyData: {
 *     "2026": [
 *       { month: "2026-01", coverPhoto: {...}, photoCount: N, photos: [...] },
 *       { month: "2026-02", coverPhoto: {...}, photoCount: N, photos: [...] },
 *     ],
 *     "2025": [...],
 *   }
 * }
 *
 * Years sorted descending (newest first), months within year sorted descending.
 */
export const getUserPhotosByMonth = async userId => {
  logger.debug('MonthlyAlbumService.getUserPhotosByMonth: Starting', { userId });

  try {
    // Query triaged photos (status='triaged' means photoState is set)
    // Filter photoState client-side to avoid composite index
    const photosQuery = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('status', '==', 'triaged')
    );

    const snapshot = await getDocs(photosQuery);

    const photos = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter(photo => photo.photoState === 'journal' || photo.photoState === 'archive');

    logger.debug('MonthlyAlbumService.getUserPhotosByMonth: Filtered photos', {
      total: snapshot.docs.length,
      filtered: photos.length,
    });

    const monthGroups = {};

    photos.forEach(photo => {
      const month = photo.month; // YYYY-MM format
      if (!month) return;

      if (!monthGroups[month]) {
        monthGroups[month] = [];
      }
      monthGroups[month].push(photo);
    });

    // Sort photos within each month by capturedAt descending
    Object.keys(monthGroups).forEach(month => {
      monthGroups[month].sort((a, b) => {
        const aTime = a.capturedAt?.seconds || 0;
        const bTime = b.capturedAt?.seconds || 0;
        return bTime - aTime; // Descending
      });
    });

    const yearGroups = {};

    Object.keys(monthGroups).forEach(month => {
      const [year] = month.split('-');
      const photos = monthGroups[month];

      if (!yearGroups[year]) {
        yearGroups[year] = [];
      }

      yearGroups[year].push({
        month,
        coverPhoto: photos[0], // Most recent photo as cover
        photoCount: photos.length,
        photos,
      });
    });

    // Sort months within each year descending (December first)
    Object.keys(yearGroups).forEach(year => {
      yearGroups[year].sort((a, b) => b.month.localeCompare(a.month));
    });

    const sortedYears = Object.keys(yearGroups).sort((a, b) => parseInt(b) - parseInt(a));
    const monthlyData = {};

    sortedYears.forEach(year => {
      monthlyData[year] = yearGroups[year];
    });

    logger.info('MonthlyAlbumService.getUserPhotosByMonth: Grouped photos', {
      userId,
      yearCount: sortedYears.length,
      totalMonths: Object.keys(monthGroups).length,
    });

    return { success: true, monthlyData };
  } catch (error) {
    logger.error('MonthlyAlbumService.getUserPhotosByMonth: Failed', {
      userId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Get all photos for a specific month
 * Only includes triaged photos (photoState: 'journal' or 'archive')
 *
 * @param {string} userId - User ID
 * @param {string} month - Month in YYYY-MM format
 * @returns {Promise<{success: boolean, photos?: object[], error?: string}>}
 *
 * Photos sorted by capturedAt descending (newest first).
 */
export const getMonthPhotos = async (userId, month) => {
  logger.debug('MonthlyAlbumService.getMonthPhotos: Starting', { userId, month });

  try {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return { success: false, error: 'Invalid month format. Expected YYYY-MM.' };
    }

    // Query photos for specific month
    // Filter photoState client-side to avoid composite index
    const photosQuery = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('month', '==', month),
      where('status', '==', 'triaged')
    );

    const snapshot = await getDocs(photosQuery);

    const photos = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter(photo => photo.photoState === 'journal' || photo.photoState === 'archive')
      .sort((a, b) => {
        const aTime = a.capturedAt?.seconds || 0;
        const bTime = b.capturedAt?.seconds || 0;
        return bTime - aTime; // Descending
      });

    logger.info('MonthlyAlbumService.getMonthPhotos: Retrieved photos', {
      userId,
      month,
      count: photos.length,
    });

    return { success: true, photos };
  } catch (error) {
    logger.error('MonthlyAlbumService.getMonthPhotos: Failed', {
      userId,
      month,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};
