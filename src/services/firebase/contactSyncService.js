/**
 * contactSyncService.js
 *
 * Handles contact synchronization and friend suggestion features:
 * - Phone number normalization to E.164 format
 * - Device contacts permission handling
 * - Contact fetching with pagination
 * - User lookup by phone numbers (batched for Firestore limits)
 *
 * Contact Sync Flow:
 * 1. Request permission -> Get contacts -> Normalize phone numbers
 * 2. Batch query Firestore for matching users
 * 3. Filter out self, existing friends, pending requests
 * 4. Return suggestions list
 */

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from '@react-native-firebase/firestore';
import * as Contacts from 'expo-contacts';
import { Alert, Linking } from 'react-native';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import logger from '../../utils/logger';

// Initialize Firestore once at module level
const db = getFirestore();

// Firestore IN query limit
const BATCH_SIZE = 30;

// Contact pagination size
const CONTACTS_PAGE_SIZE = 100;

/**
 * Normalize a phone number to E.164 format
 * Handles various input formats: (415) 555-1234, +1-415-555-1234, etc.
 *
 * @param {string} phoneNumber - Raw phone number from contact
 * @param {string} defaultCountry - Default country code if not in number (e.g., 'US')
 * @returns {string|null} E.164 format (+14155551234) or null if invalid
 */
export const normalizeToE164 = (phoneNumber, defaultCountry = 'US') => {
  if (!phoneNumber) return null;

  try {
    // parsePhoneNumberFromString handles international format automatically
    // For national format, it uses the defaultCountry
    const parsed = parsePhoneNumberFromString(phoneNumber, defaultCountry);

    if (parsed && parsed.isValid()) {
      return parsed.format('E.164'); // +14155551234
    }
    return null;
  } catch (error) {
    logger.debug('contactSyncService.normalizeToE164: Parse error', {
      error: error.message,
    });
    return null;
  }
};

/**
 * Request contacts permission from the user
 * Handles permanently denied state by guiding to settings
 *
 * @returns {Promise<{granted: boolean, permanent?: boolean}>}
 */
export const requestContactsPermission = async () => {
  try {
    logger.debug('contactSyncService.requestContactsPermission: Requesting');

    const { status, canAskAgain } = await Contacts.requestPermissionsAsync();

    if (status === 'granted') {
      logger.info('contactSyncService.requestContactsPermission: Granted');
      return { granted: true };
    }

    if (status === 'denied' && !canAskAgain) {
      // User has permanently denied - guide to settings
      logger.warn('contactSyncService.requestContactsPermission: Permanently denied');
      Alert.alert(
        'Contacts Access Required',
        'To find friends, please enable Contacts access in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return { granted: false, permanent: true };
    }

    logger.info('contactSyncService.requestContactsPermission: Denied');
    return { granted: false, permanent: false };
  } catch (error) {
    logger.error('contactSyncService.requestContactsPermission: Error', error);
    return { granted: false, permanent: false };
  }
};

/**
 * Check contacts permission status without prompting
 *
 * @returns {Promise<boolean>} True if permission is granted
 */
export const checkContactsPermission = async () => {
  try {
    const { status } = await Contacts.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    logger.error('contactSyncService.checkContactsPermission: Error', error);
    return false;
  }
};

/**
 * Get all phone numbers from device contacts, normalized to E.164
 * Uses pagination to handle large contact lists without blocking UI
 *
 * @param {string} defaultCountry - Default country code for phone parsing (e.g., 'US')
 * @returns {Promise<string[]>} Array of unique E.164 formatted phone numbers
 */
export const getAllContactPhoneNumbers = async (defaultCountry = 'US') => {
  try {
    logger.debug('contactSyncService.getAllContactPhoneNumbers: Starting', {
      defaultCountry,
    });

    const allPhoneNumbers = new Set(); // Deduplicate
    let hasNextPage = true;
    let pageOffset = 0;

    while (hasNextPage) {
      const { data, hasNextPage: more } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
        pageSize: CONTACTS_PAGE_SIZE,
        pageOffset,
      });

      // Extract and normalize all phone numbers
      for (const contact of data) {
        if (contact.phoneNumbers) {
          for (const phone of contact.phoneNumbers) {
            const normalized = normalizeToE164(phone.number, defaultCountry);
            if (normalized) {
              allPhoneNumbers.add(normalized);
            }
          }
        }
      }

      hasNextPage = more;
      pageOffset += CONTACTS_PAGE_SIZE;
    }

    const phoneNumbers = Array.from(allPhoneNumbers);
    logger.info('contactSyncService.getAllContactPhoneNumbers: Complete', {
      count: phoneNumbers.length,
    });

    return phoneNumbers;
  } catch (error) {
    logger.error('contactSyncService.getAllContactPhoneNumbers: Error', error);
    return [];
  }
};

/**
 * Find users by phone numbers, handling Firestore's IN query limit
 * Batches queries in groups of 30 (Firestore limit) and executes in parallel
 *
 * @param {string[]} phoneNumbers - Array of E.164 phone numbers
 * @returns {Promise<Array<{id: string, [key: string]: any}>>} Array of user objects
 */
export const findUsersByPhoneNumbers = async phoneNumbers => {
  try {
    if (!phoneNumbers || !phoneNumbers.length) {
      return [];
    }

    logger.debug('contactSyncService.findUsersByPhoneNumbers: Starting', {
      count: phoneNumbers.length,
      batches: Math.ceil(phoneNumbers.length / BATCH_SIZE),
    });

    // Split into batches of 30 (Firestore IN query limit)
    const batches = [];
    for (let i = 0; i < phoneNumbers.length; i += BATCH_SIZE) {
      batches.push(phoneNumbers.slice(i, i + BATCH_SIZE));
    }

    // Execute all batches in parallel
    const results = await Promise.all(
      batches.map(async batch => {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('phoneNumber', 'in', batch));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      })
    );

    // Flatten results
    const users = results.flat();
    logger.info('contactSyncService.findUsersByPhoneNumbers: Complete', {
      found: users.length,
    });

    return users;
  } catch (error) {
    logger.error('contactSyncService.findUsersByPhoneNumbers: Error', error);
    return [];
  }
};
