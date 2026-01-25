import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import logger from '../../utils/logger';

// Initialize Functions once at module level
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
