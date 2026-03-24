/**
 * Supabase Streak Service Tests
 *
 * Tests pure functions for streak state derivation and color mapping.
 * No mocks needed -- streakService is entirely pure functions.
 */

import {
  generateStreakId,
  deriveStreakState,
  getStreakColor,
  StreakData,
  StreakState,
} from '../../src/services/supabase/streakService';

// ============================================================================
// Test helpers
// ============================================================================

const makeStreak = (overrides: Partial<StreakData> = {}): StreakData => ({
  id: 'aaa_bbb',
  user1_id: 'aaa',
  user2_id: 'bbb',
  day_count: 0,
  last_snap_at_user1: null,
  last_snap_at_user2: null,
  last_mutual_at: null,
  expires_at: null,
  warning_sent: 0,
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe('streakService', () => {
  // ========================================================================
  // generateStreakId
  // ========================================================================
  describe('generateStreakId', () => {
    it('sorts IDs alphabetically and joins with underscore', () => {
      expect(generateStreakId('bbb', 'aaa')).toBe('aaa_bbb');
    });

    it('returns same result regardless of argument order', () => {
      expect(generateStreakId('user-alpha', 'user-beta')).toBe(
        generateStreakId('user-beta', 'user-alpha')
      );
    });

    it('handles identical prefix IDs correctly', () => {
      expect(generateStreakId('abc123', 'abc000')).toBe('abc000_abc123');
    });
  });

  // ========================================================================
  // deriveStreakState
  // ========================================================================
  describe('deriveStreakState', () => {
    it('returns default when streak is null', () => {
      expect(deriveStreakState(null, 'aaa')).toBe('default');
    });

    it('returns default when no expires_at and no snaps', () => {
      const streak = makeStreak();
      expect(deriveStreakState(streak, 'aaa')).toBe('default');
    });

    it('returns pending when only my snap is set (no expires_at)', () => {
      const streak = makeStreak({
        last_snap_at_user1: '2026-03-24T10:00:00Z',
      });
      expect(deriveStreakState(streak, 'aaa')).toBe('pending');
    });

    it('returns building when only their snap is set (no expires_at)', () => {
      const streak = makeStreak({
        last_snap_at_user2: '2026-03-24T10:00:00Z',
      });
      expect(deriveStreakState(streak, 'aaa')).toBe('building');
    });

    it('returns building when both snaps set but no expires_at', () => {
      const streak = makeStreak({
        last_snap_at_user1: '2026-03-24T10:00:00Z',
        last_snap_at_user2: '2026-03-24T11:00:00Z',
      });
      expect(deriveStreakState(streak, 'aaa')).toBe('building');
    });

    it('returns active when day_count >= 3 and has expires_at', () => {
      const streak = makeStreak({
        day_count: 5,
        expires_at: '2026-03-26T10:00:00Z',
      });
      expect(deriveStreakState(streak, 'aaa')).toBe('active');
    });

    it('returns warning when warning_sent is 1 (SQLite truthy)', () => {
      const streak = makeStreak({
        day_count: 10,
        expires_at: '2026-03-25T10:00:00Z',
        warning_sent: 1,
      });
      expect(deriveStreakState(streak, 'aaa')).toBe('warning');
    });

    it('warning takes priority over active even with high day_count', () => {
      const streak = makeStreak({
        day_count: 50,
        expires_at: '2026-03-25T10:00:00Z',
        warning_sent: 1,
      });
      expect(deriveStreakState(streak, 'aaa')).toBe('warning');
    });

    it('returns pending for low day_count with expires_at when only I snapped', () => {
      const streak = makeStreak({
        day_count: 1,
        expires_at: '2026-03-26T10:00:00Z',
        last_snap_at_user1: '2026-03-24T10:00:00Z',
      });
      expect(deriveStreakState(streak, 'aaa')).toBe('pending');
    });

    it('returns building for low day_count with expires_at when they snapped', () => {
      const streak = makeStreak({
        day_count: 2,
        expires_at: '2026-03-26T10:00:00Z',
        last_snap_at_user2: '2026-03-24T10:00:00Z',
      });
      expect(deriveStreakState(streak, 'aaa')).toBe('building');
    });

    it('correctly identifies user2 perspective', () => {
      // user2_id = 'bbb', their snap is last_snap_at_user2
      const streak = makeStreak({
        last_snap_at_user2: '2026-03-24T10:00:00Z', // bbb's snap
      });
      // From bbb's perspective, bbb snapped (mySnap set, theirSnap not)
      expect(deriveStreakState(streak, 'bbb')).toBe('pending');
    });
  });

  // ========================================================================
  // getStreakColor
  // ========================================================================
  describe('getStreakColor', () => {
    it('returns warning color for warning state', () => {
      const color = getStreakColor('warning', 10);
      expect(color).toBe('#FF3333');
    });

    it('returns tier1 color for active with day_count < 10', () => {
      const color = getStreakColor('active', 5);
      expect(color).toBe('#F5A623');
    });

    it('returns tier2 color for active with day_count 10-49', () => {
      const color = getStreakColor('active', 25);
      expect(color).toBe('#FF8C00');
    });

    it('returns tier3 color for active with day_count >= 50', () => {
      const color = getStreakColor('active', 50);
      expect(color).toBe('#E65100');
    });

    it('returns tier3 color for very high day_count', () => {
      const color = getStreakColor('active', 365);
      expect(color).toBe('#E65100');
    });

    it('returns pending color for pending state', () => {
      const color = getStreakColor('pending', 0);
      expect(color).toBe('#FFD700');
    });

    it('returns building color for building state', () => {
      const color = getStreakColor('building', 0);
      expect(color).toBe('#00D4FF');
    });

    it('returns default color for default state', () => {
      const color = getStreakColor('default', 0);
      expect(color).toBe('#7B7B9E');
    });

    it('returns tier1 at exact boundary (day_count 3)', () => {
      expect(getStreakColor('active', 3)).toBe('#F5A623');
    });

    it('returns tier2 at exact boundary (day_count 10)', () => {
      expect(getStreakColor('active', 10)).toBe('#FF8C00');
    });

    it('returns tier1 at boundary minus one (day_count 9)', () => {
      expect(getStreakColor('active', 9)).toBe('#F5A623');
    });
  });
});
