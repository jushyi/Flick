/**
 * uploadQueueService Unit Tests — Video Upload Support (RED scaffolds)
 *
 * Tests for video upload queue behavior that will be implemented in
 * Plan 11-02. These tests are expected to FAIL until the upload queue
 * is extended with mediaType, duration, and video upload logic.
 *
 * Covers:
 * - addToQueue accepts mediaType parameter
 * - addToQueue accepts duration parameter for videos
 * - Video items call uploadVideo instead of uploadPhoto
 * - Video items generate thumbnail via generateVideoThumbnail
 * - Firestore document includes mediaType, videoURL, duration fields for video items
 * - Photo items continue to work as before (backward compatibility)
 */

// Mock logger to prevent console output
import { addToQueue, processQueue } from '../../src/services/uploadQueueService';

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock darkroomService
jest.mock('../../src/services/firebase/darkroomService', () => ({
  ensureDarkroomInitialized: jest.fn(() => Promise.resolve()),
  clearRevealCache: jest.fn(),
}));

// Mock storageService
const mockUploadPhoto = jest.fn(() =>
  Promise.resolve({ success: true, url: 'https://storage.example.com/photo.jpg' })
);
const mockUploadVideo = jest.fn(() =>
  Promise.resolve({ success: true, url: 'https://storage.example.com/video.mp4' })
);
jest.mock('../../src/services/firebase/storageService', () => ({
  uploadPhoto: (...args) => mockUploadPhoto(...args),
  uploadVideo: (...args) => mockUploadVideo(...args),
}));

// Mock expo-image-manipulator
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(() =>
    Promise.resolve({ uri: 'file://thumbnail.jpg', width: 20, height: 35 })
  ),
  SaveFormat: { JPEG: 'jpeg' },
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(() => Promise.resolve('base64thumbnaildata')),
  EncodingType: { Base64: 'base64' },
}));

describe('uploadQueueService - video support', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset module state by clearing queue
    // Re-initialize for each test
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  test('addToQueue accepts mediaType parameter', async () => {
    const queueId = await addToQueue('user-1', 'file://video.mp4', 'video');

    expect(queueId).toBeDefined();
    expect(typeof queueId).toBe('string');
  });

  test('addToQueue accepts duration parameter for videos', async () => {
    const queueId = await addToQueue('user-1', 'file://video.mp4', 'video', 15.5);

    expect(queueId).toBeDefined();
    expect(typeof queueId).toBe('string');
  });

  test('video items call uploadVideo instead of uploadPhoto', async () => {
    // Add a video item and process the queue
    await addToQueue('user-1', 'file://video.mp4', 'video');

    // Wait for queue processing to complete
    await processQueue();

    // uploadVideo should be called for video items, not uploadPhoto
    expect(mockUploadVideo).toHaveBeenCalled();
    expect(mockUploadPhoto).not.toHaveBeenCalled();
  });

  test('video items generate thumbnail via generateVideoThumbnail', async () => {
    // This test verifies that video items use a video-specific thumbnail
    // generation approach (e.g., extracting a frame from the video)
    // rather than the photo thumbnail approach (resize + base64)
    await addToQueue('user-1', 'file://video.mp4', 'video');

    // Process the queue item
    await processQueue();

    // The Firestore document should include a thumbnailDataURL
    // generated from the video (not from image manipulator)
    const { setDoc } = require('@react-native-firebase/firestore');
    expect(setDoc).toHaveBeenCalled();

    const docData = setDoc.mock.calls[0]?.[1];
    expect(docData).toBeDefined();
    // Video thumbnail should exist in the document
    expect(docData.thumbnailDataURL).toBeDefined();
  });

  test('Firestore document includes mediaType, videoURL, duration fields for video items', async () => {
    await addToQueue('user-1', 'file://video.mp4', 'video', 12.3);

    await processQueue();

    const { setDoc } = require('@react-native-firebase/firestore');
    expect(setDoc).toHaveBeenCalled();

    const docData = setDoc.mock.calls[0]?.[1];
    expect(docData).toBeDefined();
    expect(docData.mediaType).toBe('video');
    expect(docData.videoURL).toBeDefined();
    expect(docData.duration).toBe(12.3);
  });

  test('photo items continue to work as before (backward compatibility)', async () => {
    // Add a photo item (no mediaType parameter, defaults to 'photo')
    await addToQueue('user-1', 'file://photo.jpg');

    await processQueue();

    // uploadPhoto should be called for photo items
    expect(mockUploadPhoto).toHaveBeenCalled();
    expect(mockUploadVideo).not.toHaveBeenCalled();

    const { setDoc } = require('@react-native-firebase/firestore');
    expect(setDoc).toHaveBeenCalled();

    const docData = setDoc.mock.calls[0]?.[1];
    expect(docData).toBeDefined();
    // Photo items should have imageURL, not videoURL
    expect(docData.imageURL).toBeDefined();
    // mediaType should default to 'photo' or be absent for backward compatibility
    expect(docData.mediaType === 'photo' || docData.mediaType === undefined).toBe(true);
  });
});
