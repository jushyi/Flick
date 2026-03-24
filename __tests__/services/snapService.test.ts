/**
 * Supabase Snap Service Tests
 *
 * Tests snap upload/send, mark viewed, and signed URL generation.
 * Mocks are self-contained -- does not rely on global __supabaseMocks.
 */

// ============================================================================
// Mock setup (must be before imports)
// ============================================================================

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(() =>
    Promise.resolve({ uri: 'file://compressed.webp', width: 1080, height: 1920 })
  ),
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
    WEBP: 'webp',
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(() => Promise.resolve('bW9ja0Jhc2U2NA==')),
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8',
  },
}));

jest.mock('base64-arraybuffer', () => ({
  decode: jest.fn((base64: string) => new ArrayBuffer(base64.length)),
}));

// Persistent mock functions (prefixed with 'mock' to satisfy jest.mock scope rules)
const mockUploadFn = jest.fn();
const mockCreateSignedUrlFn = jest.fn();
const mockUpdateFn = jest.fn();
const mockEqFn = jest.fn();
const mockStorageFromFn = jest.fn();
const mockFromFn = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: { from: (...args: any[]) => mockStorageFromFn(...args) },
    from: (...args: any[]) => mockFromFn(...args),
  },
}));

// Mock sendMessage
const mockSendMessageFn = jest.fn();
jest.mock('../../src/services/supabase/messageService', () => ({
  sendMessage: (...args: any[]) => mockSendMessageFn(...args),
}));

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

// ============================================================================
// Import after mocks
// ============================================================================

import * as ImageManipulator from 'expo-image-manipulator';

import { uploadAndSendSnap, markSnapViewed, getSignedSnapUrl } from '../../src/services/supabase/snapService';

// ============================================================================
// Tests
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();

  // Reset mock implementations each test
  mockUploadFn.mockResolvedValue({ error: null });
  mockCreateSignedUrlFn.mockResolvedValue({
    data: { signedUrl: 'https://test.supabase.co/storage/v1/object/sign/snaps/path?token=abc' },
    error: null,
  });
  mockStorageFromFn.mockReturnValue({
    upload: mockUploadFn,
    createSignedUrl: mockCreateSignedUrlFn,
  });

  mockEqFn.mockResolvedValue({ error: null });
  mockUpdateFn.mockReturnValue({ eq: mockEqFn });
  mockFromFn.mockReturnValue({ update: mockUpdateFn });

  mockSendMessageFn.mockResolvedValue({ messageId: 'msg-123' });
});

describe('snapService', () => {
  // ========================================================================
  // uploadAndSendSnap
  // ========================================================================
  describe('uploadAndSendSnap', () => {
    it('compresses image to WebP at 1080px width with 0.9 quality', async () => {
      await uploadAndSendSnap('conv-1', 'user-1', 'file:///photo.jpg');

      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        'file:///photo.jpg',
        [{ resize: { width: 1080 } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.WEBP }
      );
    });

    it('uploads to snaps bucket with correct content type and no-cache', async () => {
      await uploadAndSendSnap('conv-1', 'user-1', 'file:///photo.jpg');

      expect(mockStorageFromFn).toHaveBeenCalledWith('snaps');
      expect(mockUploadFn).toHaveBeenCalledWith(
        expect.stringMatching(/^user-1\/\d+-[a-z0-9]+\.webp$/),
        expect.any(ArrayBuffer),
        { contentType: 'image/webp', cacheControl: 'no-store' }
      );
    });

    it('calls sendMessage with type snap and truncated caption', async () => {
      const longCaption = 'a'.repeat(200);
      await uploadAndSendSnap('conv-1', 'user-1', 'file:///photo.jpg', longCaption);

      expect(mockSendMessageFn).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        senderId: 'user-1',
        type: 'snap',
        text: 'a'.repeat(150),
      });
    });

    it('updates message with snap_storage_path after send', async () => {
      await uploadAndSendSnap('conv-1', 'user-1', 'file:///photo.jpg');

      expect(mockFromFn).toHaveBeenCalledWith('messages');
      expect(mockUpdateFn).toHaveBeenCalledWith({
        snap_storage_path: expect.stringMatching(/^user-1\/\d+-[a-z0-9]+\.webp$/),
      });
      expect(mockEqFn).toHaveBeenCalledWith('id', 'msg-123');
    });

    it('retries on failure with exponential backoff', async () => {
      // First attempt upload fails, second succeeds
      mockUploadFn
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ error: null });

      const result = await uploadAndSendSnap('conv-1', 'user-1', 'file:///photo.jpg');

      expect(result).toEqual({ messageId: 'msg-123' });
      // Should have called upload twice (first fail, second success)
      expect(mockUploadFn).toHaveBeenCalledTimes(2);
    });

    it('throws after all retries exhausted', async () => {
      mockUploadFn.mockRejectedValue(new Error('Persistent failure'));

      await expect(
        uploadAndSendSnap('conv-1', 'user-1', 'file:///photo.jpg')
      ).rejects.toThrow('Persistent failure');

      // Should have attempted 3 times
      expect(mockUploadFn).toHaveBeenCalledTimes(3);
    });

    it('sends null text when no caption provided', async () => {
      await uploadAndSendSnap('conv-1', 'user-1', 'file:///photo.jpg');

      expect(mockSendMessageFn).toHaveBeenCalledWith(
        expect.objectContaining({ text: null })
      );
    });
  });

  // ========================================================================
  // markSnapViewed
  // ========================================================================
  describe('markSnapViewed', () => {
    it('updates snap_viewed_at on the message', async () => {
      await markSnapViewed('msg-456');

      expect(mockFromFn).toHaveBeenCalledWith('messages');
      expect(mockUpdateFn).toHaveBeenCalledWith({
        snap_viewed_at: expect.any(String),
      });
      expect(mockEqFn).toHaveBeenCalledWith('id', 'msg-456');
    });

    it('throws on update failure', async () => {
      mockEqFn.mockResolvedValueOnce({ error: { message: 'Not found' } });

      await expect(markSnapViewed('msg-999')).rejects.toEqual({ message: 'Not found' });
    });
  });

  // ========================================================================
  // getSignedSnapUrl
  // ========================================================================
  describe('getSignedSnapUrl', () => {
    it('calls createSignedUrl with 300 seconds expiry', async () => {
      const url = await getSignedSnapUrl('user-1/snap123.webp');

      expect(mockStorageFromFn).toHaveBeenCalledWith('snaps');
      expect(mockCreateSignedUrlFn).toHaveBeenCalledWith('user-1/snap123.webp', 300);
      expect(url).toBe('https://test.supabase.co/storage/v1/object/sign/snaps/path?token=abc');
    });

    it('throws on signed URL generation failure', async () => {
      mockCreateSignedUrlFn.mockResolvedValueOnce({
        data: null,
        error: { message: 'Bucket not found' },
      });

      await expect(getSignedSnapUrl('bad/path.webp')).rejects.toEqual({
        message: 'Bucket not found',
      });
    });
  });
});
