/**
 * Cloud Functions Logger Utility
 *
 * Environment-aware logging system for Firebase Cloud Functions that:
 * - Filters logs based on environment (production vs emulator)
 * - Supports log levels (DEBUG, INFO, WARN, ERROR)
 * - Provides consistent formatting with function name prefixes
 * - Uses firebase-functions logger for structured Cloud Logging integration
 *
 * Usage:
 * const logger = require('./logger');
 * logger.debug('Function context: Debug message', { data });
 * logger.info('Function context: Info message', { data });
 * logger.warn('Function context: Warning message', { data });
 * logger.error('Function context: Error message', { error });
 */

const functions = require('firebase-functions');

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
 * Detect if running in emulator/local environment
 * FUNCTIONS_EMULATOR is set to 'true' when running in Firebase emulator
 */
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

/**
 * Current log level based on environment
 * - Emulator/Local: Show all logs (DEBUG and above)
 * - Production: Show INFO and above (needed for push notification pipeline visibility)
 */
const CURRENT_LOG_LEVEL = isEmulator ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if log should be output based on current log level
 * @param {number} level - Log level to check
 * @returns {boolean} True if log should be output
 */
const shouldLog = level => {
  return level >= CURRENT_LOG_LEVEL;
};

/**
 * Format timestamp for log output
 * @returns {string} ISO timestamp
 */
const getTimestamp = () => {
  return new Date().toISOString();
};

// =============================================================================
// LOGGING FUNCTIONS
// =============================================================================

/**
 * Log debug message (emulator/development only)
 * Use for detailed debugging information
 * @param {string} message - Log message (should include function name prefix)
 * @param {any} data - Additional data to log
 */
const debug = (message, data) => {
  if (!shouldLog(LOG_LEVELS.DEBUG)) {
    return;
  }

  if (isEmulator) {
    if (data !== undefined) {
      functions.logger.debug(`[DEBUG] ${message}`, data);
    } else {
      functions.logger.debug(`[DEBUG] ${message}`);
    }
  }
};

/**
 * Log info message (all environments)
 * Use for general informational messages and progress tracking
 * Visible in Cloud Logging for production debugging (push notifications, receipts, etc.)
 * @param {string} message - Log message (should include function name prefix)
 * @param {any} data - Additional data to log
 */
const info = (message, data) => {
  if (!shouldLog(LOG_LEVELS.INFO)) {
    return;
  }

  if (data !== undefined) {
    functions.logger.info(`[INFO] ${message}`, data);
  } else {
    functions.logger.info(`[INFO] ${message}`);
  }
};

/**
 * Log warning message (always logged)
 * Use for warning messages that don't prevent functionality
 * @param {string} message - Log message (should include function name prefix)
 * @param {any} data - Additional data to log
 */
const warn = (message, data) => {
  if (!shouldLog(LOG_LEVELS.WARN)) {
    return;
  }

  if (data !== undefined) {
    functions.logger.warn(`[WARN] ${message}`, data);
  } else {
    functions.logger.warn(`[WARN] ${message}`);
  }
};

/**
 * Log error message (always logged)
 * Use for errors that affect functionality
 * @param {string} message - Error message (should include function name prefix)
 * @param {Error|any} error - Error object or additional data
 */
const error = (message, errorObj) => {
  if (!shouldLog(LOG_LEVELS.ERROR)) {
    return;
  }

  if (errorObj !== undefined) {
    functions.logger.error(`[ERROR] ${message}`, errorObj);
  } else {
    functions.logger.error(`[ERROR] ${message}`);
  }
};

// =============================================================================
// EXPORT LOGGER
// =============================================================================

module.exports = {
  debug,
  info,
  warn,
  error,
  // Expose configuration for debugging
  levels: LOG_LEVELS,
  currentLevel: CURRENT_LOG_LEVEL,
  isEmulator,
};
