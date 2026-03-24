/**
 * Friendship Service Tests (Supabase/PowerSync)
 *
 * Tests all friendship CRUD operations via PowerSync local SQLite writes.
 * Mock pattern: jest.mock the PowerSync database module, verify SQL and params.
 */

// Mock PowerSync database before any imports
const mockExecute = jest.fn();
const mockGetAll = jest.fn();

// Mock both possible resolution paths for the database module
jest.mock('../../src/lib/powersync/database', () => ({
  powerSyncDb: {
    execute: mockExecute,
    getAll: mockGetAll,
  },
  getPowerSyncDb: () => ({
    execute: mockExecute,
    getAll: mockGetAll,
  }),
}));

// Dynamic import after mocks are in place
let friendshipService: typeof import('../../src/services/supabase/friendshipService');

beforeAll(() => {
  friendshipService = require('../../src/services/supabase/friendshipService');
});

beforeEach(() => {
  jest.clearAllMocks();
  mockExecute.mockResolvedValue({ rows: { _array: [] } });
  mockGetAll.mockResolvedValue([]);
});

describe('sendFriendRequest', () => {
  it('sorts user IDs so user1_id < user2_id and inserts with pending status', async () => {
    const result = await friendshipService.sendFriendRequest('zzz-user', 'aaa-user');

    expect(mockExecute).toHaveBeenCalledTimes(1);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain('INSERT INTO friendships');
    expect(sql).toContain('pending');
    // user1_id should be 'aaa-user' (sorted first)
    expect(params[1]).toBe('aaa-user');
    expect(params[2]).toBe('zzz-user');
    // initiated_by should be the original fromUserId
    expect(params[3]).toBe('zzz-user');

    expect(result).toMatchObject({
      user1Id: 'aaa-user',
      user2Id: 'zzz-user',
      status: 'pending',
      initiatedBy: 'zzz-user',
    });
    expect(result.id).toBeDefined();
  });

  it('handles already-sorted IDs correctly', async () => {
    const result = await friendshipService.sendFriendRequest('aaa-user', 'zzz-user');

    const [, params] = mockExecute.mock.calls[0];
    expect(params[1]).toBe('aaa-user');
    expect(params[2]).toBe('zzz-user');
    expect(params[3]).toBe('aaa-user');
    expect(result.initiatedBy).toBe('aaa-user');
  });
});

describe('acceptFriendRequest', () => {
  it('updates friendship status to accepted', async () => {
    await friendshipService.acceptFriendRequest('friendship-123');

    expect(mockExecute).toHaveBeenCalledTimes(1);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain('UPDATE friendships');
    expect(sql).toContain("status = 'accepted'");
    expect(params).toContain('friendship-123');
  });
});

describe('declineFriendRequest', () => {
  it('deletes the friendship record', async () => {
    await friendshipService.declineFriendRequest('friendship-456');

    expect(mockExecute).toHaveBeenCalledTimes(1);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain('DELETE FROM friendships');
    expect(params).toContain('friendship-456');
  });
});

describe('unfriend', () => {
  it('deletes the friendship record', async () => {
    await friendshipService.unfriend('friendship-789');

    expect(mockExecute).toHaveBeenCalledTimes(1);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain('DELETE FROM friendships');
    expect(params).toContain('friendship-789');
  });
});

describe('getFriends', () => {
  it('queries accepted friendships and extracts friend user IDs', async () => {
    mockGetAll.mockResolvedValue([
      { id: 'f1', user1_id: 'me', user2_id: 'friend-a', created_at: '2026-01-01' },
      { id: 'f2', user1_id: 'friend-b', user2_id: 'me', created_at: '2026-01-02' },
    ]);

    const result = await friendshipService.getFriends('me');

    expect(mockGetAll).toHaveBeenCalledTimes(1);
    const [sql, params] = mockGetAll.mock.calls[0];
    expect(sql).toContain("status = 'accepted'");
    expect(sql).toContain('user1_id = ?');
    expect(sql).toContain('user2_id = ?');
    expect(params).toEqual(['me', 'me']);

    expect(result).toEqual([
      { id: 'f1', friendUserId: 'friend-a', createdAt: '2026-01-01' },
      { id: 'f2', friendUserId: 'friend-b', createdAt: '2026-01-02' },
    ]);
  });
});

describe('getPendingRequests', () => {
  it('queries pending friendships not initiated by the user', async () => {
    mockGetAll.mockResolvedValue([
      {
        id: 'f1',
        user1_id: 'me',
        user2_id: 'requester',
        initiated_by: 'requester',
        created_at: '2026-01-01',
      },
    ]);

    const result = await friendshipService.getPendingRequests('me');

    expect(mockGetAll).toHaveBeenCalledTimes(1);
    const [sql, params] = mockGetAll.mock.calls[0];
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain('initiated_by != ?');
    expect(params[0]).toBe('me');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'f1',
      initiatedBy: 'requester',
    });
  });
});

describe('getSentRequests', () => {
  it('queries pending friendships initiated by the user', async () => {
    mockGetAll.mockResolvedValue([
      {
        id: 'f1',
        user1_id: 'me',
        user2_id: 'target',
        initiated_by: 'me',
        created_at: '2026-01-01',
      },
    ]);

    const result = await friendshipService.getSentRequests('me');

    expect(mockGetAll).toHaveBeenCalledTimes(1);
    const [sql, params] = mockGetAll.mock.calls[0];
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain('initiated_by = ?');
    expect(params).toContain('me');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'f1',
      initiatedBy: 'me',
    });
  });
});

describe('getFriendshipStatus', () => {
  it('sorts IDs before querying and returns status', async () => {
    mockGetAll.mockResolvedValue([{ status: 'accepted' }]);

    const result = await friendshipService.getFriendshipStatus('zzz-user', 'aaa-user');

    expect(mockGetAll).toHaveBeenCalledTimes(1);
    const [sql, params] = mockGetAll.mock.calls[0];
    expect(sql).toContain('user1_id = ?');
    expect(sql).toContain('user2_id = ?');
    // Should be sorted
    expect(params).toEqual(['aaa-user', 'zzz-user']);

    expect(result).toBe('accepted');
  });

  it('returns null when no friendship exists', async () => {
    mockGetAll.mockResolvedValue([]);

    const result = await friendshipService.getFriendshipStatus('user-a', 'user-b');

    expect(result).toBeNull();
  });
});

describe('getFriendIds', () => {
  it('returns array of friend user IDs for accepted friendships', async () => {
    mockGetAll.mockResolvedValue([
      { user1_id: 'me', user2_id: 'friend-a' },
      { user1_id: 'friend-b', user2_id: 'me' },
    ]);

    const result = await friendshipService.getFriendIds('me');

    expect(mockGetAll).toHaveBeenCalledTimes(1);
    const [sql, params] = mockGetAll.mock.calls[0];
    expect(sql).toContain("status = 'accepted'");
    expect(params).toEqual(['me', 'me']);

    expect(result).toEqual(['friend-a', 'friend-b']);
  });

  it('returns empty array when user has no friends', async () => {
    mockGetAll.mockResolvedValue([]);

    const result = await friendshipService.getFriendIds('lonely-user');

    expect(result).toEqual([]);
  });
});
