/**
 * Supabase Storage Service Tests
 *
 * Tests all upload/delete/URL operations for Supabase Storage.
 * Uses global __supabaseMocks from jest.setup.js for Supabase assertions.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

// Must import after mocks are set up
let storageService: typeof import('../../src/services/supabase/storageService');

// Track the mock functions returned by storage.from()
let mockUpload: jest.Mock;
let mockRemove: jest.Mock;
let mockGetPublicUrl: jest.Mock;
let mockStorageFrom: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();

  // Set up fresh mock chain for each test
  mockUpload = jest.fn().mockResolvedValue({ error: null });
  mockRemove = jest.fn().mockResolvedValue({ data: [], error: null });
  mockGetPublicUrl = jest.fn((path: string) => ({
    data: { publicUrl: `https://test.supabase.co/storage/v1/object/public/bucket/${path}` },
  }));

  mockStorageFrom = (global as any).__supabaseMocks.storage.from;
  mockStorageFrom.mockReturnValue({
    upload: mockUpload,
    remove: mockRemove,
    getPublicUrl: mockGetPublicUrl,
    createSignedUrl: jest.fn(),
    list: jest.fn(),
  });
});

beforeAll(() => {
  // Dynamic import to ensure mocks are in place
  storageService = require('../../src/services/supabase/storageService');
});

// ============================================================================
// uploadPhoto
// ============================================================================
describe('uploadPhoto', () => {
  it('compresses to WebP 0.9 at 1080px width and uploads to photos bucket', async () => {
    const result = await storageService.uploadPhoto('user123', 'photo456', 'file:///photo.jpg');

    // Should compress image
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      'file:///photo.jpg',
      [{ resize: { width: 1080 } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.WEBP }
    );

    // Should read compressed file as base64
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith(
      'file://manipulated-image.jpg',
      { encoding: FileSystem.EncodingType.Base64 }
    );

    // Should decode base64 to ArrayBuffer
    expect(decode).toHaveBeenCalled();

    // Should upload to correct bucket and path
    expect(mockStorageFrom).toHaveBeenCalledWith('photos');
    expect(mockUpload).toHaveBeenCalledWith(
      'photos/user123/photo456.webp',
      expect.any(ArrayBuffer),
      {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000',
        upsert: false,
      }
    );

    // Should get public URL
    expect(mockGetPublicUrl).toHaveBeenCalledWith('photos/user123/photo456.webp');

    // Should return success
    expect(result).toEqual({
      success: true,
      url: expect.stringContaining('photos/user123/photo456.webp'),
      storagePath: 'photos/user123/photo456.webp',
    });
  });

  it('returns error on upload failure', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'Upload failed' } });

    const result = await storageService.uploadPhoto('user123', 'photo456', 'file:///photo.jpg');

    expect(result).toEqual({
      success: false,
      error: 'Upload failed',
    });
  });
});

// ============================================================================
// uploadVideo
// ============================================================================
describe('uploadVideo', () => {
  it('uploads .mov video without compression', async () => {
    const result = await storageService.uploadVideo('user123', 'video789', 'file:///video.mov');

    // Should NOT compress
    expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();

    // Should read file as base64
    expect(FileSystem.readAsStringAsync).toHaveBeenCalled();

    // Should upload with correct content type
    expect(mockStorageFrom).toHaveBeenCalledWith('photos');
    expect(mockUpload).toHaveBeenCalledWith(
      'photos/user123/video789.mov',
      expect.any(ArrayBuffer),
      expect.objectContaining({
        contentType: 'video/quicktime',
      })
    );

    expect(result).toEqual({
      success: true,
      url: expect.any(String),
      storagePath: 'photos/user123/video789.mov',
    });
  });

  it('uploads .mp4 video with correct content type', async () => {
    const result = await storageService.uploadVideo('user123', 'video789', 'file:///video.mp4');

    expect(mockUpload).toHaveBeenCalledWith(
      'photos/user123/video789.mp4',
      expect.any(ArrayBuffer),
      expect.objectContaining({
        contentType: 'video/mp4',
      })
    );

    expect(result.success).toBe(true);
  });

  it('returns error on upload failure', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'Video upload failed' } });

    const result = await storageService.uploadVideo('user123', 'video789', 'file:///video.mov');

    expect(result).toEqual({
      success: false,
      error: 'Video upload failed',
    });
  });
});

// ============================================================================
// uploadProfilePhoto
// ============================================================================
describe('uploadProfilePhoto', () => {
  it('compresses to WebP 0.7 at 400px width and uploads to profile-photos bucket', async () => {
    const result = await storageService.uploadProfilePhoto('user123', 'file:///profile.jpg');

    // Should compress at lower quality and smaller size
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      'file:///profile.jpg',
      [{ resize: { width: 400 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.WEBP }
    );

    // Should upload to profile-photos bucket
    expect(mockStorageFrom).toHaveBeenCalledWith('profile-photos');
    expect(mockUpload).toHaveBeenCalledWith(
      'user123/profile.webp',
      expect.any(ArrayBuffer),
      expect.objectContaining({
        contentType: 'image/webp',
      })
    );

    expect(result).toEqual({
      success: true,
      url: expect.any(String),
      storagePath: 'user123/profile.webp',
    });
  });

  it('returns error on failure', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'Profile upload failed' } });

    const result = await storageService.uploadProfilePhoto('user123', 'file:///profile.jpg');

    expect(result).toEqual({
      success: false,
      error: 'Profile upload failed',
    });
  });
});

// ============================================================================
// uploadSelectsPhotos
// ============================================================================
describe('uploadSelectsPhotos', () => {
  it('uploads each photo to selects bucket with indexed filenames', async () => {
    const uris = ['file:///select1.jpg', 'file:///select2.jpg', 'file:///select3.jpg'];
    const result = await storageService.uploadSelectsPhotos('user123', uris);

    // Should compress each at 0.7 quality / 400px
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledTimes(3);

    // Should upload to selects bucket
    expect(mockStorageFrom).toHaveBeenCalledWith('selects');

    // Should use indexed filenames
    expect(mockUpload).toHaveBeenCalledWith(
      'user123/select_0.webp',
      expect.any(ArrayBuffer),
      expect.objectContaining({ contentType: 'image/webp' })
    );
    expect(mockUpload).toHaveBeenCalledWith(
      'user123/select_1.webp',
      expect.any(ArrayBuffer),
      expect.any(Object)
    );
    expect(mockUpload).toHaveBeenCalledWith(
      'user123/select_2.webp',
      expect.any(ArrayBuffer),
      expect.any(Object)
    );

    expect(result).toEqual({
      success: true,
      photoURLs: expect.arrayContaining([expect.any(String)]),
    });
    expect(result.photoURLs).toHaveLength(3);
  });

  it('returns error if any upload fails', async () => {
    mockUpload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'Select upload failed' } });

    const result = await storageService.uploadSelectsPhotos('user123', ['file:///a.jpg', 'file:///b.jpg']);

    expect(result).toEqual({
      success: false,
      error: 'Select upload failed',
    });
  });
});

// ============================================================================
// uploadCommentImage
// ============================================================================
describe('uploadCommentImage', () => {
  it('uploads to comment-images bucket with UUID filename', async () => {
    const result = await storageService.uploadCommentImage('file:///comment.jpg');

    // Should compress
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      'file:///comment.jpg',
      [{ resize: { width: 1080 } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.WEBP }
    );

    // Should upload to comment-images bucket
    expect(mockStorageFrom).toHaveBeenCalledWith('comment-images');
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/.*\.webp$/),
      expect.any(ArrayBuffer),
      expect.objectContaining({ contentType: 'image/webp' })
    );

    expect(result).toEqual({
      success: true,
      url: expect.any(String),
    });
  });

  it('returns error on failure', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'Comment image failed' } });

    const result = await storageService.uploadCommentImage('file:///comment.jpg');

    expect(result).toEqual({
      success: false,
      error: 'Comment image failed',
    });
  });
});

// ============================================================================
// uploadSnapPhoto
// ============================================================================
describe('uploadSnapPhoto', () => {
  it('uploads to snaps bucket without returning public URL', async () => {
    const result = await storageService.uploadSnapPhoto('user123', 'snap456', 'file:///snap.jpg');

    // Should compress to WebP
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      'file:///snap.jpg',
      [{ resize: { width: 1080 } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.WEBP }
    );

    // Should upload to snaps bucket
    expect(mockStorageFrom).toHaveBeenCalledWith('snaps');
    expect(mockUpload).toHaveBeenCalledWith(
      'user123/snap456.webp',
      expect.any(ArrayBuffer),
      expect.objectContaining({ contentType: 'image/webp' })
    );

    // Should return storagePath but NO url (snaps are private)
    expect(result).toEqual({
      success: true,
      storagePath: 'user123/snap456.webp',
    });
    expect(result).not.toHaveProperty('url');
  });

  it('returns error on failure', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'Snap upload failed' } });

    const result = await storageService.uploadSnapPhoto('user123', 'snap456', 'file:///snap.jpg');

    expect(result).toEqual({
      success: false,
      error: 'Snap upload failed',
    });
  });
});

// ============================================================================
// deletePhoto
// ============================================================================
describe('deletePhoto', () => {
  it('removes photo from photos bucket', async () => {
    const result = await storageService.deletePhoto('user123', 'photo456');

    expect(mockStorageFrom).toHaveBeenCalledWith('photos');
    expect(mockRemove).toHaveBeenCalledWith(['photos/user123/photo456.webp']);

    expect(result).toEqual({ success: true });
  });

  it('returns error on failure', async () => {
    mockRemove.mockResolvedValue({ error: { message: 'Delete failed' } });

    const result = await storageService.deletePhoto('user123', 'photo456');

    expect(result).toEqual({
      success: false,
      error: 'Delete failed',
    });
  });
});

// ============================================================================
// deleteProfilePhoto
// ============================================================================
describe('deleteProfilePhoto', () => {
  it('removes profile photo from profile-photos bucket', async () => {
    const result = await storageService.deleteProfilePhoto('user123');

    expect(mockStorageFrom).toHaveBeenCalledWith('profile-photos');
    expect(mockRemove).toHaveBeenCalledWith(['user123/profile.webp']);

    expect(result).toEqual({ success: true });
  });

  it('returns error on failure', async () => {
    mockRemove.mockResolvedValue({ error: { message: 'Delete profile failed' } });

    const result = await storageService.deleteProfilePhoto('user123');

    expect(result).toEqual({
      success: false,
      error: 'Delete profile failed',
    });
  });
});

// ============================================================================
// getPhotoURL
// ============================================================================
describe('getPhotoURL', () => {
  it('returns public URL for photo', async () => {
    const result = await storageService.getPhotoURL('user123', 'photo456');

    expect(mockStorageFrom).toHaveBeenCalledWith('photos');
    expect(mockGetPublicUrl).toHaveBeenCalledWith('photos/user123/photo456.webp');

    expect(result).toEqual({
      success: true,
      url: expect.stringContaining('photos/user123/photo456.webp'),
    });
  });
});

// ============================================================================
// generateThumbnail
// ============================================================================
describe('generateThumbnail', () => {
  it('resizes to 20px wide JPEG at 0.5 quality and returns base64 data URI', async () => {
    const result = await storageService.generateThumbnail('file:///photo.jpg');

    // Should resize to 20px
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      'file:///photo.jpg',
      [{ resize: { width: 20 } }],
      { format: ImageManipulator.SaveFormat.JPEG, compress: 0.5 }
    );

    // Should read as base64
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith(
      'file://manipulated-image.jpg',
      { encoding: FileSystem.EncodingType.Base64 }
    );

    // Should return data URI
    expect(result).toMatch(/^data:image\/jpeg;base64,.+/);
  });

  it('returns null on error', async () => {
    (ImageManipulator.manipulateAsync as jest.Mock).mockRejectedValueOnce(new Error('Resize failed'));

    const result = await storageService.generateThumbnail('file:///photo.jpg');

    expect(result).toBeNull();
  });
});
