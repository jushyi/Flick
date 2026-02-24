/**
 * Streak Service Unit Tests
 *
 * Tests for streakService including:
 * - Deterministic streak ID generation
 * - State derivation logic for all 5 visual states
 * - Color mapping with tier-based deepening
 * - Firestore subscription wiring (onSnapshot)
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

// Create mock functions for Firestore at module level
const mockUnsubscribe = jest.fn();
const mockOnSnapshot = jest.fn(() => mockUnsubscribe);
const mockDoc = jest.fn(() => ({ _type: 'docRef' }));
const mockCollection = jest.fn(() => ({ _type: 'collectionRef' }));
const mockQuery = jest.fn(() => ({ _type: 'queryRef' }));
const mockWhere = jest.fn(() => ({ _type: 'whereConstraint' }));
const mockGetFirestore = jest.fn(() => ({ _type: 'db' }));

// Mock @react-native-firebase/firestore
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => mockGetFirestore(),
  doc: (...args) => mockDoc(...args),
  collection: (...args) => mockCollection(...args),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
}));

// Import service AFTER mocks are set up
const {
  generateStreakId,
  deriveStreakState,
  getStreakColor,
  subscribeToStreak,
  subscribeToUserStreaks,
} = require('../../src/services/firebase/streakService');

describe('streakService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSnapshot.mockReturnValue(mockUnsubscribe);
  });

  // ================================================================
  // generateStreakId
  // ================================================================
  describe('generateStreakId', () => {
    it('generates deterministic ID with lower user ID first', () => {
      const id = generateStreakId('userB', 'userA');
      expect(id).toBe('userA_userB');
    });

    it('generates same ID regardless of argument order', () => {
      const id1 = generateStreakId('alice', 'bob');
      const id2 = generateStreakId('bob', 'alice');
      expect(id1).toBe(id2);
    });

    it('joins with underscore separator', () => {
      const id = generateStreakId('abc', 'xyz');
      expect(id).toBe('abc_xyz');
      expect(id).toContain('_');
    });
  });

  // ================================================================
  // deriveStreakState
  // ================================================================
  describe('deriveStreakState', () => {
    const currentUserId = 'user1';
    const friendId = 'user2';

    it("returns 'default' when streak is null", () => {
      expect(deriveStreakState(null, currentUserId)).toBe('default');
    });

    it("returns 'default' when streak has no lastSnapBy entries and no expiresAt", () => {
      const streak = {
        participants: [currentUserId, friendId],
        lastSnapBy: {},
        expiresAt: null,
      };
      expect(deriveStreakState(streak, currentUserId)).toBe('default');
    });

    it("returns 'building' when only friend has snapped (no expiresAt)", () => {
      const streak = {
        participants: [currentUserId, friendId],
        lastSnapBy: { [friendId]: { _seconds: 1000 } },
        expiresAt: null,
      };
      expect(deriveStreakState(streak, currentUserId)).toBe('building');
    });

    it("returns 'pending' when current user snapped but friend has not (no expiresAt)", () => {
      const streak = {
        participants: [currentUserId, friendId],
        lastSnapBy: { [currentUserId]: { _seconds: 1000 } },
        expiresAt: null,
      };
      expect(deriveStreakState(streak, currentUserId)).toBe('pending');
    });

    it("returns 'building' when dayCount is 1-2 (with expiresAt)", () => {
      const streak = {
        participants: [currentUserId, friendId],
        dayCount: 2,
        expiresAt: { _seconds: Date.now() / 1000 + 3600 },
        warning: false,
        lastSnapBy: {
          [currentUserId]: { _seconds: 1000 },
          [friendId]: { _seconds: 1001 },
        },
      };
      expect(deriveStreakState(streak, currentUserId)).toBe('building');
    });

    it("returns 'pending' when dayCount 1-2 and current user snapped in current cycle", () => {
      const streak = {
        participants: [currentUserId, friendId],
        dayCount: 1,
        expiresAt: { _seconds: Date.now() / 1000 + 3600 },
        warning: false,
        lastSnapBy: { [currentUserId]: { _seconds: 1000 } },
      };
      expect(deriveStreakState(streak, currentUserId)).toBe('pending');
    });

    it("returns 'active' when dayCount >= 3 and warning is false", () => {
      const streak = {
        participants: [currentUserId, friendId],
        dayCount: 5,
        expiresAt: { _seconds: Date.now() / 1000 + 3600 },
        warning: false,
        lastSnapBy: {
          [currentUserId]: { _seconds: 1000 },
          [friendId]: { _seconds: 1001 },
        },
      };
      expect(deriveStreakState(streak, currentUserId)).toBe('active');
    });

    it("returns 'warning' when warning is true (regardless of dayCount)", () => {
      const streak = {
        participants: [currentUserId, friendId],
        dayCount: 15,
        expiresAt: { _seconds: Date.now() / 1000 + 3600 },
        warning: true,
        lastSnapBy: {
          [currentUserId]: { _seconds: 1000 },
          [friendId]: { _seconds: 1001 },
        },
      };
      expect(deriveStreakState(streak, currentUserId)).toBe('warning');
    });

    it("returns 'active' for dayCount 3 (exact boundary)", () => {
      const streak = {
        participants: [currentUserId, friendId],
        dayCount: 3,
        expiresAt: { _seconds: Date.now() / 1000 + 3600 },
        warning: false,
        lastSnapBy: {
          [currentUserId]: { _seconds: 1000 },
          [friendId]: { _seconds: 1001 },
        },
      };
      expect(deriveStreakState(streak, currentUserId)).toBe('active');
    });
  });

  // ================================================================
  // getStreakColor
  // ================================================================
  describe('getStreakColor', () => {
    it('returns muted gray for default state', () => {
      expect(getStreakColor('default', 0)).toBe('#7B7B9E');
    });

    it('returns warm tint for building state', () => {
      expect(getStreakColor('building', 0)).toBe('#D4A574');
    });

    it('returns warm tint for pending state (same as building)', () => {
      expect(getStreakColor('pending', 0)).toBe('#D4A574');
    });

    it('returns light amber for active day 3-9', () => {
      expect(getStreakColor('active', 5)).toBe('#F5A623');
    });

    it('returns orange for active day 10-49', () => {
      expect(getStreakColor('active', 25)).toBe('#FF8C00');
    });

    it('returns deep orange for active day 50+', () => {
      expect(getStreakColor('active', 100)).toBe('#E65100');
    });

    it('returns red for warning state', () => {
      expect(getStreakColor('warning', 10)).toBe('#FF3333');
    });

    it('returns light amber for active day 3 (exact boundary)', () => {
      expect(getStreakColor('active', 3)).toBe('#F5A623');
    });

    it('returns orange for active day 10 (exact boundary)', () => {
      expect(getStreakColor('active', 10)).toBe('#FF8C00');
    });

    it('returns deep orange for active day 50 (exact boundary)', () => {
      expect(getStreakColor('active', 50)).toBe('#E65100');
    });
  });

  // ================================================================
  // subscribeToStreak
  // ================================================================
  describe('subscribeToStreak', () => {
    it('calls onSnapshot with correct document reference', () => {
      subscribeToStreak('userA', 'userB', jest.fn());

      expect(mockDoc).toHaveBeenCalled();
      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    });

    it('returns unsubscribe function', () => {
      const unsub = subscribeToStreak('userA', 'userB', jest.fn());
      expect(unsub).toBe(mockUnsubscribe);
    });

    it('calls callback with streak data when document exists', () => {
      const callback = jest.fn();
      subscribeToStreak('userA', 'userB', callback);

      // Extract the snapshot callback passed to onSnapshot
      const snapshotCallback = mockOnSnapshot.mock.calls[0][1];
      snapshotCallback({
        exists: () => true,
        id: 'userA_userB',
        data: () => ({ dayCount: 5, participants: ['userA', 'userB'] }),
      });

      expect(callback).toHaveBeenCalledWith({
        id: 'userA_userB',
        dayCount: 5,
        participants: ['userA', 'userB'],
      });
    });

    it('calls callback with null when document does not exist', () => {
      const callback = jest.fn();
      subscribeToStreak('userA', 'userB', callback);

      const snapshotCallback = mockOnSnapshot.mock.calls[0][1];
      snapshotCallback({
        exists: () => false,
        id: 'userA_userB',
        data: () => null,
      });

      expect(callback).toHaveBeenCalledWith(null);
    });
  });

  // ================================================================
  // subscribeToUserStreaks
  // ================================================================
  describe('subscribeToUserStreaks', () => {
    it('queries with array-contains for userId', () => {
      subscribeToUserStreaks('user1', jest.fn());

      expect(mockWhere).toHaveBeenCalledWith('participants', 'array-contains', 'user1');
      expect(mockQuery).toHaveBeenCalled();
      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    });

    it('returns unsubscribe function', () => {
      const unsub = subscribeToUserStreaks('user1', jest.fn());
      expect(unsub).toBe(mockUnsubscribe);
    });

    it('calls callback with array of streak objects', () => {
      const callback = jest.fn();
      subscribeToUserStreaks('user1', callback);

      const snapshotCallback = mockOnSnapshot.mock.calls[0][1];
      snapshotCallback({
        docs: [
          {
            id: 'user1_user2',
            data: () => ({ dayCount: 3, participants: ['user1', 'user2'] }),
          },
          {
            id: 'user1_user3',
            data: () => ({ dayCount: 10, participants: ['user1', 'user3'] }),
          },
        ],
      });

      expect(callback).toHaveBeenCalledWith([
        { id: 'user1_user2', dayCount: 3, participants: ['user1', 'user2'] },
        { id: 'user1_user3', dayCount: 10, participants: ['user1', 'user3'] },
      ]);
    });
  });
});
