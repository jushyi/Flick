/**
 * Photo Service Tests (Supabase + PowerSync)
 *
 * Tests all photo CRUD, triage, and reaction operations.
 * PowerSync db is mocked; Supabase client uses global __supabaseMocks from jest.setup.js.
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
  createPhotoRecord,
  updatePhotoAfterUpload,
  triagePhoto,
  batchTriagePhotos,
  softDeletePhoto,
  restorePhoto,
  getUserPhotos,
  getPhotoById,
  updatePhotoCaption,
  addReaction,
  removeReaction,
  mapToPhoto,
} from '../../src/services/supabase/photoService';

import { getPowerSyncDb } from '@/lib/powersync/PowerSyncProvider';
import { supabase } from '@/lib/supabase';

// =============================================================================
// Reaction mock helpers
// =============================================================================

let mockUpsert: jest.Mock;
let mockDeleteMatch: jest.Mock;
let mockDeleteFn: jest.Mock;
let mockSupabaseFrom: jest.Mock;

// =============================================================================
// Test data
// =============================================================================

const MOCK_PHOTO_ROW = {
  id: 'photo-123',
  user_id: 'user-456',
  image_url: 'https://cdn.example.com/photo.webp',
  local_uri: 'file:///local/photo.jpg',
  thumbnail_data_url: 'data:image/webp;base64,abc',
  status: 'revealed',
  photo_state: 'journal',
  media_type: 'photo',
  caption: 'Test caption',
  reveal_at: '2026-03-24T15:00:00.000Z',
  storage_path: 'photos/user-456/photo-123.webp',
  comment_count: 3,
  reaction_count: 5,
  deleted_at: null,
  created_at: '2026-03-24T14:55:00.000Z',
};

// =============================================================================
// Tests
// =============================================================================

describe('photoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute.mockResolvedValue(undefined);
    mockGetAll.mockResolvedValue([]);
    mockGet.mockResolvedValue(null);
    (getPowerSyncDb as jest.Mock).mockReturnValue(mockDb);

    // Configure supabase.from() mock for reaction tests
    mockUpsert = jest.fn().mockResolvedValue({ error: null });
    mockDeleteMatch = jest.fn().mockResolvedValue({ error: null });
    mockDeleteFn = jest.fn(() => ({ match: mockDeleteMatch }));
    mockSupabaseFrom = (supabase as any).from as jest.Mock;
    mockSupabaseFrom.mockImplementation((table: string) => ({
      upsert: mockUpsert,
      delete: mockDeleteFn,
    }));
  });

  // ---------------------------------------------------------------------------
  // mapToPhoto
  // ---------------------------------------------------------------------------

  describe('mapToPhoto', () => {
    it('converts snake_case row to camelCase Photo', () => {
      const photo = mapToPhoto(MOCK_PHOTO_ROW);

      expect(photo.id).toBe('photo-123');
      expect(photo.userId).toBe('user-456');
      expect(photo.imageUrl).toBe('https://cdn.example.com/photo.webp');
      expect(photo.localUri).toBe('file:///local/photo.jpg');
      expect(photo.thumbnailDataUrl).toBe('data:image/webp;base64,abc');
      expect(photo.status).toBe('revealed');
      expect(photo.photoState).toBe('journal');
      expect(photo.mediaType).toBe('photo');
      expect(photo.caption).toBe('Test caption');
      expect(photo.revealAt).toBe('2026-03-24T15:00:00.000Z');
      expect(photo.storagePath).toBe('photos/user-456/photo-123.webp');
      expect(photo.commentCount).toBe(3);
      expect(photo.reactionCount).toBe(5);
      expect(photo.deletedAt).toBeNull();
      expect(photo.createdAt).toBe('2026-03-24T14:55:00.000Z');
    });

    it('defaults null fields gracefully', () => {
      const photo = mapToPhoto({
        id: 'p1',
        user_id: 'u1',
        status: 'developing',
        created_at: '2026-03-24T14:55:00.000Z',
      });

      expect(photo.imageUrl).toBeNull();
      expect(photo.localUri).toBeNull();
      expect(photo.thumbnailDataUrl).toBeNull();
      expect(photo.photoState).toBeNull();
      expect(photo.mediaType).toBe('photo');
      expect(photo.caption).toBeNull();
      expect(photo.commentCount).toBe(0);
      expect(photo.reactionCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // createPhotoRecord
  // ---------------------------------------------------------------------------

  describe('createPhotoRecord', () => {
    it('inserts row with status=developing, photo_state=NULL, image_url=NULL', async () => {
      await createPhotoRecord(
        'user-456',
        'photo-123',
        'file:///local/photo.jpg',
        '2026-03-24T15:05:00.000Z',
        'photo',
        'data:image/webp;base64,thumb',
      );

      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('INSERT INTO photos');
      expect(params[0]).toBe('photo-123'); // id
      expect(params[1]).toBe('user-456'); // user_id
      expect(params[2]).toBe('developing'); // status
      expect(params[3]).toBeNull(); // photo_state
      expect(params[4]).toBe('file:///local/photo.jpg'); // local_uri
      expect(params[5]).toBeNull(); // image_url
      expect(params[6]).toBeNull(); // storage_path
      expect(params[7]).toBe('data:image/webp;base64,thumb'); // thumbnail_data_url
      expect(params[8]).toBe('2026-03-24T15:05:00.000Z'); // reveal_at
      expect(params[9]).toBe('photo'); // media_type
      expect(params[10]).toBeNull(); // caption
      expect(params[11]).toBe(0); // comment_count
      expect(params[12]).toBe(0); // reaction_count
      expect(params[13]).toBeNull(); // deleted_at
      expect(typeof params[14]).toBe('string'); // created_at (ISO string)
    });

    it('throws when PowerSync db is null', async () => {
      (getPowerSyncDb as jest.Mock).mockReturnValue(null);

      await expect(
        createPhotoRecord('user-456', 'photo-123', 'file:///photo.jpg', '2026-03-24T15:05:00.000Z'),
      ).rejects.toThrow('PowerSync database not initialized');
    });

    it('defaults mediaType to photo and thumbnailDataUrl to null', async () => {
      await createPhotoRecord(
        'user-456',
        'photo-123',
        'file:///local/photo.jpg',
        '2026-03-24T15:05:00.000Z',
      );

      const params = mockExecute.mock.calls[0][1];
      expect(params[7]).toBeNull(); // thumbnail_data_url
      expect(params[9]).toBe('photo'); // media_type
    });
  });

  // ---------------------------------------------------------------------------
  // updatePhotoAfterUpload
  // ---------------------------------------------------------------------------

  describe('updatePhotoAfterUpload', () => {
    it('updates image_url and storage_path on photo record', async () => {
      await updatePhotoAfterUpload(
        'photo-123',
        'https://cdn.example.com/photo.webp',
        'photos/user-456/photo-123.webp',
      );

      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('UPDATE photos SET image_url');
      expect(params[0]).toBe('https://cdn.example.com/photo.webp');
      expect(params[1]).toBe('photos/user-456/photo-123.webp');
      expect(params[2]).toBe('photo-123');
    });
  });

  // ---------------------------------------------------------------------------
  // triagePhoto
  // ---------------------------------------------------------------------------

  describe('triagePhoto', () => {
    it('updates photo_state to journal', async () => {
      await triagePhoto('photo-123', 'journal');

      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('UPDATE photos SET photo_state');
      expect(params[0]).toBe('journal');
      expect(params[1]).toBe('photo-123');
    });

    it('updates photo_state to archive', async () => {
      await triagePhoto('photo-123', 'archive');

      const params = mockExecute.mock.calls[0][1];
      expect(params[0]).toBe('archive');
    });
  });

  // ---------------------------------------------------------------------------
  // batchTriagePhotos
  // ---------------------------------------------------------------------------

  describe('batchTriagePhotos', () => {
    it('updates photo_state for each photo in array', async () => {
      await batchTriagePhotos(['p1', 'p2', 'p3'], 'journal');

      expect(mockExecute).toHaveBeenCalledTimes(3);
      expect(mockExecute.mock.calls[0][1]).toEqual(['journal', 'p1']);
      expect(mockExecute.mock.calls[1][1]).toEqual(['journal', 'p2']);
      expect(mockExecute.mock.calls[2][1]).toEqual(['journal', 'p3']);
    });
  });

  // ---------------------------------------------------------------------------
  // softDeletePhoto
  // ---------------------------------------------------------------------------

  describe('softDeletePhoto', () => {
    it('sets deleted_at to ISO timestamp', async () => {
      const before = new Date().toISOString();
      await softDeletePhoto('photo-123');
      const after = new Date().toISOString();

      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('UPDATE photos SET deleted_at');
      expect(params[1]).toBe('photo-123');
      expect(params[0]).toBeTruthy();
      expect(params[0] >= before).toBe(true);
      expect(params[0] <= after).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // restorePhoto
  // ---------------------------------------------------------------------------

  describe('restorePhoto', () => {
    it('sets deleted_at to NULL', async () => {
      await restorePhoto('photo-123');

      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('UPDATE photos SET deleted_at');
      expect(params[0]).toBeNull();
      expect(params[1]).toBe('photo-123');
    });
  });

  // ---------------------------------------------------------------------------
  // getUserPhotos
  // ---------------------------------------------------------------------------

  describe('getUserPhotos', () => {
    it('returns mapped Photo[] with camelCase fields, excludes deleted', async () => {
      mockGetAll.mockResolvedValueOnce([MOCK_PHOTO_ROW]);

      const photos = await getUserPhotos('user-456');

      expect(mockGetAll).toHaveBeenCalledTimes(1);
      const [sql, params] = mockGetAll.mock.calls[0];
      expect(sql).toContain('WHERE user_id = ?');
      expect(sql).toContain('deleted_at IS NULL');
      expect(sql).toContain('ORDER BY created_at DESC');
      expect(params[0]).toBe('user-456');

      expect(photos).toHaveLength(1);
      expect(photos[0].userId).toBe('user-456');
      expect(photos[0].imageUrl).toBe('https://cdn.example.com/photo.webp');
    });

    it('returns empty array when no photos', async () => {
      const photos = await getUserPhotos('user-456');
      expect(photos).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getPhotoById
  // ---------------------------------------------------------------------------

  describe('getPhotoById', () => {
    it('returns mapped Photo when found', async () => {
      mockGet.mockResolvedValueOnce(MOCK_PHOTO_ROW);

      const photo = await getPhotoById('photo-123');

      expect(mockGet).toHaveBeenCalledTimes(1);
      const [sql, params] = mockGet.mock.calls[0];
      expect(sql).toContain('WHERE id = ?');
      expect(sql).toContain('deleted_at IS NULL');
      expect(params[0]).toBe('photo-123');

      expect(photo).not.toBeNull();
      expect(photo!.id).toBe('photo-123');
      expect(photo!.userId).toBe('user-456');
    });

    it('returns null when not found', async () => {
      const photo = await getPhotoById('nonexistent');
      expect(photo).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // updatePhotoCaption
  // ---------------------------------------------------------------------------

  describe('updatePhotoCaption', () => {
    it('updates caption on photo', async () => {
      await updatePhotoCaption('photo-123', 'New caption');

      const [sql, params] = mockExecute.mock.calls[0];
      expect(sql).toContain('UPDATE photos SET caption');
      expect(params[0]).toBe('New caption');
      expect(params[1]).toBe('photo-123');
    });
  });

  // ---------------------------------------------------------------------------
  // addReaction
  // ---------------------------------------------------------------------------

  describe('addReaction', () => {
    it('calls supabase.from(photo_reactions).upsert with correct fields', async () => {
      await addReaction('photo-123', 'user-456', '🔥');

      expect(mockSupabaseFrom).toHaveBeenCalledWith('photo_reactions');
      expect(mockUpsert).toHaveBeenCalledWith(
        { photo_id: 'photo-123', user_id: 'user-456', emoji: '🔥' },
        { onConflict: 'photo_id,user_id,emoji' },
      );
    });

    it('throws when upsert returns error', async () => {
      mockUpsert.mockResolvedValueOnce({ error: { message: 'duplicate' } });

      await expect(addReaction('photo-123', 'user-456', '🔥')).rejects.toThrow(
        'Failed to add reaction: duplicate',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // removeReaction
  // ---------------------------------------------------------------------------

  describe('removeReaction', () => {
    it('calls supabase.from(photo_reactions).delete with match', async () => {
      await removeReaction('photo-123', 'user-456', '🔥');

      expect(mockSupabaseFrom).toHaveBeenCalledWith('photo_reactions');
      expect(mockDeleteFn).toHaveBeenCalled();
      expect(mockDeleteMatch).toHaveBeenCalledWith({
        photo_id: 'photo-123',
        user_id: 'user-456',
        emoji: '🔥',
      });
    });

    it('throws when delete returns error', async () => {
      mockDeleteMatch.mockResolvedValueOnce({ error: { message: 'not found' } });

      await expect(removeReaction('photo-123', 'user-456', '🔥')).rejects.toThrow(
        'Failed to remove reaction: not found',
      );
    });
  });
});
