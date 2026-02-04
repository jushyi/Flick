/**
 * Account Service
 *
 * Handles account-level operations including account deletion.
 * Uses Cloud Functions for secure server-side operations.
 *
 * Key functions:
 * - deleteUserAccount: Delete account and all associated data (immediate)
 * - scheduleAccountDeletion: Schedule account for deletion in 30 days
 * - cancelAccountDeletion: Cancel a scheduled deletion
 * - checkDeletionStatus: Check if account deletion is scheduled
 */

import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import logger from '../../utils/logger';

const functions = getFunctions();

/**
 * Delete user account and all associated data.
 * Calls the deleteUserAccount Cloud Function.
 *
 * This function triggers a cascade deletion:
 * 1. Storage files (photos)
 * 2. Photo documents
 * 3. Friendship documents
 * 4. Darkroom document
 * 5. User document
 * 6. Firebase Auth user
 *
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteUserAccount = async () => {
  try {
    logger.info('AccountService.deleteUserAccount: Starting account deletion');

    const deleteAccount = httpsCallable(functions, 'deleteUserAccount');
    const result = await deleteAccount();

    if (result.data?.success) {
      logger.info('AccountService.deleteUserAccount: Success');
      return { success: true };
    }

    logger.warn('AccountService.deleteUserAccount: Unexpected response', {
      data: result.data,
    });
    return { success: false, error: 'Unexpected response from server' };
  } catch (error) {
    logger.error('AccountService.deleteUserAccount: Failed', {
      error: error.message,
      code: error.code,
    });

    // Map common error codes to user-friendly messages
    let userMessage = 'Account deletion failed. Please try again.';
    if (error.code === 'functions/unauthenticated') {
      userMessage = 'Authentication required. Please sign in and try again.';
    } else if (error.code === 'functions/internal') {
      userMessage = error.message || 'An error occurred during deletion.';
    }

    return { success: false, error: userMessage };
  }
};

/**
 * Schedule user account for deletion after 30-day grace period.
 * Calls the scheduleUserAccountDeletion Cloud Function.
 *
 * @returns {Promise<{success: boolean, scheduledDate?: Date, error?: string}>}
 */
export const scheduleAccountDeletion = async () => {
  try {
    logger.info('AccountService.scheduleAccountDeletion: Scheduling deletion');

    const scheduleDelete = httpsCallable(functions, 'scheduleUserAccountDeletion');
    const result = await scheduleDelete();

    if (result.data?.success) {
      logger.info('AccountService.scheduleAccountDeletion: Success', {
        scheduledDate: result.data.scheduledDate,
      });
      return {
        success: true,
        scheduledDate: new Date(result.data.scheduledDate),
      };
    }

    logger.warn('AccountService.scheduleAccountDeletion: Unexpected response', {
      data: result.data,
    });
    return { success: false, error: 'Unexpected response from server' };
  } catch (error) {
    logger.error('AccountService.scheduleAccountDeletion: Failed', {
      error: error.message,
      code: error.code,
    });

    let userMessage = 'Failed to schedule account deletion. Please try again.';
    if (error.code === 'functions/unauthenticated') {
      userMessage = 'Authentication required. Please sign in and try again.';
    } else if (error.code === 'functions/unavailable') {
      userMessage = 'Network error. Please check your connection and try again.';
    }

    return { success: false, error: userMessage };
  }
};

/**
 * Cancel a scheduled account deletion.
 * Calls the cancelUserAccountDeletion Cloud Function.
 *
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const cancelAccountDeletion = async () => {
  try {
    logger.info('AccountService.cancelAccountDeletion: Canceling scheduled deletion');

    const cancelDelete = httpsCallable(functions, 'cancelUserAccountDeletion');
    const result = await cancelDelete();

    if (result.data?.success) {
      logger.info('AccountService.cancelAccountDeletion: Success');
      return { success: true };
    }

    logger.warn('AccountService.cancelAccountDeletion: Unexpected response', {
      data: result.data,
    });
    return { success: false, error: 'Unexpected response from server' };
  } catch (error) {
    logger.error('AccountService.cancelAccountDeletion: Failed', {
      error: error.message,
      code: error.code,
    });

    let userMessage = 'Failed to cancel deletion. Please try again.';
    if (error.code === 'functions/unauthenticated') {
      userMessage = 'Authentication required. Please sign in and try again.';
    } else if (error.code === 'functions/unavailable') {
      userMessage = 'Network error. Please check your connection and try again.';
    }

    return { success: false, error: userMessage };
  }
};

/**
 * Check if account deletion is scheduled.
 * Reads user document directly to check deletion status.
 *
 * @returns {Promise<{isScheduled: boolean, scheduledDate: Date | null, error?: string}>}
 */
export const checkDeletionStatus = async () => {
  try {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      logger.warn('AccountService.checkDeletionStatus: No authenticated user');
      return { isScheduled: false, scheduledDate: null, error: 'Not authenticated' };
    }

    const userDoc = await firestore().collection('users').doc(currentUser.uid).get();

    if (!userDoc.exists) {
      logger.warn('AccountService.checkDeletionStatus: User document not found');
      return { isScheduled: false, scheduledDate: null };
    }

    const userData = userDoc.data();
    const scheduledForDeletionAt = userData?.scheduledForDeletionAt;

    if (scheduledForDeletionAt) {
      const scheduledDate = scheduledForDeletionAt.toDate();
      logger.info('AccountService.checkDeletionStatus: Deletion scheduled', {
        scheduledDate,
      });
      return { isScheduled: true, scheduledDate };
    }

    logger.debug('AccountService.checkDeletionStatus: No deletion scheduled');
    return { isScheduled: false, scheduledDate: null };
  } catch (error) {
    logger.error('AccountService.checkDeletionStatus: Failed', {
      error: error.message,
    });
    return { isScheduled: false, scheduledDate: null, error: error.message };
  }
};
