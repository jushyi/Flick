/**
 * Feed Service Tests (Supabase)
 *
 * Tests the feed RPC wrapper and photo-by-ID fetch with user data.
 * Supabase client is mocked inline (not via global __supabaseMocks).
 */

// =============================================================================
// Mock setup (hoisted by Jest)
// =============================================================================

const mockRpc = jest.fn();
const mockSingle = jest.fn();
const mockEq = jest.fn(() => ({ single: mockSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

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

import { getFeed, getPhotoByIdWithUser } from '../../src/services/supabase/feedService';

// =============================================================================
// Test data
// =============================================================================

const mockFeedRow = {
  id: 'photo-1',
  user_id: 'user-1',
  image_url: 'https://cdn.example.com/photo1.webp',
  thumbnail_data_url: 'data:image/webp;base64,abc',
  status: 'revealed',
  photo_state: 'journal',
  media_type: 'photo',
  caption: 'Great day',
  storage_path: 'photos/user-1/photo-1.webp',
  comment_count: 3,
  reaction_count: 5,
  created_at: '2026-03-24T10:00:00Z',
  username: 'testuser',
  display_name: 'Test User',
  profile_photo_path: 'photos/user-1/profile.webp',
  name_color: '#FF5733',
};

// =============================================================================
// Tests
// =============================================================================

describe('feedService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFeed', () => {
    it('calls supabase.rpc with correct params', async () => {
      mockRpc.mockResolvedValue({ data: [mockFeedRow], error: null });

      await getFeed({ userId: 'my-id', cursor: '2026-03-24T09:00:00Z', limit: 10 });

      expect(mockRpc).toHaveBeenCalledWith('get_feed', {
        p_user_id: 'my-id',
        p_cursor: '2026-03-24T09:00:00Z',
        p_limit: 10,
      });
    });

    it('maps snake_case RPC result to camelCase FeedPhoto', async () => {
      mockRpc.mockResolvedValue({ data: [mockFeedRow], error: null });

      const result = await getFeed({ userId: 'my-id' });

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-1');
      expect(result[0].imageUrl).toBe('https://cdn.example.com/photo1.webp');
      expect(result[0].thumbnailDataUrl).toBe('data:image/webp;base64,abc');
      expect(result[0].photoState).toBe('journal');
      expect(result[0].mediaType).toBe('photo');
      expect(result[0].storagePath).toBe('photos/user-1/photo-1.webp');
      expect(result[0].commentCount).toBe(3);
      expect(result[0].reactionCount).toBe(5);
      expect(result[0].createdAt).toBe('2026-03-24T10:00:00Z');
      expect(result[0].displayName).toBe('Test User');
      expect(result[0].profilePhotoPath).toBe('photos/user-1/profile.webp');
      expect(result[0].nameColor).toBe('#FF5733');
    });

    it('defaults limit to 20 and cursor to null', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      await getFeed({ userId: 'my-id' });

      expect(mockRpc).toHaveBeenCalledWith('get_feed', {
        p_user_id: 'my-id',
        p_cursor: null,
        p_limit: 20,
      });
    });

    it('throws on supabase error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'DB error' } });

      await expect(getFeed({ userId: 'my-id' })).rejects.toThrow('Failed to fetch feed: DB error');
    });
  });

  describe('getPhotoByIdWithUser', () => {
    it('returns FeedPhoto for valid photoId', async () => {
      const photoRow = {
        ...mockFeedRow,
        users: {
          username: 'testuser',
          display_name: 'Test User',
          profile_photo_path: 'photos/user-1/profile.webp',
          name_color: '#FF5733',
        },
      };

      mockSingle.mockResolvedValue({ data: photoRow, error: null });

      const result = await getPhotoByIdWithUser('photo-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('photo-1');
      expect(result!.username).toBe('testuser');
      expect(result!.displayName).toBe('Test User');
      expect(mockFrom).toHaveBeenCalledWith('photos');
    });

    it('returns null when photo not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      const result = await getPhotoByIdWithUser('missing-id');

      expect(result).toBeNull();
    });

    it('throws on non-404 error', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST500', message: 'Server error' },
      });

      await expect(getPhotoByIdWithUser('photo-1')).rejects.toThrow(
        'Failed to fetch photo: Server error',
      );
    });
  });
});
