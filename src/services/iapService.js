/**
 * In-App Purchase Service
 *
 * Manages IAP product fetching, purchase flow, and contributor status.
 * Uses react-native-iap for App Store integration.
 *
 * Key functions:
 * - initializeIAP: Initialize connection to App Store
 * - getProducts: Fetch product details from App Store
 * - purchaseProduct: Initiate purchase flow for a product
 * - finishTransaction: Acknowledge/finish a transaction
 * - restorePurchases: Check for previous purchases
 * - checkContributorStatus: Check if user has contributed
 * - saveContribution: Save purchase to Firestore
 */

import * as RNIap from 'react-native-iap';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import logger from '../utils/logger';

const db = getFirestore();

// IAP product IDs - must match App Store Connect configuration
export const PRODUCT_IDS = [
  'flick_contribution_099', // $0.99
  'flick_contribution_299', // $2.99
  'flick_contribution_499', // $4.99
  'flick_contribution_999', // $9.99
];

// Track if IAP is initialized
let isIAPInitialized = false;

/**
 * Initialize IAP connection to App Store
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const initializeIAP = async () => {
  if (isIAPInitialized) {
    logger.debug('IAPService.initializeIAP: Already initialized');
    return { success: true };
  }

  // Check if native module is available (not available in Expo Go or dev builds without native linking)
  if (!RNIap || typeof RNIap.initConnection !== 'function') {
    logger.warn('IAPService.initializeIAP: Native module not available in this build');
    return { success: false, error: 'IAP not available in this build' };
  }

  try {
    logger.debug('IAPService.initializeIAP: Starting connection');
    await RNIap.initConnection();
    isIAPInitialized = true;
    logger.info('IAPService.initializeIAP: Connection established');
    return { success: true };
  } catch (error) {
    logger.error('IAPService.initializeIAP: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * End IAP connection (call on app unmount if needed)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const endIAPConnection = async () => {
  try {
    await RNIap.endConnection();
    isIAPInitialized = false;
    logger.info('IAPService.endIAPConnection: Connection closed');
    return { success: true };
  } catch (error) {
    logger.error('IAPService.endIAPConnection: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Fetch product details from App Store
 * @returns {Promise<{success: boolean, products?: Array, error?: string}>}
 */
export const getProducts = async () => {
  try {
    if (!isIAPInitialized) {
      const initResult = await initializeIAP();
      if (!initResult.success) {
        return initResult;
      }
    }

    logger.debug('IAPService.getProducts: Fetching products', { productIds: PRODUCT_IDS });
    const products = await RNIap.getProducts({ skus: PRODUCT_IDS });
    logger.info('IAPService.getProducts: Fetched successfully', { count: products.length });
    return { success: true, products };
  } catch (error) {
    logger.error('IAPService.getProducts: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Purchase a product
 * @param {string} productId - Product ID to purchase
 * @returns {Promise<{success: boolean, purchase?: object, error?: string}>}
 */
export const purchaseProduct = async productId => {
  try {
    if (!isIAPInitialized) {
      const initResult = await initializeIAP();
      if (!initResult.success) {
        return initResult;
      }
    }

    logger.debug('IAPService.purchaseProduct: Starting purchase', { productId });
    const purchase = await RNIap.requestPurchase({ sku: productId });
    logger.info('IAPService.purchaseProduct: Purchase completed', {
      productId,
      transactionId: purchase.transactionId,
    });
    return { success: true, purchase };
  } catch (error) {
    // User cancelled is a normal flow, not an error
    if (error.code === 'E_USER_CANCELLED') {
      logger.debug('IAPService.purchaseProduct: User cancelled', { productId });
      return { success: false, error: 'cancelled', userCancelled: true };
    }
    logger.error('IAPService.purchaseProduct: Failed', { productId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Finish a transaction (acknowledge to App Store)
 * CRITICAL: Must be called after successful purchase to prevent re-delivery
 * @param {object} purchase - Purchase object from requestPurchase
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const finishTransaction = async purchase => {
  try {
    logger.debug('IAPService.finishTransaction: Finishing transaction', {
      transactionId: purchase.transactionId,
    });
    await RNIap.finishTransaction({ purchase, isConsumable: true });
    logger.info('IAPService.finishTransaction: Transaction finished', {
      transactionId: purchase.transactionId,
    });
    return { success: true };
  } catch (error) {
    logger.error('IAPService.finishTransaction: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Restore previous purchases
 * @returns {Promise<{success: boolean, purchases?: Array, error?: string}>}
 */
export const restorePurchases = async () => {
  try {
    if (!isIAPInitialized) {
      const initResult = await initializeIAP();
      if (!initResult.success) {
        return initResult;
      }
    }

    logger.debug('IAPService.restorePurchases: Starting restore');
    const purchases = await RNIap.getAvailablePurchases();
    logger.info('IAPService.restorePurchases: Restored', { count: purchases.length });
    return { success: true, purchases };
  } catch (error) {
    logger.error('IAPService.restorePurchases: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Check if user is a contributor
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, isContributor: boolean, error?: string}>}
 */
export const checkContributorStatus = async userId => {
  try {
    logger.debug('IAPService.checkContributorStatus: Checking', { userId });
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return { success: false, error: 'User not found' };
    }

    const userData = userDoc.data();
    const isContributor = userData.isContributor === true;

    logger.debug('IAPService.checkContributorStatus: Checked', { userId, isContributor });
    return { success: true, isContributor };
  } catch (error) {
    logger.error('IAPService.checkContributorStatus: Failed', { userId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Save contribution to Firestore and mark user as contributor
 * @param {string} userId - User ID
 * @param {string} productId - Product ID purchased
 * @param {string} transactionId - Transaction ID from App Store
 * @param {string} amount - Product price (e.g., "$0.99")
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const saveContribution = async (userId, productId, transactionId, amount) => {
  try {
    logger.debug('IAPService.saveContribution: Saving', { userId, productId, transactionId });

    // Save contribution record
    const contributionsCollection = collection(db, 'contributions');
    await addDoc(contributionsCollection, {
      userId,
      productId,
      transactionId,
      amount,
      createdAt: serverTimestamp(),
    });

    // Mark user as contributor (if not already)
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      const updates = {};

      if (!userData.isContributor) {
        updates.isContributor = true;
      }
      if (!userData.nameColor) {
        updates.nameColor = null; // null means default (white)
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(userRef, updates);
        logger.info('IAPService.saveContribution: User marked as contributor', { userId });
      }
    }

    logger.info('IAPService.saveContribution: Contribution saved', {
      userId,
      productId,
      transactionId,
    });
    return { success: true };
  } catch (error) {
    logger.error('IAPService.saveContribution: Failed', {
      userId,
      productId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Get user's contribution history
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, contributions?: Array, error?: string}>}
 */
export const getUserContributions = async userId => {
  try {
    logger.debug('IAPService.getUserContributions: Fetching', { userId });
    const contributionsCollection = collection(db, 'contributions');
    const q = query(contributionsCollection, where('userId', '==', userId));
    const snapshot = await getDocs(q);

    const contributions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    logger.info('IAPService.getUserContributions: Fetched', {
      userId,
      count: contributions.length,
    });
    return { success: true, contributions };
  } catch (error) {
    logger.error('IAPService.getUserContributions: Failed', { userId, error: error.message });
    return { success: false, error: error.message };
  }
};
