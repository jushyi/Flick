/**
 * AuthContext Unit Tests
 *
 * Tests the Supabase auth state management and silent Firebase migration bridge.
 * Verifies that:
 * - Auth state uses supabase.auth.onAuthStateChange (not Firebase)
 * - Silent migration detects Firebase token, calls Edge Function, calls setSession
 * - signOut calls supabase.auth.signOut
 * - initializing stays true until both session and profile resolve
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock notification service
  clearLocalNotificationToken: jest.fn(() => Promise.resolve()),
}));

// Mock secure storage
jest.mock('../../src/services/secureStorageService', () => ({
  secureStorage: {
    clearAll: jest.fn(() => Promise.resolve()),
  },
}));

// Mock expo-image
jest.mock('expo-image', () => ({
  Image: {
    clearMemoryCache: jest.fn(() => Promise.resolve()),
    clearDiskCache: jest.fn(() => Promise.resolve()),
  },
}));

// Access global supabase mocks from jest.setup.js
const mockSupabaseAuth = global.__supabaseMocks.auth;
const mockSupabaseFunctions = global.__supabaseMocks.functions;

// Firebase auth mock for migration bridge
const mockFirebaseGetIdToken = jest.fn(() => Promise.resolve('mock-firebase-token'));
const mockFirebaseSignOut = jest.fn(() => Promise.resolve());
const mockFirebaseCurrentUser = {
  uid: 'firebase-uid-123',
  phoneNumber: '+11234567890',
  getIdToken: mockFirebaseGetIdToken,
};

// By default, return a user with a token (simulating existing Firebase user)
  const getAuth = jest.fn(() => ({
    currentUser: mockFirebaseCurrentUser,
    signOut: mockFirebaseSignOut,
  }));
  return { getAuth };
});

describe('AuthContext', () => {
  const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset onAuthStateChange to return a subscription
    mockSupabaseAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
    mockSupabaseFunctions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'No migration needed' },
    });
  });

  describe('silent migration bridge', () => {
    it('detects Firebase token and calls migrate-firebase-auth Edge Function', async () => {
      mockSupabaseFunctions.invoke.mockResolvedValue({
        data: {
          success: true,
          migrated: true,
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          supabaseUserId: 'supa-uuid-123',
        },
        error: null,
      });

      renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(mockSupabaseFunctions.invoke).toHaveBeenCalledWith(
          'migrate-firebase-auth',
          expect.objectContaining({
            body: { firebaseToken: 'mock-firebase-token' },
          })
        );
      });
    });

    it('calls setSession with access_token and refresh_token from Edge Function', async () => {
      mockSupabaseFunctions.invoke.mockResolvedValue({
        data: {
          success: true,
          migrated: true,
          access_token: 'real-access-token',
          refresh_token: 'real-refresh-token',
          supabaseUserId: 'supa-uuid-123',
        },
        error: null,
      });

      renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(mockSupabaseAuth.setSession).toHaveBeenCalledWith({
          access_token: 'real-access-token',
          refresh_token: 'real-refresh-token',
        });
      });
    });

    it('signs out of Firebase after successful migration', async () => {
      mockSupabaseFunctions.invoke.mockResolvedValue({
        data: {
          success: true,
          migrated: true,
          access_token: 'access-token',
          refresh_token: 'refresh-token',
        },
        error: null,
      });

      renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(mockFirebaseSignOut).toHaveBeenCalled();
      });
    });

    it('falls back gracefully when migration fails', async () => {
      mockSupabaseFunctions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Firebase token expired' },
      });

      // Should not throw
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(mockFirebaseSignOut).toHaveBeenCalled();
      });

      // setSession should NOT be called on error
      expect(mockSupabaseAuth.setSession).not.toHaveBeenCalled();
    });
  });

  describe('Supabase auth state', () => {
    it('uses onAuthStateChange instead of Firebase onAuthStateChanged', () => {
      renderHook(() => useAuth(), { wrapper });

      expect(mockSupabaseAuth.onAuthStateChange).toHaveBeenCalled();
    });

    it('keeps initializing=true until both session and profile are resolved', () => {
      // onAuthStateChange callback hasn't fired yet
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Should still be initializing since no auth state change has fired
      expect(result.current.initializing).toBe(true);
    });

    it('signOut calls supabase.auth.signOut', async () => {
      mockSupabaseAuth.signOut.mockResolvedValue({ error: null });

      // Trigger auth state change with a session to set user
      let authCallback;
      mockSupabaseAuth.onAuthStateChange.mockImplementation(cb => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Simulate signed-in state
      await act(async () => {
        authCallback('SIGNED_IN', {
          user: { id: 'user-1', phone: '+11234567890' },
          access_token: 'token',
        });
      });

      // Call signOut
      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSupabaseAuth.signOut).toHaveBeenCalled();
    });
  });
});
