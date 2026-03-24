/**
 * Supabase Contact Sync Service
 *
 * Handles contact sync via expo-contacts + Supabase RPC.
 * Replaces Firebase batched queries with a single server-side RPC call
 * that filters out existing friends, pending requests, and blocked users.
 */

import * as Contacts from 'expo-contacts';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

import { supabase } from '@/lib/supabase';

import logger from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface ContactEntry {
  name: string;
  phoneNumbers: string[];
}

export interface ContactSuggestion {
  id: string;
  username: string;
  displayName: string;
  profilePhotoPath: string | null;
}

// ============================================================================
// Exported functions
// ============================================================================

/**
 * Get device contacts with phone numbers
 * Requests permission and fetches contacts via expo-contacts.
 */
export async function getDeviceContacts(): Promise<ContactEntry[]> {
  const { status } = await Contacts.requestPermissionsAsync();

  if (status !== 'granted') {
    throw new Error('Contacts permission denied');
  }

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers],
  });

  const contacts: ContactEntry[] = [];

  for (const contact of data) {
    if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
      contacts.push({
        name: contact.name ?? '',
        phoneNumbers: contact.phoneNumbers.map((p: any) => p.number),
      });
    }
  }

  logger.debug('contactSyncService.getDeviceContacts: Complete', {
    count: contacts.length,
  });

  return contacts;
}

/**
 * Normalize phone numbers to E.164 format and deduplicate
 * Uses libphonenumber-js with US as default region.
 */
export function normalizePhoneNumbers(contacts: ContactEntry[]): string[] {
  const numbers = new Set<string>();

  for (const contact of contacts) {
    for (const phoneNumber of contact.phoneNumbers) {
      const parsed = parsePhoneNumberFromString(phoneNumber, 'US');
      if (parsed && parsed.isValid()) {
        numbers.add(parsed.format('E.164'));
      }
    }
  }

  return [...numbers];
}

/**
 * Find contacts who are on the app via Supabase RPC
 * Server-side function filters out existing friends, pending requests, and blocked users.
 */
export async function findContactsOnApp(
  phoneNumbers: string[],
  userId: string
): Promise<ContactSuggestion[]> {
  if (phoneNumbers.length === 0) {
    return [];
  }

  const { data, error } = await supabase.rpc('find_contacts_on_app', {
    phone_numbers: phoneNumbers,
    requesting_user_id: userId,
  });

  if (error) {
    logger.error('contactSyncService.findContactsOnApp: RPC failed', {
      error: error.message,
    });
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    profilePhotoPath: row.profile_photo_path,
  }));
}

/**
 * Full contact sync orchestration
 * Gets device contacts -> normalizes phone numbers -> calls RPC
 */
export async function syncContacts(
  userId: string
): Promise<ContactSuggestion[]> {
  logger.info('contactSyncService.syncContacts: Starting', { userId });

  const contacts = await getDeviceContacts();
  const phoneNumbers = normalizePhoneNumbers(contacts);

  logger.debug('contactSyncService.syncContacts: Normalized', {
    contactCount: contacts.length,
    phoneCount: phoneNumbers.length,
  });

  return findContactsOnApp(phoneNumbers, userId);
}
