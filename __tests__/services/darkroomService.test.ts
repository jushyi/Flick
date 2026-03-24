/**
 * Darkroom Service Tests (Supabase + PowerSync)
 *
 * Tests reveal logic, batch coordination, and photo queries.
 * PowerSync db is mocked for all operations.
 */

// =============================================================================
// Mock setup (hoisted by Jest)
// =============================================================================

const mockExecute = jest.fn().mockResolvedValue(undefined);
const mockGetAll = jest.fn().mockResolvedValue([]);
const mockGet = jest.fn().mockResolvedValue(null);

const mockDb = {
  execute: mockExecute,
  getAll: mockGetAll,
  get: mockGet,
};

jest.mock('@/lib/powersync/PowerSyncProvider', () => ({
  getPowerSyncDb: jest.fn(() => mockDb),
}));

// Mock supabase (required by photoService import chain)
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: jest.fn().mockResolvedValue({ error: null }),
      delete: jest.fn(() => ({ match: jest.fn().mockResolvedValue({ error: null }) })),
    })),
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
  checkAndRevealPhotos,
  getNextRevealTime,
  calculateBatchRevealAt,
  getDevelopingPhotos,
  getRevealedPhotos,
} from '../../src/services/supabase/darkroomService';

import { getPowerSyncDb } from '@/lib/powersync/PowerSyncProvider';

// =============================================================================
// Test data
// =============================================================================

const MOCK_DEVELOPING_ROW = {
  id: 'photo-1',
  user_id: 'user-456',
  image_url: null,
  local_uri: 'file:///local/photo1.jpg',
  thumbnail_data_url: 'data:image/webp;base64,abc',
  status: 'developing',
  photo_state: null,
  media_type: 'photo',
  caption: null,
  reveal_at: '2026-03-24T14:55:00.000Z',
  storage_path: null,
  comment_count: 0,
  reaction_count: 0,
  deleted_at: null,
  created_at: '2026-03-24T14:50:00.000Z',
};

// =============================================================================
// Tests
// =============================================================================

describe('darkroomService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute.mockResolvedValue(undefined);
    mockGetAll.mockResolvedValue([]);
    mockGet.mockResolvedValue(null);
    (getPowerSyncDb as jest.Mock).mockReturnValue(mockDb);
  });

  // ---------------------------------------------------------------------------
  // checkAndRevealPhotos
  // ---------------------------------------------------------------------------

  describe('checkAndRevealPhotos', () => {
    it('finds photos with reveal_at <= now and updates status to revealed', async () => {
      mockGetAll.mockResolvedValueOnce([{ id: 'p1' }, { id: 'p2' }]);

      const count = await checkAndRevealPhotos('user-456');

      expect(count).toBe(2);

      // Should query for developing photos with reveal_at <= now
      expect(mockGetAll).toHaveBeenCalledTimes(1);
      const [sql, params] = mockGetAll.mock.calls[0];
      expect(sql).toContain('status = ?');
      expect(sql).toContain('reveal_at <= ?');
      expect(params[0]).toBe('user-456');
      expect(params[1]).toBe('developing');

      // Should update each photo to revealed
      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(mockExecute.mock.calls[0][0]).toContain("UPDATE photos SET status = ?");
      expect(mockExecute.mock.calls[0][1]).toEqual(['revealed', 'p1']);
      expect(mockExecute.mock.calls[1][1]).toEqual(['revealed', 'p2']);
    });

    it('returns 0 when no photos are ready', async () => {
      mockGetAll.mockResolvedValueOnce([]);

      const count = await checkAndRevealPhotos('user-456');

      expect(count).toBe(0);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('throws when PowerSync db is null', async () => {
      (getPowerSyncDb as jest.Mock).mockReturnValue(null);

      await expect(checkAndRevealPhotos('user-456')).rejects.toThrow(
        'PowerSync database not initialized',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getNextRevealTime
  // ---------------------------------------------------------------------------

  describe('getNextRevealTime', () => {
    it('returns MIN(reveal_at) from developing photos', async () => {
      mockGet.mockResolvedValueOnce({ next_reveal: '2026-03-24T15:05:00.000Z' });

      const result = await getNextRevealTime('user-456');

      expect(result).toBe('2026-03-24T15:05:00.000Z');
      expect(mockGet).toHaveBeenCalledTimes(1);
      const [sql, params] = mockGet.mock.calls[0];
      expect(sql).toContain('MIN(reveal_at)');
      expect(sql).toContain('status = ?');
      expect(params[0]).toBe('user-456');
      expect(params[1]).toBe('developing');
    });

    it('returns null when no developing photos', async () => {
      mockGet.mockResolvedValueOnce({ next_reveal: null });

      const result = await getNextRevealTime('user-456');

      expect(result).toBeNull();
    });

    it('returns null when query returns null result', async () => {
      mockGet.mockResolvedValueOnce(null);

      const result = await getNextRevealTime('user-456');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // calculateBatchRevealAt
  // ---------------------------------------------------------------------------

  describe('calculateBatchRevealAt', () => {
    it('returns existing batch reveal_at when developing photos exist', async () => {
      mockGet.mockResolvedValueOnce({
        batch_reveal_at: '2026-03-24T15:05:00.000Z',
      });

      const result = await calculateBatchRevealAt('user-456');

      expect(result).toBe('2026-03-24T15:05:00.000Z');
      // Should NOT generate a new timestamp
    });

    it('generates new 0-5 min timestamp when no existing batch', async () => {
      mockGet.mockResolvedValueOnce({ batch_reveal_at: null });

      const before = Date.now();
      const result = await calculateBatchRevealAt('user-456');
      const after = Date.now();

      const resultTime = new Date(result).getTime();
      // Should be between now and now + 5 minutes
      expect(resultTime).toBeGreaterThanOrEqual(before);
      expect(resultTime).toBeLessThanOrEqual(after + 5 * 60 * 1000);
    });

    it('throws when PowerSync db is null', async () => {
      (getPowerSyncDb as jest.Mock).mockReturnValue(null);

      await expect(calculateBatchRevealAt('user-456')).rejects.toThrow(
        'PowerSync database not initialized',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getDevelopingPhotos
  // ---------------------------------------------------------------------------

  describe('getDevelopingPhotos', () => {
    it('returns photos with status=developing mapped through mapToPhoto', async () => {
      mockGetAll.mockResolvedValueOnce([MOCK_DEVELOPING_ROW]);

      const photos = await getDevelopingPhotos('user-456');

      expect(photos).toHaveLength(1);
      expect(photos[0].id).toBe('photo-1');
      expect(photos[0].userId).toBe('user-456');
      expect(photos[0].status).toBe('developing');
      expect(photos[0].imageUrl).toBeNull();

      const [sql, params] = mockGetAll.mock.calls[0];
      expect(sql).toContain("status = ?");
      expect(params[1]).toBe('developing');
      expect(sql).toContain('deleted_at IS NULL');
      expect(sql).toContain('ORDER BY created_at DESC');
    });

    it('returns empty array when no developing photos', async () => {
      const photos = await getDevelopingPhotos('user-456');
      expect(photos).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getRevealedPhotos
  // ---------------------------------------------------------------------------

  describe('getRevealedPhotos', () => {
    it('returns photos with status=revealed', async () => {
      const revealedRow = { ...MOCK_DEVELOPING_ROW, status: 'revealed', image_url: 'https://cdn.example.com/photo.webp' };
      mockGetAll.mockResolvedValueOnce([revealedRow]);

      const photos = await getRevealedPhotos('user-456');

      expect(photos).toHaveLength(1);
      expect(photos[0].status).toBe('revealed');
      expect(photos[0].imageUrl).toBe('https://cdn.example.com/photo.webp');

      const [sql, params] = mockGetAll.mock.calls[0];
      expect(params[1]).toBe('revealed');
    });
  });
});
