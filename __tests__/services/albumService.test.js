/**
 * Album Service Unit Tests
 *
 * Tests for album CRUD operations, photo management, and cover photo logic.
 */

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock validation
jest.mock('../../src/utils/validation', () => ({
  sanitizeInput: jest.fn(input => input),
}));

// Create Firestore mocks
const mockAddDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: (...args) => mockCollection(...args),
  doc: (...args) => mockDoc(...args),
  addDoc: (...args) => mockAddDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  orderBy: (...args) => mockOrderBy(...args),
  limit: (...args) => mockLimit(...args),
  serverTimestamp: () => ({ _serverTimestamp: true }),
}));

// Import service after mocks
const {
  createAlbum,
  getAlbum,
  getUserAlbums,
  updateAlbum,
  deleteAlbum,
  addPhotosToAlbum,
  removePhotoFromAlbum,
  setCoverPhoto,
} = require('../../src/services/firebase/albumService');

const { createTestAlbum } = require('../setup/testFactories');

describe('albumService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReturnValue({ _query: true });
    mockCollection.mockReturnValue({ _collection: true });
    mockDoc.mockReturnValue({ _doc: true, id: 'test-doc-id' });
  });

  // ===========================================================================
  // createAlbum tests
  // ===========================================================================
  describe('createAlbum', () => {
    it('should create an album with correct fields and return success', async () => {
      const albumRef = { id: 'album-new-123' };
      mockAddDoc.mockResolvedValueOnce(albumRef);

      const result = await createAlbum('user-123', 'Summer Vibes', ['photo-1', 'photo-2']);

      expect(result.success).toBe(true);
      expect(result.album).toBeDefined();
      expect(result.album.id).toBe('album-new-123');
      expect(result.album.userId).toBe('user-123');
      expect(result.album.name).toBe('Summer Vibes');
      expect(result.album.coverPhotoId).toBe('photo-1');
      expect(result.album.photoIds).toEqual(['photo-1', 'photo-2']);
      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user-123',
          name: 'Summer Vibes',
          coverPhotoId: 'photo-1',
          photoIds: ['photo-1', 'photo-2'],
        })
      );
    });

    it('should return error when name is empty', async () => {
      const result = await createAlbum('user-123', '', ['photo-1']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Album name is required');
      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('should return error when name is null', async () => {
      const result = await createAlbum('user-123', null, ['photo-1']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Album name is required');
    });

    it('should return error when name is only whitespace', async () => {
      const result = await createAlbum('user-123', '   ', ['photo-1']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Album name cannot be empty');
    });

    it('should return error when name exceeds 24 characters', async () => {
      const longName = 'A'.repeat(25);
      const result = await createAlbum('user-123', longName, ['photo-1']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Album name must be 24 characters or less');
    });

    it('should return error when photoIds is empty array', async () => {
      const result = await createAlbum('user-123', 'Test Album', []);

      expect(result.success).toBe(false);
      expect(result.error).toBe('At least one photo is required');
    });

    it('should return error when photoIds is null', async () => {
      const result = await createAlbum('user-123', 'Test Album', null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('At least one photo is required');
    });

    it('should return error when Firestore addDoc fails', async () => {
      mockAddDoc.mockRejectedValueOnce(new Error('Firestore write error'));

      const result = await createAlbum('user-123', 'Test Album', ['photo-1']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Firestore write error');
    });

    it('should set first photo as cover photo', async () => {
      const albumRef = { id: 'album-456' };
      mockAddDoc.mockResolvedValueOnce(albumRef);

      const result = await createAlbum('user-123', 'Test', ['photo-first', 'photo-second']);

      expect(result.album.coverPhotoId).toBe('photo-first');
    });
  });

  // ===========================================================================
  // getAlbum tests
  // ===========================================================================
  describe('getAlbum', () => {
    it('should return album data for existing album', async () => {
      const albumData = createTestAlbum({ name: 'My Album', photoIds: ['photo-1'] });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'album-123',
        data: () => albumData,
      });

      const result = await getAlbum('album-123');

      expect(result.success).toBe(true);
      expect(result.album).toBeDefined();
      expect(result.album.id).toBe('album-123');
      expect(result.album.name).toBe('My Album');
    });

    it('should return error when album does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await getAlbum('nonexistent-album');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Album not found');
    });

    it('should return error when Firestore getDoc fails', async () => {
      mockGetDoc.mockRejectedValueOnce(new Error('Network error'));

      const result = await getAlbum('album-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  // ===========================================================================
  // getUserAlbums tests
  // ===========================================================================
  describe('getUserAlbums', () => {
    it('should return array of user albums', async () => {
      const mockDocs = [
        { id: 'album-1', data: () => ({ name: 'Album 1', userId: 'user-123' }) },
        { id: 'album-2', data: () => ({ name: 'Album 2', userId: 'user-123' }) },
      ];
      mockGetDocs.mockResolvedValueOnce({ docs: mockDocs });

      const result = await getUserAlbums('user-123');

      expect(result.success).toBe(true);
      expect(result.albums).toHaveLength(2);
      expect(result.albums[0].id).toBe('album-1');
      expect(result.albums[1].id).toBe('album-2');
      expect(mockWhere).toHaveBeenCalledWith('userId', '==', 'user-123');
      expect(mockOrderBy).toHaveBeenCalledWith('updatedAt', 'desc');
    });

    it('should return empty array when user has no albums', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      const result = await getUserAlbums('user-123');

      expect(result.success).toBe(true);
      expect(result.albums).toHaveLength(0);
    });

    it('should return error when query fails', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Query failed'));

      const result = await getUserAlbums('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Query failed');
    });
  });

  // ===========================================================================
  // updateAlbum tests
  // ===========================================================================
  describe('updateAlbum', () => {
    it('should update album name successfully', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ name: 'Old Name', photoIds: ['photo-1'] }),
      });
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await updateAlbum('album-123', { name: 'New Name' });

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'New Name',
        })
      );
    });

    it('should update coverPhotoId when photo is in album', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ name: 'Album', photoIds: ['photo-1', 'photo-2'] }),
      });
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await updateAlbum('album-123', { coverPhotoId: 'photo-2' });

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          coverPhotoId: 'photo-2',
        })
      );
    });

    it('should return error when album does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await updateAlbum('nonexistent', { name: 'New Name' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Album not found');
    });

    it('should return error when name is not a string', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ name: 'Album', photoIds: ['photo-1'] }),
      });

      const result = await updateAlbum('album-123', { name: 123 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Album name must be a string');
    });

    it('should return error when name is empty after trim', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ name: 'Album', photoIds: ['photo-1'] }),
      });

      const result = await updateAlbum('album-123', { name: '   ' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Album name cannot be empty');
    });

    it('should return error when name exceeds 24 characters', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ name: 'Album', photoIds: ['photo-1'] }),
      });

      const longName = 'A'.repeat(25);
      const result = await updateAlbum('album-123', { name: longName });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Album name must be 24 characters or less');
    });

    it('should return error when coverPhotoId is not in album', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ name: 'Album', photoIds: ['photo-1', 'photo-2'] }),
      });

      const result = await updateAlbum('album-123', { coverPhotoId: 'photo-999' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cover photo must be a photo in the album');
    });

    it('should return error when no valid updates provided', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ name: 'Album', photoIds: ['photo-1'] }),
      });

      const result = await updateAlbum('album-123', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid updates provided');
    });

    it('should return error when Firestore updateDoc fails', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ name: 'Album', photoIds: ['photo-1'] }),
      });
      mockUpdateDoc.mockRejectedValueOnce(new Error('Update failed'));

      const result = await updateAlbum('album-123', { name: 'New Name' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  // ===========================================================================
  // deleteAlbum tests
  // ===========================================================================
  describe('deleteAlbum', () => {
    it('should delete album successfully', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => createTestAlbum(),
      });
      mockDeleteDoc.mockResolvedValueOnce();

      const result = await deleteAlbum('album-123');

      expect(result.success).toBe(true);
      expect(mockDeleteDoc).toHaveBeenCalled();
    });

    it('should return error when album does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await deleteAlbum('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Album not found');
      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    it('should return error when Firestore deleteDoc fails', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => createTestAlbum(),
      });
      mockDeleteDoc.mockRejectedValueOnce(new Error('Delete failed'));

      const result = await deleteAlbum('album-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });
  });

  // ===========================================================================
  // addPhotosToAlbum tests
  // ===========================================================================
  describe('addPhotosToAlbum', () => {
    it('should add new photos to album successfully', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ photoIds: ['photo-1'] }),
      });
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await addPhotosToAlbum('album-123', ['photo-2', 'photo-3']);

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          photoIds: ['photo-2', 'photo-3', 'photo-1'],
        })
      );
    });

    it('should filter out photos already in album', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ photoIds: ['photo-1', 'photo-2'] }),
      });
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await addPhotosToAlbum('album-123', ['photo-2', 'photo-3']);

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          photoIds: ['photo-3', 'photo-1', 'photo-2'],
        })
      );
    });

    it('should return error when all photos already in album', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ photoIds: ['photo-1', 'photo-2'] }),
      });

      const result = await addPhotosToAlbum('album-123', ['photo-1', 'photo-2']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('All photos are already in the album');
    });

    it('should return error when photoIds is empty array', async () => {
      const result = await addPhotosToAlbum('album-123', []);

      expect(result.success).toBe(false);
      expect(result.error).toBe('At least one photo ID is required');
    });

    it('should return error when photoIds is null', async () => {
      const result = await addPhotosToAlbum('album-123', null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('At least one photo ID is required');
    });

    it('should return error when album does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await addPhotosToAlbum('nonexistent', ['photo-1']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Album not found');
    });

    it('should return error when Firestore updateDoc fails', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ photoIds: ['photo-1'] }),
      });
      mockUpdateDoc.mockRejectedValueOnce(new Error('Update failed'));

      const result = await addPhotosToAlbum('album-123', ['photo-2']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  // ===========================================================================
  // removePhotoFromAlbum tests
  // ===========================================================================
  describe('removePhotoFromAlbum', () => {
    it('should remove photo from album successfully', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ photoIds: ['photo-1', 'photo-2', 'photo-3'], coverPhotoId: 'photo-1' }),
      });
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await removePhotoFromAlbum('album-123', 'photo-2');

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          photoIds: ['photo-1', 'photo-3'],
        })
      );
    });

    it('should update cover photo when removing current cover', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ photoIds: ['photo-1', 'photo-2'], coverPhotoId: 'photo-1' }),
      });
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await removePhotoFromAlbum('album-123', 'photo-1');

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          coverPhotoId: 'photo-2',
          photoIds: ['photo-2'],
        })
      );
    });

    it('should return error when removing last photo', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ photoIds: ['photo-1'], coverPhotoId: 'photo-1' }),
      });

      const result = await removePhotoFromAlbum('album-123', 'photo-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Album must have at least one photo');
      expect(result.warning).toBe('Cannot remove the last photo. Delete the album instead.');
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should return error when photo not in album', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ photoIds: ['photo-1', 'photo-2'], coverPhotoId: 'photo-1' }),
      });

      const result = await removePhotoFromAlbum('album-123', 'photo-999');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Photo not in album');
    });

    it('should return error when album does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await removePhotoFromAlbum('nonexistent', 'photo-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Album not found');
    });

    it('should return error when Firestore updateDoc fails', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ photoIds: ['photo-1', 'photo-2'], coverPhotoId: 'photo-1' }),
      });
      mockUpdateDoc.mockRejectedValueOnce(new Error('Update failed'));

      const result = await removePhotoFromAlbum('album-123', 'photo-2');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  // ===========================================================================
  // setCoverPhoto tests
  // ===========================================================================
  describe('setCoverPhoto', () => {
    it('should set cover photo successfully when photo is in album', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ photoIds: ['photo-1', 'photo-2'], coverPhotoId: 'photo-1' }),
      });
      mockUpdateDoc.mockResolvedValueOnce();

      const result = await setCoverPhoto('album-123', 'photo-2');

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          coverPhotoId: 'photo-2',
        })
      );
    });

    it('should return error when photo is not in album', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ photoIds: ['photo-1', 'photo-2'], coverPhotoId: 'photo-1' }),
      });

      const result = await setCoverPhoto('album-123', 'photo-999');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Photo must be in the album to set as cover');
    });

    it('should return error when album does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await setCoverPhoto('nonexistent', 'photo-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Album not found');
    });

    it('should return error when Firestore updateDoc fails', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ photoIds: ['photo-1', 'photo-2'], coverPhotoId: 'photo-1' }),
      });
      mockUpdateDoc.mockRejectedValueOnce(new Error('Update failed'));

      const result = await setCoverPhoto('album-123', 'photo-2');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });
});
