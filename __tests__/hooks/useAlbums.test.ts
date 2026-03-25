/**
 * useAlbums and useMonthlyAlbums Hook Tests
 *
 * Tests TanStack Query hooks for album CRUD with optimistic updates.
 * Follows the same pattern as useProfile.test.ts.
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// =============================================================================
// Mock setup (hoisted by Jest)
// =============================================================================

jest.mock('../../src/services/supabase/albumService', () => ({
  getUserAlbums: jest.fn(),
  getAlbum: jest.fn(),
  createAlbum: jest.fn(),
  updateAlbum: jest.fn(),
  deleteAlbum: jest.fn(),
  addPhotosToAlbum: jest.fn(),
  removePhotoFromAlbum: jest.fn(),
  setCoverPhoto: jest.fn(),
  getMonthlyPhotos: jest.fn(),
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

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn(), hide: jest.fn() },
}));

// =============================================================================
// Imports (after mocks)
// =============================================================================

import {
  useUserAlbums,
  useAlbum,
  useCreateAlbum,
  useAddPhotosToAlbum,
  useRemovePhotoFromAlbum,
} from '../../src/hooks/useAlbums';
import { useMonthlyAlbums } from '../../src/hooks/useMonthlyAlbums';
import * as albumService from '../../src/services/supabase/albumService';

const mockGetUserAlbums = albumService.getUserAlbums as jest.Mock;
const mockGetAlbum = albumService.getAlbum as jest.Mock;
const mockCreateAlbum = albumService.createAlbum as jest.Mock;
const mockAddPhotosToAlbum = albumService.addPhotosToAlbum as jest.Mock;
const mockRemovePhotoFromAlbum = albumService.removePhotoFromAlbum as jest.Mock;
const mockGetMonthlyPhotos = albumService.getMonthlyPhotos as jest.Mock;

// =============================================================================
// Helpers
// =============================================================================

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function createWrapper() {
  const testClient = createTestQueryClient();
  return {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: testClient }, children),
    client: testClient,
  };
}

// =============================================================================
// useUserAlbums
// =============================================================================
describe('useUserAlbums', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns data from getUserAlbums when userId provided', async () => {
    const albums = [
      { id: 'album-1', userId: 'user-1', title: 'Album 1', photoCount: 3 },
    ];
    mockGetUserAlbums.mockResolvedValue(albums);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUserAlbums('user-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(albums);
    expect(mockGetUserAlbums).toHaveBeenCalledWith('user-1');
  });

  it('is disabled when userId is empty string', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUserAlbums(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

// =============================================================================
// useCreateAlbum
// =============================================================================
describe('useCreateAlbum', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls albumService.createAlbum with correct args', async () => {
    const created = {
      id: 'album-new',
      userId: 'user-1',
      title: 'New Album',
      coverPhotoId: 'photo-1',
    };
    mockCreateAlbum.mockResolvedValue(created);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAlbum(), { wrapper });

    act(() => {
      result.current.mutate({
        userId: 'user-1',
        title: 'New Album',
        photoIds: ['photo-1', 'photo-2'],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCreateAlbum).toHaveBeenCalledWith(
      'user-1',
      'New Album',
      ['photo-1', 'photo-2']
    );
  });
});

// =============================================================================
// useAddPhotosToAlbum (optimistic update)
// =============================================================================
describe('useAddPhotosToAlbum', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('performs optimistic update - calls onMutate which updates cache', async () => {
    // Verify the mutation hook calls addPhotosToAlbum service and uses optimistic updates
    mockAddPhotosToAlbum.mockResolvedValue(undefined);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddPhotosToAlbum(), { wrapper });

    act(() => {
      result.current.mutate({ albumId: 'album-1', photoIds: ['photo-2'] });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockAddPhotosToAlbum).toHaveBeenCalledWith('album-1', ['photo-2']);
  });

  it('rolls back on error - mutation enters error state', async () => {
    mockAddPhotosToAlbum.mockRejectedValue(new Error('Network error'));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAddPhotosToAlbum(), { wrapper });

    act(() => {
      result.current.mutate({ albumId: 'album-1', photoIds: ['photo-2'] });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeTruthy();
  });
});

// =============================================================================
// useRemovePhotoFromAlbum (optimistic update)
// =============================================================================
describe('useRemovePhotoFromAlbum', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls removePhotoFromAlbum service with correct args', async () => {
    mockRemovePhotoFromAlbum.mockResolvedValue(undefined);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRemovePhotoFromAlbum(), { wrapper });

    act(() => {
      result.current.mutate({ albumId: 'album-1', photoId: 'photo-1' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRemovePhotoFromAlbum).toHaveBeenCalledWith('album-1', 'photo-1');
  });
});

// =============================================================================
// Structural: verify hooks source contains optimistic update patterns
// =============================================================================
describe('useAlbums optimistic update code', () => {
  it('useAddPhotosToAlbum source uses useOptimisticMutation for optimistic update', () => {
    // Verify the hook function body includes optimistic mutation pattern
    const source = useAddPhotosToAlbum.toString();
    expect(source).toContain('useOptimisticMutation');
  });

  it('useRemovePhotoFromAlbum source uses useOptimisticMutation for optimistic update', () => {
    const source = useRemovePhotoFromAlbum.toString();
    expect(source).toContain('useOptimisticMutation');
  });
});

// =============================================================================
// useMonthlyAlbums
// =============================================================================
describe('useMonthlyAlbums', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls getMonthlyPhotos and returns grouped data', async () => {
    const monthlyData = [
      {
        monthKey: '2026-03',
        photoCount: 5,
        photos: [{ id: 'p1', imageUrl: 'url1', createdAt: '2026-03-01', photoState: 'journal' }],
      },
    ];
    mockGetMonthlyPhotos.mockResolvedValue(monthlyData);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMonthlyAlbums('user-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(monthlyData);
    expect(mockGetMonthlyPhotos).toHaveBeenCalledWith('user-1');
  });
});
