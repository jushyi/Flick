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
  updateDoc,
  query,
  where,
  arrayUnion,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import * as Contacts from 'expo-contacts';
import { Alert, Linking } from 'react-native';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import logger from '../../utils/logger';

// =============================================================================
// SYNC ORCHESTRATION AND SUGGESTION FILTERING
// =============================================================================

import { getFriendships, getPendingRequests, getSentRequests } from './friendshipService';

const db = getFirestore();

// Firestore IN query limit
const BATCH_SIZE = 30;

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

    const results = await Promise.all(
      batches.map(async batch => {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('phoneNumber', 'in', batch));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      })
    );

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

/**
 * Get user's country code from their E.164 phone number
 * Used as default country for parsing contact phone numbers
 *
 * @param {string} userPhoneNumber - User's phone number in E.164 format
 * @returns {string} ISO country code (e.g., 'US', 'GB') or 'US' as default
 */
export const getUserCountryCode = userPhoneNumber => {
  if (!userPhoneNumber) return 'US';
  try {
    const parsed = parsePhoneNumberFromString(userPhoneNumber);
    return parsed?.country || 'US';
  } catch (error) {
    logger.debug('contactSyncService.getUserCountryCode: Parse error', {
      error: error.message,
    });
    return 'US';
  }
};

/**
 * Get user IDs of existing relationships (friends, pending requests)
 * Used to filter out users that shouldn't appear as suggestions
 *
 * @param {string} userId - Current user's ID
 * @returns {Promise<Set<string>>} Set of user IDs with existing relationships
 */
const getExistingRelationshipIds = async userId => {
  const [friendsResult, incomingResult, sentResult] = await Promise.all([
    getFriendships(userId),
    getPendingRequests(userId),
    getSentRequests(userId),
  ]);

  const ids = new Set();

  if (friendsResult.success) {
    friendsResult.friendships.forEach(f => {
      ids.add(f.user1Id === userId ? f.user2Id : f.user1Id);
    });
  }

  if (incomingResult.success) {
    incomingResult.requests.forEach(r => {
      ids.add(r.user1Id === userId ? r.user2Id : r.user1Id);
    });
  }

  if (sentResult.success) {
    sentResult.requests.forEach(r => {
      ids.add(r.user1Id === userId ? r.user2Id : r.user1Id);
    });
  }

  return ids;
};

/**
 * Main sync orchestration: Get contacts, find matching users, filter suggestions
 * This is the primary entry point for contact sync flow
 *
 * @param {string} currentUserId - Current user's ID
 * @param {string} userPhoneNumber - Current user's phone number in E.164 format
 * @returns {Promise<{success: boolean, suggestions?: Array, noContacts?: boolean, error?: string}>}
 */
export const syncContactsAndFindSuggestions = async (currentUserId, userPhoneNumber) => {
  try {
    logger.debug('contactSyncService.syncContactsAndFindSuggestions: Starting', {
      currentUserId,
    });

    // 1. Request permission
    const { granted, permanent } = await requestContactsPermission();
    if (!granted) {
      return {
        success: false,
        error: permanent ? 'permission_denied_permanent' : 'permission_denied',
      };
    }

    // 2. Get user's country for phone parsing
    const defaultCountry = getUserCountryCode(userPhoneNumber);

    // 3. Get all contact phone numbers (normalized)
    const contactPhoneNumbers = await getAllContactPhoneNumbers(defaultCountry);

    // 4. Remove user's own phone number
    const filteredPhoneNumbers = contactPhoneNumbers.filter(phone => phone !== userPhoneNumber);

    if (filteredPhoneNumbers.length === 0) {
      logger.info('contactSyncService.syncContactsAndFindSuggestions: No contacts found');
      return { success: true, suggestions: [], noContacts: true };
    }

    // 5. Find matching users in database
    const matchedUsers = await findUsersByPhoneNumbers(filteredPhoneNumbers);

    // 6. Filter out self, existing friends, pending requests
    const existingIds = await getExistingRelationshipIds(currentUserId);

    const suggestions = matchedUsers.filter(
      user => user.id !== currentUserId && !existingIds.has(user.id)
    );

    logger.info('contactSyncService.syncContactsAndFindSuggestions: Complete', {
      matched: matchedUsers.length,
      filtered: suggestions.length,
    });

    return { success: true, suggestions };
  } catch (error) {
    logger.error('contactSyncService.syncContactsAndFindSuggestions: Error', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get list of dismissed suggestion user IDs for a user
 *
 * @param {string} userId - User ID
 * @returns {Promise<string[]>} Array of dismissed user IDs
 */
export const getDismissedSuggestionIds = async userId => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      return userDoc.data().dismissedSuggestions || [];
    }
    return [];
  } catch (error) {
    logger.error('contactSyncService.getDismissedSuggestionIds: Error', error);
    return [];
  }
};

/**
 * Filter out dismissed suggestions from suggestions list
 *
 * @param {Array} suggestions - Array of suggestion user objects
 * @param {string[]} dismissedIds - Array of dismissed user IDs
 * @returns {Array} Filtered suggestions array
 */
export const filterDismissedSuggestions = (suggestions, dismissedIds = []) => {
  const dismissedSet = new Set(dismissedIds);
  return suggestions.filter(s => !dismissedSet.has(s.id));
};

// =============================================================================
// USER DOCUMENT UPDATES (SYNC STATE & DISMISSALS)
// =============================================================================

/**
 * Dismiss a friend suggestion
 * Adds the dismissed user ID to the current user's dismissedSuggestions array
 *
 * @param {string} userId - Current user's ID
 * @param {string} dismissedUserId - User ID to dismiss
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const dismissSuggestion = async (userId, dismissedUserId) => {
  try {
    if (!userId || !dismissedUserId) {
      return { success: false, error: 'Invalid user IDs' };
    }

    logger.debug('contactSyncService.dismissSuggestion: Dismissing', {
      userId,
      dismissedUserId,
    });

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      dismissedSuggestions: arrayUnion(dismissedUserId),
    });

    logger.info('contactSyncService.dismissSuggestion: Success');
    return { success: true };
  } catch (error) {
    logger.error('contactSyncService.dismissSuggestion: Error', error);
    return { success: false, error: error.message };
  }
};

/**
 * Mark contacts sync as completed for a user
 * Sets contactsSyncCompleted flag and timestamp
 *
 * @param {string} userId - User ID
 * @param {boolean} completed - Whether sync is completed (default: true)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const markContactsSyncCompleted = async (userId, completed = true) => {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid user ID' };
    }

    logger.debug('contactSyncService.markContactsSyncCompleted', {
      userId,
      completed,
    });

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      contactsSyncCompleted: completed,
      contactsSyncedAt: completed ? serverTimestamp() : null,
    });

    logger.info('contactSyncService.markContactsSyncCompleted: Success');
    return { success: true };
  } catch (error) {
    logger.error('contactSyncService.markContactsSyncCompleted: Error', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if user has already synced contacts
 *
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if user has synced contacts
 */
export const hasUserSyncedContacts = async userId => {
  try {
    if (!userId) {
      return false;
    }

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      return userDoc.data().contactsSyncCompleted === true;
    }
    return false;
  } catch (error) {
    logger.error('contactSyncService.hasUserSyncedContacts: Error', error);
    return false;
  }
};

/**
 * Clear all dismissed suggestions for a user
 * Useful for allowing a fresh re-sync
 *
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const clearDismissedSuggestions = async userId => {
  try {
    if (!userId) {
      return { success: false, error: 'Invalid user ID' };
    }

    logger.debug('contactSyncService.clearDismissedSuggestions', { userId });

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      dismissedSuggestions: [],
    });

    logger.info('contactSyncService.clearDismissedSuggestions: Success');
    return { success: true };
  } catch (error) {
    logger.error('contactSyncService.clearDismissedSuggestions: Error', error);
    return { success: false, error: error.message };
  }
};
