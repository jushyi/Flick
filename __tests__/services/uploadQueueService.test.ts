/**
 * uploadQueueService Unit Tests -- Supabase + PowerSync rewrite
 *
 * Tests for the new upload queue that:
 * - Persists items in PowerSync local-only SQLite table (not AsyncStorage)
 * - Uploads new items to Supabase Storage via storageService.ts
 * - Drains old AsyncStorage Firebase queue items on first init
 * - Retries with exponential backoff (2s/4s/8s, max 3 attempts)
 */

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

// Mock PowerSync database
const mockExecute = jest.fn(() => Promise.resolve());
const mockGetAll = jest.fn(() => Promise.resolve([]));
const mockGet = jest.fn(() => Promise.resolve({ count: 0 }));

const mockPowerSyncDb = {
  execute: mockExecute,
  getAll: mockGetAll,
  get: mockGet,
};

jest.mock('../../src/lib/powersync/PowerSyncProvider', () => ({
  getPowerSyncDb: jest.fn(() => mockPowerSyncDb),
}));

// Mock Supabase storageService
const mockSupabaseUploadPhoto = jest.fn(() =>
  Promise.resolve({ success: true, url: 'https://supabase.co/photo.webp', storagePath: 'photos/user1/photo1.webp' })
);
const mockSupabaseUploadVideo = jest.fn(() =>
  Promise.resolve({ success: true, url: 'https://supabase.co/video.mp4', storagePath: 'photos/user1/video1.mp4' })
);
const mockSupabaseUploadSnapPhoto = jest.fn(() =>
  Promise.resolve({ success: true, storagePath: 'snaps/user1/snap1.webp' })
);
const mockGenerateThumbnail = jest.fn(() => Promise.resolve('data:image/jpeg;base64,abc123'));

jest.mock('../../src/services/supabase/storageService', () => ({
  uploadPhoto: (...args: any[]) => mockSupabaseUploadPhoto(...args),
  uploadVideo: (...args: any[]) => mockSupabaseUploadVideo(...args),
  uploadSnapPhoto: (...args: any[]) => mockSupabaseUploadSnapPhoto(...args),
  generateThumbnail: (...args: any[]) => mockGenerateThumbnail(...args),
}));

// Mock Firebase storageService (for drain)
const mockFirebaseUploadPhoto = jest.fn(() =>
  Promise.resolve({ success: true, url: 'https://firebase.com/photo.jpg' })
);
const mockFirebaseUploadVideo = jest.fn(() =>
  Promise.resolve({ success: true, url: 'https://firebase.com/video.mp4' })
);

jest.mock('../../src/services/firebase/storageService', () => ({
  uploadPhoto: (...args: any[]) => mockFirebaseUploadPhoto(...args),
  uploadVideo: (...args: any[]) => mockFirebaseUploadVideo(...args),
}));

// Mock AsyncStorage (for drain of old items)
const mockAsyncStorageGetItem = jest.fn(() => Promise.resolve(null));
const mockAsyncStorageRemoveItem = jest.fn(() => Promise.resolve());

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args: any[]) => mockAsyncStorageGetItem(...args),
  removeItem: (...args: any[]) => mockAsyncStorageRemoveItem(...args),
  setItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock Supabase client (for photo record creation)
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({ error: null })),
    })),
  },
}));

import {
  initializeQueue,
  addToQueue,
  processQueue,
  getQueueLength,
  clearFailedItems,
} from '../../src/services/uploadQueueService';

describe('uploadQueueService (Supabase + PowerSync)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAll.mockResolvedValue([]);
    mockGet.mockResolvedValue({ count: 0 });
    mockExecute.mockResolvedValue(undefined);
    mockAsyncStorageGetItem.mockResolvedValue(null);
  });

  describe('initializeQueue', () => {
    it('drains old Firebase queue items from AsyncStorage', async () => {
      // Simulate old queue items in AsyncStorage
      const oldItems = JSON.stringify([
        { id: 'old-1', userId: 'user1', photoUri: 'file:///old-photo.jpg', status: 'pending', attempts: 0 },
      ]);
      mockAsyncStorageGetItem.mockResolvedValueOnce(oldItems);

      await initializeQueue();

      // Should have checked AsyncStorage for old items
      expect(mockAsyncStorageGetItem).toHaveBeenCalledWith('@uploadQueue');
      // Should have drained old items via Firebase path
      expect(mockFirebaseUploadPhoto).toHaveBeenCalled();
      // Should have cleared old queue from AsyncStorage
      expect(mockAsyncStorageRemoveItem).toHaveBeenCalledWith('@uploadQueue');
    });

    it('handles empty AsyncStorage gracefully', async () => {
      mockAsyncStorageGetItem.mockResolvedValueOnce(null);

      await initializeQueue();

      expect(mockFirebaseUploadPhoto).not.toHaveBeenCalled();
    });
  });

  describe('addToQueue', () => {
    it('inserts row into PowerSync upload_queue table with correct fields', async () => {
      const result = await addToQueue('user1', 'file:///photo.jpg', 'photo', null);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO upload_queue'),
        expect.arrayContaining(['user1', 'file:///photo.jpg', 'photo', 'pending', 'supabase'])
      );
      expect(result).toHaveProperty('photoId');
      expect(result).toHaveProperty('thumbnail');
    });

    it('generates thumbnail for added items', async () => {
      await addToQueue('user1', 'file:///photo.jpg', 'photo', null);

      expect(mockGenerateThumbnail).toHaveBeenCalledWith('file:///photo.jpg');
    });

    it('sets backend to supabase for new items', async () => {
      await addToQueue('user1', 'file:///photo.jpg', 'photo', null);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO upload_queue'),
        expect.arrayContaining(['supabase'])
      );
    });
  });

  describe('processQueue', () => {
    it('calls Supabase uploadPhoto for photo items', async () => {
      mockGetAll.mockResolvedValueOnce([
        {
          id: 'q1',
          user_id: 'user1',
          media_uri: 'file:///photo.jpg',
          media_type: 'photo',
          photo_id: 'photo-1',
          status: 'pending',
          attempts: 0,
          backend: 'supabase',
          created_at: Date.now(),
        },
      ]);

      await processQueue();

      expect(mockSupabaseUploadPhoto).toHaveBeenCalledWith('user1', 'photo-1', 'file:///photo.jpg');
    });

    it('calls Supabase uploadVideo for video items', async () => {
      mockGetAll.mockResolvedValueOnce([
        {
          id: 'q2',
          user_id: 'user1',
          media_uri: 'file:///video.mp4',
          media_type: 'video',
          photo_id: 'video-1',
          status: 'pending',
          attempts: 0,
          backend: 'supabase',
          created_at: Date.now(),
        },
      ]);

      await processQueue();

      expect(mockSupabaseUploadVideo).toHaveBeenCalledWith('user1', 'video-1', 'file:///video.mp4');
    });

    it('calls Supabase uploadSnapPhoto for snap items', async () => {
      mockGetAll.mockResolvedValueOnce([
        {
          id: 'q3',
          user_id: 'user1',
          media_uri: 'file:///snap.jpg',
          media_type: 'snap',
          photo_id: 'snap-1',
          status: 'pending',
          attempts: 0,
          backend: 'supabase',
          created_at: Date.now(),
        },
      ]);

      await processQueue();

      expect(mockSupabaseUploadSnapPhoto).toHaveBeenCalledWith('user1', 'snap-1', 'file:///snap.jpg');
    });

    it('marks items as completed on success', async () => {
      mockGetAll.mockResolvedValueOnce([
        {
          id: 'q1',
          user_id: 'user1',
          media_uri: 'file:///photo.jpg',
          media_type: 'photo',
          photo_id: 'photo-1',
          status: 'pending',
          attempts: 0,
          backend: 'supabase',
          created_at: Date.now(),
        },
      ]);

      await processQueue();

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE upload_queue SET status'),
        expect.arrayContaining(['completed', 'q1'])
      );
    });

    it('retries failed items with exponential backoff (max 3 attempts)', async () => {
      mockSupabaseUploadPhoto.mockRejectedValue(new Error('Network error'));

      mockGetAll.mockResolvedValueOnce([
        {
          id: 'q1',
          user_id: 'user1',
          media_uri: 'file:///photo.jpg',
          media_type: 'photo',
          photo_id: 'photo-1',
          status: 'pending',
          attempts: 2,
          backend: 'supabase',
          created_at: Date.now(),
        },
      ]);

      await processQueue();

      // After 3rd attempt (2 previous + 1 now), should mark as failed
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE upload_queue SET status'),
        expect.arrayContaining(['failed', 'q1'])
      );
    });
  });

  describe('getQueueLength', () => {
    it('returns count of pending+retry items from PowerSync table', async () => {
      mockGet.mockResolvedValueOnce({ count: 5 });

      const length = await getQueueLength();

      expect(length).toBe(5);
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT'),
        expect.arrayContaining(['pending', 'retry'])
      );
    });
  });

  describe('clearFailedItems', () => {
    it('deletes items with status=failed from PowerSync table', async () => {
      await clearFailedItems();

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM upload_queue'),
        expect.arrayContaining(['failed'])
      );
    });
  });
});
