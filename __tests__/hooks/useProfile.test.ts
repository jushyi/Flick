import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock supabase
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getSession: jest.fn() },
  },
}));

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { useProfile, useUpdateProfile } from '../../src/hooks/useProfile';
import { supabase } from '../../src/lib/supabase';

const mockFrom = supabase.from as jest.Mock;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function createWrapper() {
  const testClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: testClient }, children);
}

describe('useProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches profile data for given userId', async () => {
    const mockProfile = {
      id: 'user-123',
      username: 'testuser',
      display_name: 'Test User',
      profile_photo_path: null,
      friend_count: 5,
    };

    const mockSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }),
    });
    mockFrom.mockReturnValue({ select: mockSelect });

    const { result } = renderHook(() => useProfile('user-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockProfile);
    expect(mockFrom).toHaveBeenCalledWith('users');
  });

  it('is disabled when userId is empty string', () => {
    const { result } = renderHook(() => useProfile(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('throws on supabase error', async () => {
    const mockSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        }),
      }),
    });
    mockFrom.mockReturnValue({ select: mockSelect });

    const { result } = renderHook(() => useProfile('nonexistent'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateProfile', () => {
  it('calls supabase update with correct fields', async () => {
    const updatedProfile = {
      id: 'user-123',
      username: 'testuser',
      display_name: 'Updated Name',
    };

    const mockSingle = jest.fn().mockResolvedValue({ data: updatedProfile, error: null });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockEq = jest.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 'user-123', display_name: 'Updated Name' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockUpdate).toHaveBeenCalledWith({ display_name: 'Updated Name' });
    expect(mockEq).toHaveBeenCalledWith('id', 'user-123');
  });
});
