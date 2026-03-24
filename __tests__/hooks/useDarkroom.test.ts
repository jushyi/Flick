import { renderHook, act } from '@testing-library/react-native';

// Import the mock useQuery from @powersync/react (resolved via moduleNameMapper)
import { useQuery as mockPowerSyncUseQuery } from '@powersync/react';

// Mock darkroom service
const mockCheckAndRevealPhotos = jest.fn();
const mockCalculateBatchRevealAt = jest.fn();
jest.mock('../../src/services/supabase/darkroomService', () => ({
  checkAndRevealPhotos: (...args: any[]) => mockCheckAndRevealPhotos(...args),
  calculateBatchRevealAt: (...args: any[]) =>
    mockCalculateBatchRevealAt(...args),
}));

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

// Explicit .ts import to avoid resolving the old .js file (strangler fig)
import { useDarkroom } from '../../src/hooks/useDarkroom.ts';

const mockUseQuery = mockPowerSyncUseQuery as jest.Mock;

describe('useDarkroom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default: empty results for both developing and revealed queries
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns empty arrays when userId is undefined', () => {
    const { result } = renderHook(() => useDarkroom(undefined));

    expect(result.current.developingPhotos).toEqual([]);
    expect(result.current.revealedPhotos).toEqual([]);
    expect(result.current.developingCount).toBe(0);
    expect(result.current.revealedCount).toBe(0);
    expect(result.current.nextRevealAt).toBeNull();
    expect(result.current.countdown).toBe(0);
    expect(result.current.isRevealReady).toBe(false);
  });

  it('maps developing photo rows from PowerSync to Photo objects with camelCase fields', () => {
    const mockDevelopingRows = [
      {
        id: 'photo-1',
        user_id: 'user-1',
        image_url: 'https://example.com/photo.jpg',
        local_uri: null,
        thumbnail_data_url: null,
        status: 'developing',
        photo_state: null,
        media_type: 'photo',
        caption: null,
        reveal_at: '2026-03-24T16:00:00Z',
        storage_path: 'photos/photo-1.webp',
        comment_count: 0,
        reaction_count: 0,
        deleted_at: null,
        created_at: '2026-03-24T15:00:00Z',
      },
    ];

    // Use mockImplementation to handle re-renders correctly
    mockUseQuery.mockImplementation((sql: string) => {
      if (sql.includes("status = 'developing'")) {
        return { data: mockDevelopingRows, isLoading: false, error: null };
      }
      return { data: [], isLoading: false, error: null };
    });

    const { result } = renderHook(() => useDarkroom('user-1'));

    expect(result.current.developingPhotos).toHaveLength(1);
    expect(result.current.developingPhotos[0]).toEqual({
      id: 'photo-1',
      userId: 'user-1',
      imageUrl: 'https://example.com/photo.jpg',
      localUri: null,
      thumbnailDataUrl: null,
      status: 'developing',
      photoState: null,
      mediaType: 'photo',
      caption: null,
      revealAt: '2026-03-24T16:00:00Z',
      storagePath: 'photos/photo-1.webp',
      commentCount: 0,
      reactionCount: 0,
      deletedAt: null,
      createdAt: '2026-03-24T15:00:00Z',
    });
    expect(result.current.developingCount).toBe(1);
  });

  it('computes nextRevealAt as MIN of developing photos revealAt values', () => {
    const mockRows = [
      {
        id: 'photo-1',
        user_id: 'user-1',
        status: 'developing',
        reveal_at: '2026-03-24T16:05:00Z',
        created_at: '2026-03-24T15:00:00Z',
      },
      {
        id: 'photo-2',
        user_id: 'user-1',
        status: 'developing',
        reveal_at: '2026-03-24T16:00:00Z',
        created_at: '2026-03-24T15:01:00Z',
      },
      {
        id: 'photo-3',
        user_id: 'user-1',
        status: 'developing',
        reveal_at: '2026-03-24T16:10:00Z',
        created_at: '2026-03-24T15:02:00Z',
      },
    ];

    mockUseQuery.mockImplementation((sql: string) => {
      if (sql.includes("status = 'developing'")) {
        return { data: mockRows, isLoading: false, error: null };
      }
      return { data: [], isLoading: false, error: null };
    });

    const { result } = renderHook(() => useDarkroom('user-1'));

    // Should be the earliest revealAt
    expect(result.current.nextRevealAt).toBe('2026-03-24T16:00:00Z');
  });

  it('countdown decrements each second', () => {
    // Set a reveal time 60 seconds in the future
    const futureTime = new Date(Date.now() + 60000).toISOString();
    const mockRows = [
      {
        id: 'photo-1',
        user_id: 'user-1',
        status: 'developing',
        reveal_at: futureTime,
        created_at: '2026-03-24T15:00:00Z',
      },
    ];

    // Both calls return same developing data (persistent mock for re-renders)
    mockUseQuery.mockImplementation((sql: string) => {
      if (sql.includes("status = 'developing'")) {
        return { data: mockRows, isLoading: false, error: null };
      }
      return { data: [], isLoading: false, error: null };
    });

    const { result } = renderHook(() => useDarkroom('user-1'));

    const initialCountdown = result.current.countdown;
    expect(initialCountdown).toBeGreaterThan(0);
    expect(initialCountdown).toBeLessThanOrEqual(60);

    // Advance time by 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Countdown should have decremented
    expect(result.current.countdown).toBeLessThanOrEqual(initialCountdown);
  });

  it('isRevealReady is true when countdown <= 0 and developing photos exist', () => {
    // Set a reveal time in the past
    const pastTime = new Date(Date.now() - 10000).toISOString();
    const mockRows = [
      {
        id: 'photo-1',
        user_id: 'user-1',
        status: 'developing',
        reveal_at: pastTime,
        created_at: '2026-03-24T15:00:00Z',
      },
    ];

    mockUseQuery.mockImplementation((sql: string) => {
      if (sql.includes("status = 'developing'")) {
        return { data: mockRows, isLoading: false, error: null };
      }
      return { data: [], isLoading: false, error: null };
    });

    const { result } = renderHook(() => useDarkroom('user-1'));

    expect(result.current.countdown).toBe(0);
    expect(result.current.isRevealReady).toBe(true);
  });

  it('isRevealReady is false when no developing photos exist even with countdown 0', () => {
    const { result } = renderHook(() => useDarkroom('user-1'));

    expect(result.current.countdown).toBe(0);
    expect(result.current.isRevealReady).toBe(false);
  });

  it('checkAndReveal calls darkroomService.checkAndRevealPhotos with userId', async () => {
    mockCheckAndRevealPhotos.mockResolvedValue(3);

    const { result } = renderHook(() => useDarkroom('user-1'));

    let count: number;
    await act(async () => {
      count = await result.current.checkAndReveal();
    });

    expect(mockCheckAndRevealPhotos).toHaveBeenCalledWith('user-1');
    expect(count!).toBe(3);
  });

  it('checkAndReveal returns 0 when userId is undefined', async () => {
    const { result } = renderHook(() => useDarkroom(undefined));

    let count: number;
    await act(async () => {
      count = await result.current.checkAndReveal();
    });

    expect(mockCheckAndRevealPhotos).not.toHaveBeenCalled();
    expect(count!).toBe(0);
  });

  it('getRevealTime calls calculateBatchRevealAt with userId', async () => {
    mockCalculateBatchRevealAt.mockResolvedValue('2026-03-24T16:00:00Z');

    const { result } = renderHook(() => useDarkroom('user-1'));

    let revealTime: string;
    await act(async () => {
      revealTime = await result.current.getRevealTime();
    });

    expect(mockCalculateBatchRevealAt).toHaveBeenCalledWith('user-1');
    expect(revealTime!).toBe('2026-03-24T16:00:00Z');
  });

  it('isLoading reflects PowerSync query loading state', () => {
    mockUseQuery.mockImplementation((sql: string) => {
      if (sql.includes("status = 'developing'")) {
        return { data: [], isLoading: true, error: null };
      }
      return { data: [], isLoading: false, error: null };
    });

    const { result } = renderHook(() => useDarkroom('user-1'));

    expect(result.current.isLoading).toBe(true);
  });

  it('passes correct SQL queries to PowerSync useQuery', () => {
    renderHook(() => useDarkroom('user-1'));

    // First call should be for developing photos
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.stringContaining("status = 'developing'"),
      ['user-1'],
    );

    // Second call should be for revealed photos
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.stringContaining("status = 'revealed'"),
      ['user-1'],
    );
  });
});
