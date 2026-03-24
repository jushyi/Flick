/**
 * Supabase Block Service Tests
 *
 * Tests block/unblock/query operations against Supabase blocks table.
 * Gets the same mocked supabase instance that the service uses.
 */

// Import the supabase instance (already mocked via jest.setup.js @supabase/supabase-js mock)
import { supabase } from '../../src/lib/supabase';
import * as blockService from '../../src/services/supabase/blockService';

const mockSupabase = supabase as any;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('blockUser', () => {
  it('inserts with correct blocker_id and blocked_id', async () => {
    const mockInsert = jest.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue({ insert: mockInsert });

    await blockService.blockUser('user-1', 'user-2');

    expect(mockSupabase.from).toHaveBeenCalledWith('blocks');
    expect(mockInsert).toHaveBeenCalledWith({
      blocker_id: 'user-1',
      blocked_id: 'user-2',
    });
  });

  it('throws on invalid IDs (empty blocker)', async () => {
    await expect(blockService.blockUser('', 'user-2')).rejects.toThrow(
      'Invalid user IDs'
    );
  });

  it('throws on invalid IDs (empty blocked)', async () => {
    await expect(blockService.blockUser('user-1', '')).rejects.toThrow(
      'Invalid user IDs'
    );
  });

  it('throws on Supabase error', async () => {
    const mockInsert = jest
      .fn()
      .mockResolvedValue({ error: { message: 'Duplicate key' } });
    mockSupabase.from.mockReturnValue({ insert: mockInsert });

    await expect(blockService.blockUser('user-1', 'user-2')).rejects.toThrow(
      'Duplicate key'
    );
  });
});

describe('unblockUser', () => {
  it('deletes with correct composite key', async () => {
    const mockEq2 = jest.fn().mockResolvedValue({ error: null });
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
    const mockDelete = jest.fn().mockReturnValue({ eq: mockEq1 });
    mockSupabase.from.mockReturnValue({ delete: mockDelete });

    await blockService.unblockUser('user-1', 'user-2');

    expect(mockSupabase.from).toHaveBeenCalledWith('blocks');
    expect(mockEq1).toHaveBeenCalledWith('blocker_id', 'user-1');
    expect(mockEq2).toHaveBeenCalledWith('blocked_id', 'user-2');
  });

  it('throws on Supabase error', async () => {
    const mockEq2 = jest
      .fn()
      .mockResolvedValue({ error: { message: 'Not found' } });
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
    const mockDelete = jest.fn().mockReturnValue({ eq: mockEq1 });
    mockSupabase.from.mockReturnValue({ delete: mockDelete });

    await expect(blockService.unblockUser('user-1', 'user-2')).rejects.toThrow(
      'Not found'
    );
  });
});

describe('getBlockedUsers', () => {
  it('queries with blocker_id and returns mapped results', async () => {
    const mockData = [
      {
        blocked_id: 'user-2',
        created_at: '2026-01-01T00:00:00Z',
        user: {
          username: 'alice',
          display_name: 'Alice',
          profile_photo_path: 'alice/profile.webp',
        },
      },
    ];

    const mockOrder = jest
      .fn()
      .mockReturnValue({ data: mockData, error: null });
    const mockEqBlocker = jest.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEqBlocker });
    mockSupabase.from.mockReturnValue({ select: mockSelect });

    const result = await blockService.getBlockedUsers('user-1');

    expect(mockSupabase.from).toHaveBeenCalledWith('blocks');
    expect(mockSelect).toHaveBeenCalledWith(
      'blocked_id, created_at, user:users!blocked_id(username, display_name, profile_photo_path)'
    );
    expect(mockEqBlocker).toHaveBeenCalledWith('blocker_id', 'user-1');
    expect(result).toEqual([
      {
        blockedId: 'user-2',
        createdAt: '2026-01-01T00:00:00Z',
        user: {
          username: 'alice',
          displayName: 'Alice',
          profilePhotoPath: 'alice/profile.webp',
        },
      },
    ]);
  });

  it('returns empty array when no blocks exist', async () => {
    const mockOrder = jest.fn().mockReturnValue({ data: [], error: null });
    const mockEqBlocker = jest.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEqBlocker });
    mockSupabase.from.mockReturnValue({ select: mockSelect });

    const result = await blockService.getBlockedUsers('user-1');
    expect(result).toEqual([]);
  });
});

describe('isBlocked', () => {
  it('returns true when block exists', async () => {
    const mockMaybeSingle = jest
      .fn()
      .mockResolvedValue({ data: { blocker_id: 'user-1' }, error: null });
    const mockEq2 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 });
    mockSupabase.from.mockReturnValue({ select: mockSelect });

    const result = await blockService.isBlocked('user-1', 'user-2');

    expect(result).toBe(true);
    expect(mockSelect).toHaveBeenCalledWith('blocker_id');
  });

  it('returns false when block does not exist', async () => {
    const mockMaybeSingle = jest
      .fn()
      .mockResolvedValue({ data: null, error: null });
    const mockEq2 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 });
    mockSupabase.from.mockReturnValue({ select: mockSelect });

    const result = await blockService.isBlocked('user-1', 'user-2');

    expect(result).toBe(false);
  });
});
