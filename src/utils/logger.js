/**
 * Centralized Logging Utility
 *
 * Environment-aware logging system that:
 * - Filters logs based on environment (production vs development)
 * - Supports log levels (DEBUG, INFO, WARN, ERROR)
 * - Automatically sanitizes sensitive data
 * - Provides consistent formatting across the app
 * - Can be extended with external error tracking services
 *
 * Usage:
 * import logger from '../utils/logger';
 * logger.debug('Debug message', { data });
 * logger.info('Info message', { data });
 * logger.warn('Warning message', { data });
 * logger.error('Error message', { error });
 */

import { Platform } from 'react-native';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Log levels in order of severity
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4, // Disable all logging
};

/**
 * Current log level based on environment
 * - Development: Show all logs (DEBUG and above)
 * - Production: Show only WARN and ERROR
 */
const CURRENT_LOG_LEVEL = __DEV__ ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;

/**
 * Sensitive data patterns to remove from logs
 */
const SENSITIVE_PATTERNS = [
  /firebase/gi,
  /token/gi,
  /password/gi,
  /apikey/gi,
  /secret/gi,
  /authorization/gi,
  /bearer/gi,
  /credential/gi,
];

/**
 * Sensitive field names to redact in objects
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'apiKey',
  'secret',
  'authorization',
  'fcmToken',
  'pushToken',
  'refreshToken',
  'accessToken',
  'idToken',
  'credential',
  'privateKey',
];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if a string contains sensitive data
 * @param {string} str - String to check
 * @returns {boolean} True if string contains sensitive data
 */
const containsSensitiveData = str => {
  if (typeof str !== 'string') {
    return false;
  }
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(str));
};

/**
 * Sanitize sensitive data from objects
 * @param {any} data - Data to sanitize
 * @returns {any} Sanitized data
 */
const sanitizeData = data => {
  // Handle null/undefined
  if (data === null || data === undefined) {
    return data;
  }

  // Handle primitives
  if (typeof data !== 'object') {
    // Redact sensitive strings
    if (typeof data === 'string' && containsSensitiveData(data)) {
      return '[REDACTED]';
    }
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  // Handle objects
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    // Check if field name is sensitive
    if (SENSITIVE_FIELDS.includes(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeData(value);
    } else if (typeof value === 'string' && containsSensitiveData(value)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

/**
 * Format log message with metadata
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {any} data - Additional data to log
 * @returns {object} Formatted log object
 */
const formatLog = (level, message, data) => {
  const timestamp = new Date().toISOString();
  const platform = Platform.OS;

  return {
    timestamp,
    level,
    platform,
    message,
    data: data ? sanitizeData(data) : undefined,
  };
};

/**
 * Check if log should be output based on current log level
 * @param {number} level - Log level to check
 * @returns {boolean} True if log should be output
 */
const shouldLog = level => {
  return level >= CURRENT_LOG_LEVEL;
};

// =============================================================================
// LOGGING FUNCTIONS
// =============================================================================

/**
 * Log debug message (development only)
 * Use for detailed debugging information
 * @param {string} message - Log message
 * @param {any} data - Additional data to log
 */
const debug = (message, data) => {
  if (!shouldLog(LOG_LEVELS.DEBUG)) {
    return;
  }

  const log = formatLog('DEBUG', message, data);

  if (__DEV__) {
    console.log('🔍 [DEBUG]', message, data ? log.data : '');
  }
};

/**
 * Log info message
 * Use for general informational messages
 * @param {string} message - Log message
 * @param {any} data - Additional data to log
 */
const info = (message, data) => {
  if (!shouldLog(LOG_LEVELS.INFO)) {
    return;
  }

  const log = formatLog('INFO', message, data);

  if (__DEV__) {
    console.log('ℹ️ [INFO]', message, data ? log.data : '');
  }
};

/**
 * Log warning message
 * Use for warning messages that don't prevent app functionality
 * @param {string} message - Log message
 * @param {any} data - Additional data to log
 */
const warn = (message, data) => {
  if (!shouldLog(LOG_LEVELS.WARN)) {
    return;
  }

  const log = formatLog('WARN', message, data);

  console.warn('⚠️ [WARN]', message, data ? log.data : '');
};

/**
 * Log error message
 * Use for errors that affect app functionality
 * @param {string} message - Error message
 * @param {Error|any} error - Error object or additional data
 */
const error = (message, errorObj) => {
  if (!shouldLog(LOG_LEVELS.ERROR)) {
    return;
  }

  const log = formatLog('ERROR', message, errorObj);

  console.error('❌ [ERROR]', message, errorObj ? log.data : '');
};

// =============================================================================
// EXPORT LOGGER
// =============================================================================

const logger = {
  debug,
  info,
  warn,
  error,
  // Expose log levels for external configuration
  levels: LOG_LEVELS,
  currentLevel: CURRENT_LOG_LEVEL,
};

export default logger;
