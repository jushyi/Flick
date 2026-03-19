const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const logger = require('../logger');

/**
 * Store a pending push notification receipt for later checking
 * Receipts are stored with ticket ID as doc ID for easy lookup
 *
 * @param {string} ticketId - Expo Push Notification ticket ID
 * @param {string} userId - User ID (for token cleanup on failure)
 * @param {string} token - Expo Push Token (for reference)
 * @returns {Promise<void>}
 */
async function storePendingReceipt(ticketId, userId, token) {
  try {
    await admin.firestore().collection('pendingReceipts').doc(ticketId).set({
      userId,
      token,
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.debug('storePendingReceipt: Stored receipt', {
      ticketId,
      userId,
    });
  } catch (error) {
    // Fire and forget - don't block on receipt storage
    logger.warn('storePendingReceipt: Failed to store receipt', {
      ticketId,
      userId,
      error: error.message,
    });
  }
}

/**
 * Get all pending receipts from Firestore
 *
 * @returns {Promise<Array<{ticketId: string, userId: string, token: string}>>}
 */
async function getPendingReceipts() {
  try {
    const snapshot = await admin.firestore().collection('pendingReceipts').get();

    return snapshot.docs.map(doc => ({
      ticketId: doc.id,
      userId: doc.data().userId,
      token: doc.data().token,
    }));
  } catch (error) {
    logger.error('getPendingReceipts: Failed to get receipts', {
      error: error.message,
    });
    return [];
  }
}

/**
 * Delete a pending receipt after it has been processed
 *
 * @param {string} ticketId - The ticket ID to delete
 * @returns {Promise<void>}
 */
async function deletePendingReceipt(ticketId) {
  try {
    await admin.firestore().collection('pendingReceipts').doc(ticketId).delete();

    logger.debug('deletePendingReceipt: Deleted receipt', { ticketId });
  } catch (error) {
    logger.warn('deletePendingReceipt: Failed to delete receipt', {
      ticketId,
      error: error.message,
    });
  }
}

/**
 * Remove invalid push token from user document
 * Called when Expo reports DeviceNotRegistered error
 *
 * @param {string} userId - User ID whose token should be removed
 * @returns {Promise<void>}
 */
async function removeInvalidToken(userId) {
  try {
    await admin.firestore().collection('users').doc(userId).update({
      fcmToken: null,
    });

    logger.info('removeInvalidToken: Removed invalid token', { userId });
  } catch (error) {
    logger.error('removeInvalidToken: Failed to remove token', {
      userId,
      error: error.message,
    });
  }
}

module.exports = {
  storePendingReceipt,
  getPendingReceipts,
  deletePendingReceipt,
  removeInvalidToken,
};
