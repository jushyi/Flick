/**
 * Secure Storage Service
 *
 * Provides encrypted storage using iOS Keychain via expo-secure-store.
 * Used for storing sensitive data like FCM tokens.
 *
 * Key features:
 * - Encrypted storage using iOS Keychain
 * - AFTER_FIRST_UNLOCK accessibility (available after device unlock)
 * - Consistent error handling with { success, error } pattern
 * - Matches existing service patterns in codebase
 */

import * as SecureStore from 'expo-secure-store';
import logger from '../utils/logger';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Keychain service identifier - matches bundle ID for organization
 */
const KEYCHAIN_SERVICE = 'com.spoodsjs.oly';

/**
 * Storage keys for sensitive data
 * Add new keys here as needed
 */
export const STORAGE_KEYS = {
  FCM_TOKEN: 'fcm_token',
};

// =============================================================================
// SECURE STORAGE FUNCTIONS
// =============================================================================

/**
 * Store a value securely in iOS Keychain
 * @param {string} key - Storage key (use STORAGE_KEYS constants)
 * @param {string} value - Value to store (must be string, max 2KB)
 * @returns {Promise<boolean>} Success status
 */
const setItem = async (key, value) => {
  try {
    logger.debug('SecureStorage.setItem: Storing value', { key });

    await SecureStore.setItemAsync(key, value, {
      keychainService: KEYCHAIN_SERVICE,
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });

    logger.debug('SecureStorage.setItem: Value stored successfully', { key });
    return true;
  } catch (error) {
    // 2KB limit can cause failures for large values
    logger.error('SecureStorage.setItem: Failed to store value', {
      key,
      error: error.message,
    });
    return false;
  }
};

/**
 * Retrieve a value from iOS Keychain
 * @param {string} key - Storage key (use STORAGE_KEYS constants)
 * @returns {Promise<string|null>} Stored value or null if not found
 */
const getItem = async key => {
  try {
    logger.debug('SecureStorage.getItem: Retrieving value', { key });

    const value = await SecureStore.getItemAsync(key, {
      keychainService: KEYCHAIN_SERVICE,
    });

    if (value) {
      logger.debug('SecureStorage.getItem: Value retrieved', { key });
    } else {
      logger.debug('SecureStorage.getItem: No value found', { key });
    }

    return value;
  } catch (error) {
    logger.error('SecureStorage.getItem: Failed to retrieve value', {
      key,
      error: error.message,
    });
    return null;
  }
};

/**
 * Delete a value from iOS Keychain
 * @param {string} key - Storage key (use STORAGE_KEYS constants)
 * @returns {Promise<boolean>} Success status
 */
const deleteItem = async key => {
  try {
    logger.debug('SecureStorage.deleteItem: Deleting value', { key });

    await SecureStore.deleteItemAsync(key, {
      keychainService: KEYCHAIN_SERVICE,
    });

    logger.debug('SecureStorage.deleteItem: Value deleted', { key });
    return true;
  } catch (error) {
    logger.error('SecureStorage.deleteItem: Failed to delete value', {
      key,
      error: error.message,
    });
    return false;
  }
};

/**
 * Clear all known secure storage keys
 * Used during logout to ensure complete cleanup
 * @returns {Promise<boolean>} Success status (true if all keys cleared)
 */
const clearAll = async () => {
  try {
    logger.debug('SecureStorage.clearAll: Clearing all keys');

    const keys = Object.values(STORAGE_KEYS);
    const results = await Promise.all(keys.map(key => deleteItem(key)));

    const allCleared = results.every(result => result === true);

    if (allCleared) {
      logger.info('SecureStorage.clearAll: All keys cleared successfully', {
        keysCleared: keys.length,
      });
    } else {
      logger.warn('SecureStorage.clearAll: Some keys failed to clear', {
        total: keys.length,
        cleared: results.filter(Boolean).length,
      });
    }

    return allCleared;
  } catch (error) {
    logger.error('SecureStorage.clearAll: Failed to clear all keys', {
      error: error.message,
    });
    return false;
  }
};

// =============================================================================
// EXPORT
// =============================================================================

export const secureStorage = {
  setItem,
  getItem,
  deleteItem,
  clearAll,
};

export default secureStorage;
