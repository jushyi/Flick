/**
 * Report Service
 *
 * Handles user reporting functionality. Reports are stored for manual review
 * in Firebase Console. Each report captures a snapshot of the reported user's
 * profile at the time of report for evidence.
 *
 * Report Data Model:
 * reports/{autoId}
 * {
 *   reporterId: string,           // User who filed the report
 *   reportedUserId: string,       // User being reported
 *   reason: string,               // 'spam' | 'harassment' | 'inappropriate' | 'impersonation' | 'other'
 *   details: string | null,       // Optional additional details
 *   profileSnapshot: {            // Snapshot of reported user's profile at time of report
 *     displayName: string | null,
 *     username: string | null,
 *     bio: string | null,
 *     profilePhotoURL: string | null
 *   },
 *   status: 'pending',            // For future admin review (always 'pending' on creation)
 *   createdAt: serverTimestamp()
 * }
 */

import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import logger from '../../utils/logger';

const db = getFirestore();

/**
 * Valid report reasons
 * Exported for use in UI (reason picker)
 */
export const REPORT_REASONS = ['spam', 'harassment', 'inappropriate', 'impersonation', 'other'];

/**
 * Submit a report against a user
 * Creates a new report document with auto-generated ID
 *
 * @param {string} reporterId - User filing the report
 * @param {string} reportedUserId - User being reported
 * @param {string} reason - One of REPORT_REASONS
 * @param {string|null} details - Optional additional details
 * @param {Object} profileSnapshot - Snapshot of reported user's profile
 * @param {string|null} profileSnapshot.displayName
 * @param {string|null} profileSnapshot.username
 * @param {string|null} profileSnapshot.bio
 * @param {string|null} profileSnapshot.profilePhotoURL
 * @returns {Promise<{success: boolean, reportId?: string, error?: string}>}
 */
export const submitReport = async (
  reporterId,
  reportedUserId,
  reason,
  details,
  profileSnapshot
) => {
  try {
    if (!reporterId || !reportedUserId) {
      return { success: false, error: 'Invalid user IDs' };
    }

    if (reporterId === reportedUserId) {
      return { success: false, error: 'Cannot report yourself' };
    }

    if (!reason || !REPORT_REASONS.includes(reason)) {
      return {
        success: false,
        error: `Invalid reason. Must be one of: ${REPORT_REASONS.join(', ')}`,
      };
    }

    const reportData = {
      reporterId,
      reportedUserId,
      reason,
      details: details || null,
      profileSnapshot: {
        displayName: profileSnapshot?.displayName || null,
        username: profileSnapshot?.username || null,
        bio: profileSnapshot?.bio || null,
        profilePhotoURL: profileSnapshot?.profilePhotoURL || null,
      },
      status: 'pending',
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'reports'), reportData);

    logger.info(`Report submitted: ${docRef.id} against user ${reportedUserId}`);
    return { success: true, reportId: docRef.id };
  } catch (error) {
    logger.error('Error submitting report', error);
    return { success: false, error: error.message };
  }
};
