/**
 * Album Service Tests (Supabase)
 *
 * Tests album CRUD operations via Supabase with junction table pattern.
 * Mocks supabase.from() chain per test.
 */

// =============================================================================
// Mock setup (hoisted by Jest)
// =============================================================================

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
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

// =============================================================================
// Imports (after mocks)
// =============================================================================

import {
  createAlbum,
  getAlbum,
  getUserAlbums,
  updateAlbum,
  deleteAlbum,
  addPhotosToAlbum,
  removePhotoFromAlbum,
  setCoverPhoto,
  getMonthlyPhotos,
  MAX_TITLE_LENGTH,
} from '../../src/services/supabase/albumService';

import { supabase } from '../../src/lib/supabase';

const mockFrom = supabase.from as jest.Mock;
const mockRpc = (supabase as any).rpc as jest.Mock;

// =============================================================================
// createAlbum
// =============================================================================
describe('createAlbum', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws if title is empty', async () => {
    await expect(createAlbum('user1', '', ['photo1'])).rejects.toThrow(
      'Album name is required'
    );
  });

  it('throws if title exceeds 24 characters', async () => {
    const longTitle = 'a'.repeat(25);
    await expect(createAlbum('user1', longTitle, ['photo1'])).rejects.toThrow(
      `Album name must be ${MAX_TITLE_LENGTH} characters or less`
    );
  });

  it('throws if photoIds is empty', async () => {
    await expect(createAlbum('user1', 'My Album', [])).rejects.toThrow(
      'At least one photo is required'
    );
  });

  it('inserts album then batch-inserts album_photos and sets cover to first photo', async () => {
    const mockAlbum = {
      id: 'album-1',
      user_id: 'user1',
      title: 'My Album',
      type: 'custom',
      month_key: null,
      cover_photo_id: 'photo1',
      created_at: '2026-03-24T00:00:00Z',
    };

    // Mock albums insert
    const mockAlbumsSelect = jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({ data: mockAlbum, error: null }),
    });
    const mockAlbumsInsert = jest.fn().mockReturnValue({
      select: mockAlbumsSelect,
    });

    // Mock album_photos insert
    const mockPhotosInsert = jest.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'albums') {
        return { insert: mockAlbumsInsert };
      }
      if (table === 'album_photos') {
        return { insert: mockPhotosInsert };
      }
      return {};
    });

    const result = await createAlbum('user1', 'My Album', ['photo1', 'photo2']);

    // Should insert into albums table
    expect(mockAlbumsInsert).toHaveBeenCalledWith({
      user_id: 'user1',
      title: 'My Album',
      type: 'custom',
      cover_photo_id: 'photo1',
    });

    // Should batch-insert into album_photos
    expect(mockPhotosInsert).toHaveBeenCalledWith([
      { album_id: 'album-1', photo_id: 'photo1' },
      { album_id: 'album-1', photo_id: 'photo2' },
    ]);

    expect(result.id).toBe('album-1');
    expect(result.coverPhotoId).toBe('photo1');
  });
});

// =============================================================================
// getUserAlbums
// =============================================================================
describe('getUserAlbums', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters by type=custom and orders DESC', async () => {
    const mockOrder = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'album-1',
          user_id: 'user1',
          title: 'Album 1',
          type: 'custom',
          month_key: null,
          cover_photo_id: 'p1',
          created_at: '2026-03-24T00:00:00Z',
          album_photos: [{ count: 3 }],
        },
      ],
      error: null,
    });
    const mockEqType = jest.fn().mockReturnValue({ order: mockOrder });
    const mockEqUser = jest.fn().mockReturnValue({ eq: mockEqType });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEqUser });

    mockFrom.mockReturnValue({ select: mockSelect });

    const result = await getUserAlbums('user1');

    expect(mockFrom).toHaveBeenCalledWith('albums');
    expect(mockSelect).toHaveBeenCalledWith('*, album_photos(count)');
    expect(mockEqUser).toHaveBeenCalledWith('user_id', 'user1');
    expect(mockEqType).toHaveBeenCalledWith('type', 'custom');
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result[0].photoCount).toBe(3);
  });
});

// =============================================================================
// deleteAlbum
// =============================================================================
describe('deleteAlbum', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls delete with correct albumId', async () => {
    const mockEq = jest.fn().mockResolvedValue({ error: null });
    const mockDelete = jest.fn().mockReturnValue({ eq: mockEq });

    mockFrom.mockReturnValue({ delete: mockDelete });

    await deleteAlbum('album-1');

    expect(mockFrom).toHaveBeenCalledWith('albums');
    expect(mockEq).toHaveBeenCalledWith('id', 'album-1');
  });
});

// =============================================================================
// addPhotosToAlbum
// =============================================================================
describe('addPhotosToAlbum', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inserts junction table rows', async () => {
    const mockInsert = jest.fn().mockResolvedValue({ error: null });

    mockFrom.mockReturnValue({ insert: mockInsert });

    await addPhotosToAlbum('album-1', ['photo1', 'photo2']);

    expect(mockFrom).toHaveBeenCalledWith('album_photos');
    expect(mockInsert).toHaveBeenCalledWith([
      { album_id: 'album-1', photo_id: 'photo1' },
      { album_id: 'album-1', photo_id: 'photo2' },
    ]);
  });
});

// =============================================================================
// removePhotoFromAlbum
// =============================================================================
describe('removePhotoFromAlbum', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes with correct composite key', async () => {
    const mockEqPhoto = jest.fn().mockResolvedValue({ error: null });
    const mockEqAlbum = jest.fn().mockReturnValue({ eq: mockEqPhoto });
    const mockDelete = jest.fn().mockReturnValue({ eq: mockEqAlbum });

    mockFrom.mockReturnValue({ delete: mockDelete });

    await removePhotoFromAlbum('album-1', 'photo-1');

    expect(mockFrom).toHaveBeenCalledWith('album_photos');
    expect(mockEqAlbum).toHaveBeenCalledWith('album_id', 'album-1');
    expect(mockEqPhoto).toHaveBeenCalledWith('photo_id', 'photo-1');
  });
});

// =============================================================================
// setCoverPhoto
// =============================================================================
describe('setCoverPhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates cover_photo_id', async () => {
    const mockEq = jest.fn().mockResolvedValue({ error: null });
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });

    mockFrom.mockReturnValue({ update: mockUpdate });

    await setCoverPhoto('album-1', 'photo-2');

    expect(mockFrom).toHaveBeenCalledWith('albums');
    expect(mockUpdate).toHaveBeenCalledWith({ cover_photo_id: 'photo-2' });
    expect(mockEq).toHaveBeenCalledWith('id', 'album-1');
  });
});

// =============================================================================
// getMonthlyPhotos
// =============================================================================
describe('getMonthlyPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls rpc with correct function name and params', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          month_key: '2026-03',
          photo_count: 5,
          photos: [
            { id: 'p1', image_url: 'url1', created_at: '2026-03-01', photo_state: 'journal' },
          ],
        },
      ],
      error: null,
    });

    const result = await getMonthlyPhotos('user1');

    expect(mockRpc).toHaveBeenCalledWith('get_monthly_photos', {
      target_user_id: 'user1',
    });
    expect(result).toHaveLength(1);
    expect(result[0].monthKey).toBe('2026-03');
    expect(result[0].photoCount).toBe(5);
    expect(result[0].photos[0].id).toBe('p1');
    expect(result[0].photos[0].imageUrl).toBe('url1');
  });
});

// =============================================================================
// getAlbum
// =============================================================================
describe('getAlbum', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches album with photos', async () => {
    const mockAlbumSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'album-1',
        user_id: 'user1',
        title: 'My Album',
        type: 'custom',
        month_key: null,
        cover_photo_id: 'photo1',
        created_at: '2026-03-24T00:00:00Z',
      },
      error: null,
    });
    const mockAlbumEq = jest.fn().mockReturnValue({ single: mockAlbumSingle });
    const mockAlbumSelect = jest.fn().mockReturnValue({ eq: mockAlbumEq });

    const mockPhotosOrder = jest.fn().mockResolvedValue({
      data: [{ photo_id: 'photo1' }, { photo_id: 'photo2' }],
      error: null,
    });
    const mockPhotosEq = jest.fn().mockReturnValue({ order: mockPhotosOrder });
    const mockPhotosSelect = jest.fn().mockReturnValue({ eq: mockPhotosEq });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'albums') {
        return { select: mockAlbumSelect };
      }
      if (table === 'album_photos') {
        return { select: mockPhotosSelect };
      }
      return {};
    });

    const result = await getAlbum('album-1');

    expect(result.id).toBe('album-1');
    expect(result.photos).toEqual(['photo1', 'photo2']);
  });
});

// =============================================================================
// updateAlbum
// =============================================================================
describe('updateAlbum', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates title with snake_case mapping', async () => {
    const mockEq = jest.fn().mockResolvedValue({ error: null });
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });

    mockFrom.mockReturnValue({ update: mockUpdate });

    await updateAlbum('album-1', { title: 'New Title' });

    expect(mockUpdate).toHaveBeenCalledWith({ title: 'New Title' });
    expect(mockEq).toHaveBeenCalledWith('id', 'album-1');
  });
});
