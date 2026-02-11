/**
 * Mention Service
 *
 * Handles fetching mutual friends for @-mention tagging in comments.
 * Calls the getMutualFriendsForComments Cloud Function.
 *
 * Key functions:
 * - getMutualFriendsForTagging: Fetch mutual friends eligible for @-mention in a photo's comments
 */

import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import logger from '../../utils/logger';

const functions = getFunctions();

/**
 * Get mutual friends eligible for @-mention tagging in a photo's comments.
 * Calls the getMutualFriendsForComments Cloud Function.
 *
 * @param {string} photoOwnerId - The photo owner's user ID
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export const getMutualFriendsForTagging = async photoOwnerId => {
  try {
    logger.debug('MentionService.getMutualFriendsForTagging: Fetching mutual friends', {
      photoOwnerId,
    });

    const getMutualFriends = httpsCallable(functions, 'getMutualFriendsForComments');
    const result = await getMutualFriends({ photoOwnerId });

    if (result.data?.mutualFriends) {
      logger.info('MentionService.getMutualFriendsForTagging: Success', {
        count: result.data.mutualFriends.length,
      });
      return { success: true, data: result.data.mutualFriends };
    }

    logger.warn('MentionService.getMutualFriendsForTagging: Unexpected response', {
      data: result.data,
    });
    return { success: false, error: 'Unexpected response from server' };
  } catch (error) {
    logger.error('MentionService.getMutualFriendsForTagging: Failed', {
      error: error.message,
      code: error.code,
    });

    return { success: false, error: error.message || 'Failed to fetch mutual friends' };
  }
};
