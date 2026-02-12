/**
 * Mention Service Unit Tests
 *
 * Tests for mention service including:
 * - getMutualFriendsForTagging (Cloud Function call via httpsCallable)
 * - Success, empty result, error, and invalid input cases
 */

// Mock logger to prevent console output
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Create mock callable function at module level
const mockCallable = jest.fn();
const mockHttpsCallable = jest.fn(() => mockCallable);

// Mock @react-native-firebase/functions with modular API
jest.mock('@react-native-firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: (...args) => mockHttpsCallable(...args),
}));

// Import service AFTER mocks are set up
const { getMutualFriendsForTagging } = require('../../src/services/firebase/mentionService');

const { createTestMention } = require('../setup/testFactories');

describe('mentionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // getMutualFriendsForTagging tests
  // ===========================================================================
  describe('getMutualFriendsForTagging', () => {
    it('should return mutual friends from Cloud Function', async () => {
      const mockFriends = [
        createTestMention({ uid: 'friend-1', displayName: 'Alice', username: 'alice' }),
        createTestMention({ uid: 'friend-2', displayName: 'Bob', username: 'bob' }),
      ];

      mockCallable.mockResolvedValueOnce({
        data: { mutualFriends: mockFriends },
      });

      const result = await getMutualFriendsForTagging('photo-owner-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockFriends);
      expect(result.data).toHaveLength(2);
      expect(mockHttpsCallable).toHaveBeenCalledWith(
        expect.anything(),
        'getMutualFriendsForComments'
      );
      expect(mockCallable).toHaveBeenCalledWith({ photoOwnerId: 'photo-owner-123' });
    });

    it('should return empty array when no mutual friends exist', async () => {
      mockCallable.mockResolvedValueOnce({
        data: { mutualFriends: [] },
      });

      const result = await getMutualFriendsForTagging('photo-owner-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle unexpected response format', async () => {
      mockCallable.mockResolvedValueOnce({
        data: { someOtherField: 'unexpected' },
      });

      const result = await getMutualFriendsForTagging('photo-owner-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected response from server');
    });

    it('should handle null data in response', async () => {
      mockCallable.mockResolvedValueOnce({
        data: null,
      });

      const result = await getMutualFriendsForTagging('photo-owner-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected response from server');
    });

    it('should handle Cloud Function error gracefully', async () => {
      mockCallable.mockRejectedValueOnce(new Error('Cloud Function timeout'));

      const result = await getMutualFriendsForTagging('photo-owner-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cloud Function timeout');
    });

    it('should handle network error', async () => {
      mockCallable.mockRejectedValueOnce(new Error('Network request failed'));

      const result = await getMutualFriendsForTagging('photo-owner-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network request failed');
    });

    it('should handle error with code property', async () => {
      const firebaseError = new Error('Permission denied');
      firebaseError.code = 'permission-denied';
      mockCallable.mockRejectedValueOnce(firebaseError);

      const result = await getMutualFriendsForTagging('photo-owner-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });

    it('should pass photoOwnerId to Cloud Function correctly', async () => {
      mockCallable.mockResolvedValueOnce({
        data: { mutualFriends: [] },
      });

      await getMutualFriendsForTagging('specific-owner-id-789');

      expect(mockCallable).toHaveBeenCalledWith({ photoOwnerId: 'specific-owner-id-789' });
    });

    it('should handle error with no message', async () => {
      const error = new Error();
      error.message = '';
      mockCallable.mockRejectedValueOnce(error);

      const result = await getMutualFriendsForTagging('photo-owner-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fetch mutual friends');
    });
  });
});
