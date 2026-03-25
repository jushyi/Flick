import logger from './logger';

interface TimestampLike {
  toDate?: () => Date;
}

type TimestampInput = TimestampLike | Date | string | number;

export const getTimeAgo = (timestamp: TimestampInput | null | undefined): string => {
  if (!timestamp) return 'Unknown';

  try {
    const ts = timestamp as TimestampLike;
    const date = ts.toDate ? ts.toDate() : new Date(timestamp as string | number);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    if (diffWeek < 4) return `${diffWeek}w ago`;

    return formatDate(date);
  } catch (err) {
    const e = err as Error;
    logger.error('timeUtils: Error formatting time ago', { error: e.message });
    return 'Unknown';
  }
};

export const formatDate = (date: Date): string => {
  try {
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const currentYear = now.getFullYear();

    if (year === currentYear) {
      return `${month} ${day}`;
    }
    return `${month} ${day}, ${year}`;
  } catch (err) {
    const e = err as Error;
    logger.error('timeUtils: Error formatting date', { error: e.message });
    return 'Unknown';
  }
};

export const formatFullDateTime = (timestamp: TimestampInput | null | undefined): string => {
  if (!timestamp) return 'Unknown';

  try {
    const ts = timestamp as TimestampLike;
    const date = ts.toDate ? ts.toDate() : new Date(timestamp as string | number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? `0${minutes}` : minutes;

    return `${month} ${day}, ${year} at ${hours}:${minutesStr} ${ampm}`;
  } catch (err) {
    const e = err as Error;
    logger.error('timeUtils: Error formatting full date time', { error: e.message });
    return 'Unknown';
  }
};

export const getRevealCountdown = (timestamp: TimestampInput | null | undefined): string => {
  if (!timestamp) return 'Unknown';

  try {
    const ts = timestamp as TimestampLike;
    const revealTime = ts.toDate ? ts.toDate() : new Date(timestamp as string | number);
    const now = new Date();
    const diffMs = revealTime.getTime() - now.getTime();

    if (diffMs <= 0) return 'Ready to reveal!';

    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const minutes = diffMin % 60;

    if (diffHour > 0) return `Reveals in ${diffHour}h ${minutes}m`;
    return `Reveals in ${minutes}m`;
  } catch (err) {
    const e = err as Error;
    logger.error('timeUtils: Error formatting reveal countdown', { error: e.message });
    return 'Unknown';
  }
};

export const isToday = (timestamp: TimestampInput | null | undefined): boolean => {
  if (!timestamp) return false;

  try {
    const ts = timestamp as TimestampLike;
    const date = ts.toDate ? ts.toDate() : new Date(timestamp as string | number);
    const now = new Date();

    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  } catch {
    return false;
  }
};

export const isWithinLastWeek = (timestamp: TimestampInput | null | undefined): boolean => {
  if (!timestamp) return false;

  try {
    const ts = timestamp as TimestampLike;
    const date = ts.toDate ? ts.toDate() : new Date(timestamp as string | number);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return diffDays <= 7;
  } catch {
    return false;
  }
};
