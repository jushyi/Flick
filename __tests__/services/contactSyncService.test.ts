/**
 * Supabase Contact Sync Service Tests
 *
 * Tests contact permission, phone normalization, and Supabase RPC lookup.
 * Mocks expo-contacts, libphonenumber-js, and supabase.
 */

import * as Contacts from 'expo-contacts';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

import { supabase } from '../../src/lib/supabase';

const mockSupabase = supabase as any;

// Must mock libphonenumber-js before importing the service
jest.mock('libphonenumber-js', () => ({
  parsePhoneNumberFromString: jest.fn(),
}));

// expo-contacts is already mocked in jest.setup (requestPermissionsAsync returns granted)
// but we need to add getContactsAsync mock
jest.mock('expo-contacts', () => ({
  requestPermissionsAsync: jest.fn(),
  getContactsAsync: jest.fn(),
  Fields: {
    PhoneNumbers: 'phoneNumbers',
  },
}));

import * as contactSyncService from '../../src/services/supabase/contactSyncService';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getDeviceContacts', () => {
  it('throws when permission denied', async () => {
    (Contacts.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
    });

    await expect(contactSyncService.getDeviceContacts()).rejects.toThrow(
      'Contacts permission denied'
    );
  });

  it('returns mapped contacts with phone numbers', async () => {
    (Contacts.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Contacts.getContactsAsync as jest.Mock).mockResolvedValue({
      data: [
        {
          name: 'Alice',
          phoneNumbers: [
            { number: '+14155551234' },
            { number: '+14155555678' },
          ],
        },
        {
          name: 'Bob',
          phoneNumbers: [{ number: '+442071234567' }],
        },
        {
          name: 'No Phone',
          phoneNumbers: undefined,
        },
      ],
    });

    const result = await contactSyncService.getDeviceContacts();

    expect(Contacts.getContactsAsync).toHaveBeenCalledWith({
      fields: [Contacts.Fields.PhoneNumbers],
    });
    expect(result).toEqual([
      {
        name: 'Alice',
        phoneNumbers: ['+14155551234', '+14155555678'],
      },
      {
        name: 'Bob',
        phoneNumbers: ['+442071234567'],
      },
    ]);
  });
});

describe('normalizePhoneNumbers', () => {
  it('converts to E.164 and deduplicates', () => {
    const mockParsed = {
      isValid: () => true,
      format: () => '+14155551234',
    };
    (parsePhoneNumberFromString as unknown as jest.Mock).mockReturnValue(
      mockParsed
    );

    const contacts = [
      { name: 'Alice', phoneNumbers: ['(415) 555-1234', '415-555-1234'] },
      { name: 'Bob', phoneNumbers: ['(415) 555-1234'] },
    ];

    const result = contactSyncService.normalizePhoneNumbers(contacts);

    // All three numbers normalize to the same E.164 -> deduped to 1
    expect(result).toEqual(['+14155551234']);
  });

  it('skips invalid phone numbers', () => {
    (parsePhoneNumberFromString as unknown as jest.Mock)
      .mockReturnValueOnce({ isValid: () => true, format: () => '+14155551234' })
      .mockReturnValueOnce(null) // invalid
      .mockReturnValueOnce({ isValid: () => false }); // invalid

    const contacts = [
      { name: 'Mixed', phoneNumbers: ['(415) 555-1234', 'not-a-number', '123'] },
    ];

    const result = contactSyncService.normalizePhoneNumbers(contacts);

    expect(result).toEqual(['+14155551234']);
  });
});

describe('findContactsOnApp', () => {
  it('returns empty array for empty phone list (no RPC call)', async () => {
    mockSupabase.rpc = jest.fn();

    const result = await contactSyncService.findContactsOnApp([], 'user-1');

    expect(result).toEqual([]);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('calls supabase.rpc with correct function name and params', async () => {
    mockSupabase.rpc = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'user-2',
          username: 'alice',
          display_name: 'Alice',
          profile_photo_path: 'alice/profile.webp',
        },
      ],
      error: null,
    });

    const result = await contactSyncService.findContactsOnApp(
      ['+14155551234', '+442071234567'],
      'user-1'
    );

    expect(mockSupabase.rpc).toHaveBeenCalledWith('find_contacts_on_app', {
      phone_numbers: ['+14155551234', '+442071234567'],
      requesting_user_id: 'user-1',
    });
    expect(result).toEqual([
      {
        id: 'user-2',
        username: 'alice',
        displayName: 'Alice',
        profilePhotoPath: 'alice/profile.webp',
      },
    ]);
  });

  it('throws on RPC error', async () => {
    mockSupabase.rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'RPC failed' },
    });

    await expect(
      contactSyncService.findContactsOnApp(['+14155551234'], 'user-1')
    ).rejects.toThrow('RPC failed');
  });
});

describe('syncContacts', () => {
  it('orchestrates full flow (permission -> normalize -> RPC)', async () => {
    // Mock permission
    (Contacts.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });

    // Mock contacts
    (Contacts.getContactsAsync as jest.Mock).mockResolvedValue({
      data: [
        {
          name: 'Alice',
          phoneNumbers: [{ number: '+14155551234' }],
        },
      ],
    });

    // Mock phone number parsing
    (parsePhoneNumberFromString as unknown as jest.Mock).mockReturnValue({
      isValid: () => true,
      format: () => '+14155551234',
    });

    // Mock RPC
    mockSupabase.rpc = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'user-2',
          username: 'alice',
          display_name: 'Alice',
          profile_photo_path: null,
        },
      ],
      error: null,
    });

    const result = await contactSyncService.syncContacts('user-1');

    // Should have called contacts API
    expect(Contacts.requestPermissionsAsync).toHaveBeenCalled();
    expect(Contacts.getContactsAsync).toHaveBeenCalled();

    // Should have called RPC
    expect(mockSupabase.rpc).toHaveBeenCalledWith('find_contacts_on_app', {
      phone_numbers: ['+14155551234'],
      requesting_user_id: 'user-1',
    });

    // Should return mapped suggestions
    expect(result).toEqual([
      {
        id: 'user-2',
        username: 'alice',
        displayName: 'Alice',
        profilePhotoPath: null,
      },
    ]);
  });
});
