/**
 * Profile Service Tests (Supabase)
 *
 * Tests user profile CRUD, username availability check, and daily photo count.
 * Supabase client is mocked inline with chainable builder pattern.
 */

// =============================================================================
// Mock setup (hoisted by Jest)
// =============================================================================

const mockRpc = jest.fn();
const mockSingle = jest.fn();
const mockLimit = jest.fn(() => ({ data: [], error: null }));

// Chainable builder that returns itself for chaining, with terminal methods
const createChainableMock = () => {
  const chain: any = {
    select: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    limit: jest.fn(() => mockLimit()),
    single: jest.fn(() => mockSingle()),
  };
  return chain;
};

const mockChain = createChainableMock();
const mockFrom = jest.fn(() => mockChain);

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Logger mock
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// =============================================================================
// Imports (after mocks)
// =============================================================================

import {
  getUserProfile,
  updateUserProfile,
  checkUsernameAvailability,
  getDailyPhotoCount,
  incrementDailyPhotoCount,
  mapToUserProfile,
} from '../../src/services/supabase/profileService';

// =============================================================================
// Test data
// =============================================================================

const mockUserRow = {
  id: 'user-1',
  display_name: 'Test User',
  username: 'testuser',
  bio: 'Hello world',
  profile_photo_path: 'photos/user-1/profile.webp',
  selects: ['nature', 'food'],
  song: { title: 'Test Song', artist: 'Test Artist' },
  pinned_snap_data: null,
  friend_count: 42,
  name_color: '#FF5733',
  daily_photo_count: 5,
  last_photo_date: '2026-03-24',
  profile_setup_completed: true,
  read_receipts_enabled: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-03-24T10:00:00Z',
};

// =============================================================================
// Tests
// =============================================================================

describe('profileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('mapToUserProfile', () => {
    it('maps snake_case row to camelCase UserProfile', () => {
      const profile = mapToUserProfile(mockUserRow);

      expect(profile.id).toBe('user-1');
      expect(profile.displayName).toBe('Test User');
      expect(profile.username).toBe('testuser');
      expect(profile.bio).toBe('Hello world');
      expect(profile.profilePhotoPath).toBe('photos/user-1/profile.webp');
      expect(profile.selects).toEqual(['nature', 'food']);
      expect(profile.song).toEqual({ title: 'Test Song', artist: 'Test Artist' });
      expect(profile.pinnedSnapData).toBeNull();
      expect(profile.friendCount).toBe(42);
      expect(profile.nameColor).toBe('#FF5733');
      expect(profile.dailyPhotoCount).toBe(5);
      expect(profile.lastPhotoDate).toBe('2026-03-24');
      expect(profile.profileSetupCompleted).toBe(true);
      expect(profile.readReceiptsEnabled).toBe(true);
      expect(profile.createdAt).toBe('2026-01-01T00:00:00Z');
      expect(profile.updatedAt).toBe('2026-03-24T10:00:00Z');
    });
  });

  describe('getUserProfile', () => {
    it('fetches user by id and maps to camelCase UserProfile', async () => {
      mockChain.single.mockResolvedValueOnce({ data: mockUserRow, error: null });

      const profile = await getUserProfile('user-1');

      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(profile.displayName).toBe('Test User');
      expect(profile.friendCount).toBe(42);
    });

    it('throws when user not found', async () => {
      mockChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Row not found' },
      });

      await expect(getUserProfile('missing-id')).rejects.toThrow(
        'Failed to fetch user profile: Row not found',
      );
    });
  });

  describe('updateUserProfile', () => {
    it('maps camelCase input to snake_case, sends update, returns updated profile', async () => {
      mockChain.single.mockResolvedValueOnce({
        data: { ...mockUserRow, display_name: 'New Name' },
        error: null,
      });

      const result = await updateUserProfile('user-1', { displayName: 'New Name' });

      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ display_name: 'New Name' }),
      );
      expect(result.displayName).toBe('New Name');
    });

    it('throws on error', async () => {
      mockChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Update failed' },
      });

      await expect(
        updateUserProfile('user-1', { bio: 'new bio' }),
      ).rejects.toThrow('Failed to update user profile: Update failed');
    });
  });

  describe('checkUsernameAvailability', () => {
    it('returns true when username is available', async () => {
      mockLimit.mockReturnValueOnce({ data: [], error: null });

      const result = await checkUsernameAvailability('newuser');

      expect(result).toBe(true);
      expect(mockChain.eq).toHaveBeenCalledWith('username', 'newuser');
    });

    it('returns true when only match is currentUserId', async () => {
      mockLimit.mockReturnValueOnce({ data: [{ id: 'my-id' }], error: null });

      const result = await checkUsernameAvailability('myuser', 'my-id');

      expect(result).toBe(true);
    });

    it('returns false when username is taken by another user', async () => {
      mockLimit.mockReturnValueOnce({ data: [{ id: 'other-id' }], error: null });

      const result = await checkUsernameAvailability('takenuser');

      expect(result).toBe(false);
    });

    it('normalizes username to lowercase and trimmed', async () => {
      mockLimit.mockReturnValueOnce({ data: [], error: null });

      await checkUsernameAvailability('  MyUser  ');

      expect(mockChain.eq).toHaveBeenCalledWith('username', 'myuser');
    });

    it('throws on error', async () => {
      mockLimit.mockReturnValueOnce({ data: null, error: { message: 'DB error' } });

      await expect(checkUsernameAvailability('test')).rejects.toThrow(
        'Failed to check username availability: DB error',
      );
    });
  });

  describe('getDailyPhotoCount', () => {
    it('returns 0 when last_photo_date is not today', async () => {
      mockChain.single.mockResolvedValueOnce({
        data: { daily_photo_count: 5, last_photo_date: '2026-03-23' },
        error: null,
      });

      const result = await getDailyPhotoCount('user-1');

      expect(result.count).toBe(0);
      expect(result.limitReached).toBe(false);
    });

    it('returns actual count when last_photo_date is today', async () => {
      const today = new Date().toISOString().split('T')[0];
      mockChain.single.mockResolvedValueOnce({
        data: { daily_photo_count: 35, last_photo_date: today },
        error: null,
      });

      const result = await getDailyPhotoCount('user-1');

      expect(result.count).toBe(35);
      expect(result.limitReached).toBe(false);
    });

    it('returns limitReached true when count >= 36', async () => {
      const today = new Date().toISOString().split('T')[0];
      mockChain.single.mockResolvedValueOnce({
        data: { daily_photo_count: 36, last_photo_date: today },
        error: null,
      });

      const result = await getDailyPhotoCount('user-1');

      expect(result.count).toBe(36);
      expect(result.limitReached).toBe(true);
    });

    it('throws on error', async () => {
      mockChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Query failed' },
      });

      await expect(getDailyPhotoCount('user-1')).rejects.toThrow(
        'Failed to get daily photo count: Query failed',
      );
    });
  });

  describe('incrementDailyPhotoCount', () => {
    it('calls supabase.rpc and returns new count', async () => {
      mockRpc.mockResolvedValue({ data: 6, error: null });

      const result = await incrementDailyPhotoCount('user-1');

      expect(mockRpc).toHaveBeenCalledWith('increment_daily_photo_count', {
        p_user_id: 'user-1',
      });
      expect(result).toBe(6);
    });

    it('throws on error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Limit reached' },
      });

      await expect(incrementDailyPhotoCount('user-1')).rejects.toThrow(
        'Failed to increment daily photo count: Limit reached',
      );
    });
  });
});
