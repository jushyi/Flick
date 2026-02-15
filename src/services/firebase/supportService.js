import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import logger from '../../utils/logger';

const db = getFirestore();

export const SUPPORT_CATEGORIES = ['support', 'bug_report', 'feature_request'];

export const submitSupportRequest = async (userId, category, description) => {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid user ID' };
    }

    if (!category || !SUPPORT_CATEGORIES.includes(category)) {
      return {
        success: false,
        error: `Invalid category. Must be one of: ${SUPPORT_CATEGORIES.join(', ')}`,
      };
    }

    const trimmedDescription = description?.trim();
    if (!trimmedDescription) {
      return { success: false, error: 'Description is required' };
    }

    const requestData = {
      userId,
      category,
      description: trimmedDescription,
      status: 'pending',
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'supportRequests'), requestData);

    logger.info(`Support request submitted: ${docRef.id}`, { category });
    return { success: true, requestId: docRef.id };
  } catch (error) {
    logger.error('Error submitting support request', error);
    return { success: false, error: error.message };
  }
};
