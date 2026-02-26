/**
 * Snap Service Unit Tests
 *
 * Tests for snapService including:
 * - uploadAndSendSnap: upload, message creation, caption truncation, retry logic
 * - markSnapViewed: viewedAt timestamp write
 * - getSignedSnapUrl: Cloud Function call, path validation
 * - Error handling for all functions
 */

// Mock logger to prevent console output
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Create mock functions at module level
const mockPutFile = jest.fn(() => Promise.resolve({ state: 'success' }));
const mockGetDownloadURL = jest.fn(() =>
  Promise.resolve('https://firebasestorage.example.com/snap-thumbnails/thumb.jpg')
);
const mockStorageRef = jest.fn(() => ({
  putFile: mockPutFile,
  getDownloadURL: mockGetDownloadURL,
}));

const mockUpdateDoc = jest.fn(() => Promise.resolve());
const mockAddDoc = jest.fn(() => Promise.resolve({ id: 'snap-msg-id' }));
const mockServerTimestamp = jest.fn(() => ({ _serverTimestamp: true }));
const mockTimestampFromDate = jest.fn(date => ({
  _seconds: date.getTime() / 1000,
  _nanoseconds: 0,
  toDate: () => date,
}));

const mockDocRef = { id: 'mock-doc-ref' };
const mockCollectionRef = { id: 'mock-collection-ref' };

const mockCallableFn = jest.fn(() =>
  Promise.resolve({ data: { url: 'https://signed-url.example.com/snap.jpg' } })
);
const mockHttpsCallable = jest.fn(() => mockCallableFn);

// Mock @react-native-firebase/storage
jest.mock('@react-native-firebase/storage', () => ({
  getStorage: () => ({}),
  ref: (...args) => mockStorageRef(...args),
}));

// Mock @react-native-firebase/firestore
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn(() => mockDocRef),
  addDoc: (...args) => mockAddDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
  Timestamp: {
    fromDate: (...args) => mockTimestampFromDate(...args),
  },
}));

// Mock @react-native-firebase/functions
jest.mock('@react-native-firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: (...args) => mockHttpsCallable(...args),
}));

// Mock expo-image-manipulator
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(() =>
    Promise.resolve({
      uri: 'file://compressed-snap.jpg',
      width: 1080,
      height: 1920,
    })
  ),
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
  },
}));

// Import service AFTER mocks are set up
const {
  uploadAndSendSnap,
  markSnapViewed,
  getSignedSnapUrl,
} = require('../../src/services/firebase/snapService');

describe('snapService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPutFile.mockResolvedValue({ state: 'success' });
    mockGetDownloadURL.mockResolvedValue(
      'https://firebasestorage.example.com/snap-thumbnails/thumb.jpg'
    );
    mockAddDoc.mockResolvedValue({ id: 'snap-msg-id' });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockCallableFn.mockResolvedValue({
      data: { url: 'https://signed-url.example.com/snap.jpg' },
    });
  });

  // ==========================================================================
  // uploadAndSendSnap
  // ==========================================================================
  describe('uploadAndSendSnap', () => {
    it('should upload snap and create message document with correct fields', async () => {
      const result = await uploadAndSendSnap(
        'conv-123',
        'sender-456',
        'file://photo.jpg',
        'Hello!'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('snap-msg-id');

      // Verify Storage upload was called
      expect(mockStorageRef).toHaveBeenCalled();
      const storagePath = mockStorageRef.mock.calls[0][1];
      expect(storagePath).toMatch(/^snap-photos\/sender-456\/.+\.jpg$/);

      // Verify putFile was called with correct metadata
      expect(mockPutFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          cacheControl: 'no-store',
          contentType: 'image/jpeg',
        })
      );

      // Verify message document was created with correct fields
      expect(mockAddDoc).toHaveBeenCalledWith(
        mockCollectionRef,
        expect.objectContaining({
          senderId: 'sender-456',
          type: 'snap',
          text: null,
          gifUrl: null,
          imageUrl: null,
          snapStoragePath: expect.stringMatching(/^snap-photos\/sender-456\/.+\.jpg$/),
          caption: 'Hello!',
          viewedAt: null,
          createdAt: expect.anything(),
        })
      );

      // Verify expiresAt is set (48 hours from now)
      const messageData = mockAddDoc.mock.calls[0][1];
      expect(messageData.expiresAt).toBeDefined();
      expect(mockTimestampFromDate).toHaveBeenCalled();
    });

    it('should truncate caption to 150 characters', async () => {
      const longCaption = 'A'.repeat(200);

      await uploadAndSendSnap('conv-123', 'sender-456', 'file://photo.jpg', longCaption);

      const messageData = mockAddDoc.mock.calls[0][1];
      expect(messageData.caption).toBe('A'.repeat(150));
      expect(messageData.caption.length).toBe(150);
    });

    it('should set caption to null when not provided', async () => {
      await uploadAndSendSnap('conv-123', 'sender-456', 'file://photo.jpg');

      const messageData = mockAddDoc.mock.calls[0][1];
      expect(messageData.caption).toBeNull();
    });

    it('should calculate expiresAt as 48 hours from now', async () => {
      const beforeCall = Date.now();

      await uploadAndSendSnap('conv-123', 'sender-456', 'file://photo.jpg');

      const timestampArg = mockTimestampFromDate.mock.calls[0][0];
      const expiryTime = timestampArg.getTime();
      const expectedMin = beforeCall + 48 * 60 * 60 * 1000 - 5000; // 5s tolerance
      const expectedMax = beforeCall + 48 * 60 * 60 * 1000 + 5000;

      expect(expiryTime).toBeGreaterThanOrEqual(expectedMin);
      expect(expiryTime).toBeLessThanOrEqual(expectedMax);
    });

    it('should return error for missing required fields', async () => {
      const result1 = await uploadAndSendSnap(null, 'sender', 'file://photo.jpg');
      expect(result1.success).toBe(false);
      expect(result1.error).toBe('Missing required fields');

      const result2 = await uploadAndSendSnap('conv', null, 'file://photo.jpg');
      expect(result2.success).toBe(false);

      const result3 = await uploadAndSendSnap('conv', 'sender', null);
      expect(result3.success).toBe(false);
    });

    // Retry tests
    it('should retry on failure and succeed on third attempt', async () => {
      mockPutFile
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ state: 'success' });

      const result = await uploadAndSendSnap('conv-123', 'sender-456', 'file://photo.jpg');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('snap-msg-id');
      // putFile called 3 times (2 failures + 1 success)
      expect(mockPutFile).toHaveBeenCalledTimes(3);
    }, 15000);

    it('should return retriesExhausted when all 3 attempts fail', async () => {
      mockPutFile.mockRejectedValue(new Error('Persistent network error'));

      const result = await uploadAndSendSnap('conv-123', 'sender-456', 'file://photo.jpg');

      expect(result.success).toBe(false);
      expect(result.retriesExhausted).toBe(true);
      expect(result.error).toBe('Persistent network error');
      expect(mockPutFile).toHaveBeenCalledTimes(3);
    }, 15000);

    // Pinned snap tests
    it('should include pinned fields when pinToScreen is true', async () => {
      const result = await uploadAndSendSnap(
        'conv-123',
        'sender-456',
        'file://photo.jpg',
        'Check this out!',
        { pinToScreen: true }
      );

      expect(result.success).toBe(true);
      expect(result.pinnedActivityId).toBeDefined();

      const messageData = mockAddDoc.mock.calls[0][1];
      expect(messageData.pinned).toBe(true);
      expect(messageData.pinnedActivityId).toBeDefined();
      expect(typeof messageData.pinnedActivityId).toBe('string');
      expect(messageData.pinnedThumbnailUrl).toBe(
        'https://firebasestorage.example.com/snap-thumbnails/thumb.jpg'
      );
    });

    it('should include pinned: false when pinToScreen is false', async () => {
      const result = await uploadAndSendSnap('conv-123', 'sender-456', 'file://photo.jpg', null, {
        pinToScreen: false,
      });

      expect(result.success).toBe(true);
      expect(result.pinnedActivityId).toBeUndefined();

      const messageData = mockAddDoc.mock.calls[0][1];
      expect(messageData.pinned).toBe(false);
      expect(messageData.pinnedActivityId).toBeUndefined();
      expect(messageData.pinnedThumbnailUrl).toBeUndefined();
    });

    it('should default to pinned: false when options not provided', async () => {
      const result = await uploadAndSendSnap('conv-123', 'sender-456', 'file://photo.jpg');

      expect(result.success).toBe(true);

      const messageData = mockAddDoc.mock.calls[0][1];
      expect(messageData.pinned).toBe(false);
      expect(messageData.pinnedActivityId).toBeUndefined();
      expect(messageData.pinnedThumbnailUrl).toBeUndefined();
    });

    it('should upload thumbnail to snap-thumbnails/ path when pinToScreen is true', async () => {
      await uploadAndSendSnap('conv-123', 'sender-456', 'file://photo.jpg', null, {
        pinToScreen: true,
      });

      // putFile called twice: once for snap photo, once for thumbnail
      expect(mockPutFile).toHaveBeenCalledTimes(2);
      // getDownloadURL called once for the thumbnail
      expect(mockGetDownloadURL).toHaveBeenCalledTimes(1);
      // storageRef called for both snap-photos/ and snap-thumbnails/ paths
      const storagePaths = mockStorageRef.mock.calls.map(call => call[1]);
      expect(storagePaths.some(p => p.startsWith('snap-thumbnails/'))).toBe(true);
    });

    it('should NOT upload thumbnail when pinToScreen is false', async () => {
      await uploadAndSendSnap('conv-123', 'sender-456', 'file://photo.jpg', null, {
        pinToScreen: false,
      });

      // putFile called once: only for the snap photo
      expect(mockPutFile).toHaveBeenCalledTimes(1);
      // getDownloadURL not called (no thumbnail)
      expect(mockGetDownloadURL).not.toHaveBeenCalled();
      // storageRef should not include snap-thumbnails path
      const storagePaths = mockStorageRef.mock.calls.map(call => call[1]);
      expect(storagePaths.every(p => !p.startsWith('snap-thumbnails/'))).toBe(true);
    });
  });

  // ==========================================================================
  // markSnapViewed
  // ==========================================================================
  describe('markSnapViewed', () => {
    it('should update message document with viewedAt timestamp', async () => {
      const result = await markSnapViewed('conv-123', 'msg-456');

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(mockDocRef, {
        viewedAt: expect.anything(),
      });
    });

    it('should return error for missing conversationId', async () => {
      const result = await markSnapViewed(null, 'msg-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required fields');
    });

    it('should return error for missing messageId', async () => {
      const result = await markSnapViewed('conv-123', null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required fields');
    });

    it('should return error on Firestore failure', async () => {
      mockUpdateDoc.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await markSnapViewed('conv-123', 'msg-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });
  });

  // ==========================================================================
  // getSignedSnapUrl
  // ==========================================================================
  describe('getSignedSnapUrl', () => {
    it('should call httpsCallable with correct function name and path', async () => {
      const result = await getSignedSnapUrl('snap-photos/user123/snap456.jpg');

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://signed-url.example.com/snap.jpg');
      expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'getSignedSnapUrl');
      expect(mockCallableFn).toHaveBeenCalledWith({
        snapStoragePath: 'snap-photos/user123/snap456.jpg',
      });
    });

    it('should reject paths that do not start with snap-photos/', async () => {
      const result = await getSignedSnapUrl('photos/user123/photo.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid path: must start with snap-photos/');
      expect(mockHttpsCallable).not.toHaveBeenCalled();
    });

    it('should return error for missing snapStoragePath', async () => {
      const result = await getSignedSnapUrl(null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing snapStoragePath');
    });

    it('should return error on Cloud Function failure', async () => {
      mockCallableFn.mockRejectedValueOnce(new Error('Function unavailable'));

      const result = await getSignedSnapUrl('snap-photos/user123/snap456.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Function unavailable');
    });
  });
});
