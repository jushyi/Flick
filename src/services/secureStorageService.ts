import * as SecureStore from 'expo-secure-store';
import logger from '../utils/logger';

const KEYCHAIN_SERVICE = 'com.spoodsjs.oly';

export const STORAGE_KEYS = {
  FCM_TOKEN: 'fcm_token',
} as const;

const setItem = async (key: string, value: string): Promise<boolean> => {
  try {
    logger.debug('SecureStorage.setItem: Storing value', { key });

    await SecureStore.setItemAsync(key, value, {
      keychainService: KEYCHAIN_SERVICE,
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });

    logger.debug('SecureStorage.setItem: Value stored successfully', { key });
    return true;
  } catch (err) {
    const error = err as Error;
    logger.error('SecureStorage.setItem: Failed to store value', { key, error: error.message });
    return false;
  }
};

const getItem = async (key: string): Promise<string | null> => {
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
  } catch (err) {
    const error = err as Error;
    logger.error('SecureStorage.getItem: Failed to retrieve value', { key, error: error.message });
    return null;
  }
};

const deleteItem = async (key: string): Promise<boolean> => {
  try {
    logger.debug('SecureStorage.deleteItem: Deleting value', { key });

    await SecureStore.deleteItemAsync(key, {
      keychainService: KEYCHAIN_SERVICE,
    });

    logger.debug('SecureStorage.deleteItem: Value deleted', { key });
    return true;
  } catch (err) {
    const error = err as Error;
    logger.error('SecureStorage.deleteItem: Failed to delete value', { key, error: error.message });
    return false;
  }
};

const clearAll = async (): Promise<boolean> => {
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
  } catch (err) {
    const error = err as Error;
    logger.error('SecureStorage.clearAll: Failed to clear all keys', { error: error.message });
    return false;
  }
};

interface SecureStorageService {
  setItem: (key: string, value: string) => Promise<boolean>;
  getItem: (key: string) => Promise<string | null>;
  deleteItem: (key: string) => Promise<boolean>;
  clearAll: () => Promise<boolean>;
}

export const secureStorage: SecureStorageService = {
  setItem,
  getItem,
  deleteItem,
  clearAll,
};

export default secureStorage;
