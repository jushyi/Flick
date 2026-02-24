/**
 * Photo Tag Service Unit Tests
 *
 * Tests for addTaggedPhotoToFeed Cloud Function callable wrapper.
 * Verifies correct function invocation, parameter passing, success/error returns,
 * and error logging.
 */

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Cloud Functions mock
const mockCallable = jest.fn();
const mockHttpsCallable = jest.fn(() => mockCallable);

jest.mock('@react-native-firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: (...args) => mockHttpsCallable(...args),
}));

const logger = require('../../src/utils/logger');
const { addTaggedPhotoToFeed } = require('../../src/services/firebase/photoTagService');

describe('photoTagService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addTaggedPhotoToFeed', () => {
    it('calls httpsCallable with correct function name', async () => {
      mockCallable.mockResolvedValueOnce({ data: { newPhotoId: 'new-photo-123' } });

      await addTaggedPhotoToFeed('photo-1', 'conv-1', 'msg-1');

      expect(mockHttpsCallable).toHaveBeenCalledWith({}, 'addTaggedPhotoToFeed');
    });

    it('passes photoId, conversationId, messageId to callable', async () => {
      mockCallable.mockResolvedValueOnce({ data: { newPhotoId: 'new-photo-123' } });

      await addTaggedPhotoToFeed('photo-abc', 'conv-xyz', 'msg-456');

      expect(mockCallable).toHaveBeenCalledWith({
        photoId: 'photo-abc',
        conversationId: 'conv-xyz',
        messageId: 'msg-456',
      });
    });

    it('returns { success: true, newPhotoId } on success', async () => {
      mockCallable.mockResolvedValueOnce({ data: { newPhotoId: 'created-photo-789' } });

      const result = await addTaggedPhotoToFeed('photo-1', 'conv-1', 'msg-1');

      expect(result).toEqual({
        success: true,
        newPhotoId: 'created-photo-789',
      });
    });

    it('returns { success: false, error } on failure', async () => {
      mockCallable.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await addTaggedPhotoToFeed('photo-1', 'conv-1', 'msg-1');

      expect(result).toEqual({
        success: false,
        error: 'Permission denied',
      });
    });

    it('logs error on failure', async () => {
      mockCallable.mockRejectedValueOnce(new Error('Network error'));

      await addTaggedPhotoToFeed('photo-fail', 'conv-1', 'msg-1');

      expect(logger.error).toHaveBeenCalledWith('addTaggedPhotoToFeed failed', {
        error: 'Network error',
        photoId: 'photo-fail',
      });
    });
  });
});
