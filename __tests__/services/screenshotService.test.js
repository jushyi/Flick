/**
 * Screenshot Service Unit Tests (RED)
 *
 * Tests for screenshotService including:
 * - recordScreenshot: screenshottedAt write, system message creation, idempotency
 * - Error handling for Firestore failures
 *
 * These tests are RED — screenshotService.js does not exist yet.
 * They will pass once Plan 08-01 implements the service.
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
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn(() => Promise.resolve());
const mockAddDoc = jest.fn(() => Promise.resolve({ id: 'system-msg-id' }));
const mockServerTimestamp = jest.fn(() => ({ _serverTimestamp: true }));
const mockDoc = jest.fn(() => ({ id: 'mock-doc-ref' }));
const mockCollection = jest.fn(() => ({ id: 'mock-collection-ref' }));
const mockGetFirestore = jest.fn(() => ({}));

// Mock @react-native-firebase/firestore
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => mockGetFirestore(),
  collection: (...args) => mockCollection(...args),
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  addDoc: (...args) => mockAddDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

// Import service under test (will fail until 08-01 creates the module)
const { recordScreenshot } = require('../../src/services/firebase/screenshotService');

describe('screenshotService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordScreenshot', () => {
    it('writes screenshottedAt timestamp on the snap message document', async () => {
      // Set up mockGetDoc to return a snap doc with no existing screenshot
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ type: 'snap', screenshottedAt: null }),
      });

      await recordScreenshot({
        conversationId: 'conv1',
        snapMessageId: 'snap1',
        screenshotterId: 'user2',
        screenshotterName: 'Alex',
      });

      // Assert updateDoc was called with screenshottedAt
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          screenshottedAt: expect.anything(),
        })
      );
    });

    it('creates a system_screenshot message in the conversation messages subcollection', async () => {
      // Set up mockGetDoc to return a snap doc with no existing screenshot
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ type: 'snap', screenshottedAt: null }),
      });

      await recordScreenshot({
        conversationId: 'conv1',
        snapMessageId: 'snap1',
        screenshotterId: 'user2',
        screenshotterName: 'Alex',
      });

      // Assert addDoc was called with system_screenshot message
      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'system_screenshot',
          senderId: 'user2',
          screenshotterId: 'user2',
          snapMessageId: 'snap1',
          text: expect.stringContaining('Alex'),
        })
      );
    });

    it('returns alreadyScreenshotted: true and does NOT create duplicate system message when screenshottedAt already exists', async () => {
      // Set up mockGetDoc to return a snap doc WITH existing screenshot
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ type: 'snap', screenshottedAt: { _seconds: 123 } }),
      });

      const result = await recordScreenshot({
        conversationId: 'conv1',
        snapMessageId: 'snap1',
        screenshotterId: 'user2',
        screenshotterName: 'Alex',
      });

      expect(result.alreadyScreenshotted).toBe(true);
      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('returns skipped: true for non-snap message types', async () => {
      // Set up mockGetDoc to return a text message (not a snap)
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ type: 'text' }),
      });

      const result = await recordScreenshot({
        conversationId: 'conv1',
        snapMessageId: 'snap1',
        screenshotterId: 'user2',
        screenshotterName: 'Alex',
      });

      expect(result.skipped).toBe(true);
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('returns { success: false, error } on Firestore write failure', async () => {
      // Set up mockGetDoc to return a valid snap doc
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ type: 'snap', screenshottedAt: null }),
      });

      // Make updateDoc reject with an error
      mockUpdateDoc.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await recordScreenshot({
        conversationId: 'conv1',
        snapMessageId: 'snap1',
        screenshotterId: 'user2',
        screenshotterName: 'Alex',
      });

      expect(result.success).toBe(false);
      expect(typeof result.error).toBe('string');
    });
  });
});
