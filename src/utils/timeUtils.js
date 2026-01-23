/**
 * Time utility functions for formatting timestamps
 * Used throughout the app for displaying relative time
 */

import logger from './logger';

/**
 * Convert Firestore timestamp to "X ago" format
 * Examples: "2m ago", "3h ago", "1d ago", "Jan 5"
 *
 * @param {object} timestamp - Firestore Timestamp object
 * @returns {string} - Formatted time string
 */
export const getTimeAgo = timestamp => {
  if (!timestamp) return 'Unknown';

  try {
    // Convert Firestore timestamp to Date
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);

    // Less than 1 minute
    if (diffMin < 1) {
      return 'Just now';
    }

    // Less than 1 hour
    if (diffMin < 60) {
      return `${diffMin}m ago`;
    }

    // Less than 24 hours
    if (diffHour < 24) {
      return `${diffHour}h ago`;
    }

    // Less than 7 days
    if (diffDay < 7) {
      return `${diffDay}d ago`;
    }

    // Less than 4 weeks
    if (diffWeek < 4) {
      return `${diffWeek}w ago`;
    }

    // More than 4 weeks - show date
    return formatDate(date);
  } catch (error) {
    logger.error('timeUtils: Error formatting time ago', { error: error.message });
    return 'Unknown';
  }
};

/**
 * Format date as "Jan 5" or "Jan 5, 2025" if different year
 *
 * @param {Date} date - Date object
 * @returns {string} - Formatted date string
 */
export const formatDate = date => {
  try {
    const now = new Date();
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const currentYear = now.getFullYear();

    if (year === currentYear) {
      return `${month} ${day}`;
    }

    return `${month} ${day}, ${year}`;
  } catch (error) {
    logger.error('timeUtils: Error formatting date', { error: error.message });
    return 'Unknown';
  }
};

/**
 * Format timestamp as full date and time
 * Example: "Jan 5, 2026 at 3:45 PM"
 *
 * @param {object} timestamp - Firestore Timestamp object
 * @returns {string} - Formatted date and time string
 */
export const formatFullDateTime = timestamp => {
  if (!timestamp) return 'Unknown';

  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const minutesStr = minutes < 10 ? `0${minutes}` : minutes;

    return `${month} ${day}, ${year} at ${hours}:${minutesStr} ${ampm}`;
  } catch (error) {
    logger.error('timeUtils: Error formatting full date time', { error: error.message });
    return 'Unknown';
  }
};

/**
 * Get countdown string for darkroom reveal
 * Example: "Ready to reveal!" or "Reveals in 1h 23m"
 *
 * @param {object} timestamp - Firestore Timestamp object (nextRevealAt)
 * @returns {string} - Countdown string
 */
export const getRevealCountdown = timestamp => {
  if (!timestamp) return 'Unknown';

  try {
    const revealTime = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = revealTime - now;

    // If past reveal time
    if (diffMs <= 0) {
      return 'Ready to reveal!';
    }

    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    const hours = diffHour;
    const minutes = diffMin % 60;

    if (hours > 0) {
      return `Reveals in ${hours}h ${minutes}m`;
    }

    return `Reveals in ${minutes}m`;
  } catch (error) {
    logger.error('timeUtils: Error formatting reveal countdown', { error: error.message });
    return 'Unknown';
  }
};

/**
 * Check if timestamp is today
 *
 * @param {object} timestamp - Firestore Timestamp object
 * @returns {boolean} - True if timestamp is today
 */
export const isToday = timestamp => {
  if (!timestamp) return false;

  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();

    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  } catch (error) {
    return false;
  }
};

/**
 * Check if timestamp is within last 7 days
 *
 * @param {object} timestamp - Firestore Timestamp object
 * @returns {boolean} - True if within last 7 days
 */
export const isWithinLastWeek = timestamp => {
  if (!timestamp) return false;

  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return diffDays <= 7;
  } catch (error) {
    return false;
  }
};
