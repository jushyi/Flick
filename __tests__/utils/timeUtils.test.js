/**
 * Time Utilities Tests
 *
 * Tests all exported functions from src/utils/timeUtils.js.
 * Uses real Date objects and Firestore-like timestamp mocks.
 */

import {
  getTimeAgo,
  formatDate,
  formatFullDateTime,
  getRevealCountdown,
  isToday,
  isWithinLastWeek,
} from '../../src/utils/timeUtils';

// Helper to create a Firestore-like timestamp
const createTimestamp = date => ({
  toDate: () => date,
});

// =============================================================================
// getTimeAgo
// =============================================================================
describe('getTimeAgo', () => {
  it('should return "Just now" for timestamps less than 60 seconds ago', () => {
    const now = new Date();
    const thirtySecsAgo = new Date(now.getTime() - 30 * 1000);
    expect(getTimeAgo(createTimestamp(thirtySecsAgo))).toBe('Just now');
  });

  it('should return minutes ago for timestamps less than 60 minutes ago', () => {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    expect(getTimeAgo(createTimestamp(fiveMinAgo))).toBe('5m ago');
  });

  it('should return hours ago for timestamps less than 24 hours ago', () => {
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    expect(getTimeAgo(createTimestamp(threeHoursAgo))).toBe('3h ago');
  });

  it('should return days ago for timestamps less than 7 days ago', () => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    expect(getTimeAgo(createTimestamp(twoDaysAgo))).toBe('2d ago');
  });

  it('should return weeks ago for timestamps less than 4 weeks ago', () => {
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    expect(getTimeAgo(createTimestamp(twoWeeksAgo))).toBe('2w ago');
  });

  it('should return formatted date for timestamps older than 4 weeks', () => {
    const now = new Date();
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const result = getTimeAgo(createTimestamp(twoMonthsAgo));
    // Should be a date format like "Dec 14" or "Dec 14, 2025"
    expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}/);
  });

  it('should return "Unknown" for null timestamp', () => {
    expect(getTimeAgo(null)).toBe('Unknown');
  });

  it('should return "Unknown" for undefined timestamp', () => {
    expect(getTimeAgo(undefined)).toBe('Unknown');
  });

  it('should handle plain Date objects (no toDate method)', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(getTimeAgo(fiveMinAgo)).toBe('5m ago');
  });
});

// =============================================================================
// formatDate
// =============================================================================
describe('formatDate', () => {
  it('should format current year dates as "Mon D"', () => {
    const date = new Date(new Date().getFullYear(), 0, 15); // Jan 15 current year
    expect(formatDate(date)).toBe('Jan 15');
  });

  it('should format different year dates as "Mon D, YYYY"', () => {
    const date = new Date(2020, 5, 20); // Jun 20, 2020
    expect(formatDate(date)).toBe('Jun 20, 2020');
  });

  it('should handle various months correctly', () => {
    const year = new Date().getFullYear();
    expect(formatDate(new Date(year, 0, 1))).toBe('Jan 1');
    expect(formatDate(new Date(year, 11, 31))).toBe('Dec 31');
    expect(formatDate(new Date(year, 6, 4))).toBe('Jul 4');
  });

  it('should return "Unknown" for invalid date', () => {
    expect(formatDate(null)).toBe('Unknown');
  });
});

// =============================================================================
// formatFullDateTime
// =============================================================================
describe('formatFullDateTime', () => {
  it('should format timestamp as "Mon D, YYYY at H:MM AM/PM"', () => {
    const date = new Date(2026, 0, 15, 15, 45); // Jan 15, 2026 at 3:45 PM
    const result = formatFullDateTime(createTimestamp(date));
    expect(result).toBe('Jan 15, 2026 at 3:45 PM');
  });

  it('should handle midnight correctly (12:00 AM)', () => {
    const date = new Date(2026, 0, 1, 0, 0); // Midnight
    const result = formatFullDateTime(createTimestamp(date));
    expect(result).toBe('Jan 1, 2026 at 12:00 AM');
  });

  it('should handle noon correctly (12:00 PM)', () => {
    const date = new Date(2026, 0, 1, 12, 0); // Noon
    const result = formatFullDateTime(createTimestamp(date));
    expect(result).toBe('Jan 1, 2026 at 12:00 PM');
  });

  it('should pad single-digit minutes with zero', () => {
    const date = new Date(2026, 0, 1, 9, 5); // 9:05 AM
    const result = formatFullDateTime(createTimestamp(date));
    expect(result).toBe('Jan 1, 2026 at 9:05 AM');
  });

  it('should return "Unknown" for null timestamp', () => {
    expect(formatFullDateTime(null)).toBe('Unknown');
  });

  it('should return "Unknown" for undefined timestamp', () => {
    expect(formatFullDateTime(undefined)).toBe('Unknown');
  });
});

// =============================================================================
// getRevealCountdown
// =============================================================================
describe('getRevealCountdown', () => {
  it('should return "Ready to reveal!" when reveal time is in the past', () => {
    const pastTime = new Date(Date.now() - 60 * 1000); // 1 min ago
    expect(getRevealCountdown(createTimestamp(pastTime))).toBe('Ready to reveal!');
  });

  it('should return "Ready to reveal!" when reveal time is exactly now', () => {
    const now = new Date();
    expect(getRevealCountdown(createTimestamp(now))).toBe('Ready to reveal!');
  });

  it('should return hours and minutes for future reveal time', () => {
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000); // 2h 30m
    const result = getRevealCountdown(createTimestamp(futureTime));
    expect(result).toBe('Reveals in 2h 30m');
  });

  it('should return only minutes when less than 1 hour', () => {
    const futureTime = new Date(Date.now() + 45 * 60 * 1000); // 45 min
    const result = getRevealCountdown(createTimestamp(futureTime));
    expect(result).toMatch(/^Reveals in 4[45]m$/);
  });

  it('should return "Unknown" for null timestamp', () => {
    expect(getRevealCountdown(null)).toBe('Unknown');
  });
});

// =============================================================================
// isToday
// =============================================================================
describe('isToday', () => {
  it('should return true for a timestamp from today', () => {
    const now = new Date();
    expect(isToday(createTimestamp(now))).toBe(true);
  });

  it('should return false for a timestamp from yesterday', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(isToday(createTimestamp(yesterday))).toBe(false);
  });

  it('should return false for a timestamp from tomorrow', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(isToday(createTimestamp(tomorrow))).toBe(false);
  });

  it('should return false for null timestamp', () => {
    expect(isToday(null)).toBe(false);
  });

  it('should return false for undefined timestamp', () => {
    expect(isToday(undefined)).toBe(false);
  });
});

// =============================================================================
// isWithinLastWeek
// =============================================================================
describe('isWithinLastWeek', () => {
  it('should return true for timestamps within last 7 days', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(isWithinLastWeek(createTimestamp(threeDaysAgo))).toBe(true);
  });

  it('should return true for timestamps exactly 7 days ago', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    expect(isWithinLastWeek(createTimestamp(sevenDaysAgo))).toBe(true);
  });

  it('should return false for timestamps 8 days ago', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(isWithinLastWeek(createTimestamp(eightDaysAgo))).toBe(false);
  });

  it('should return true for today', () => {
    const now = new Date();
    expect(isWithinLastWeek(createTimestamp(now))).toBe(true);
  });

  it('should return false for null timestamp', () => {
    expect(isWithinLastWeek(null)).toBe(false);
  });

  it('should return false for undefined timestamp', () => {
    expect(isWithinLastWeek(undefined)).toBe(false);
  });
});
