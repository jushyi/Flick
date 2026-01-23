/**
 * Validation Utilities
 *
 * Centralized validation functions for user input across the app.
 * These validators are used both client-side (forms) and server-side (Cloud Functions).
 */

// =============================================================================
// EMAIL VALIDATION
// =============================================================================

/**
 * Validates email format using RFC 5322 compliant regex
 * @param {string} email - Email address to validate
 * @returns {boolean} True if email is valid
 */
export const isValidEmail = email => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Validates email and returns error message if invalid
 * @param {string} email - Email address to validate
 * @returns {string|null} Error message or null if valid
 */
export const validateEmail = email => {
  if (!email) {
    return 'Email is required';
  }
  if (!isValidEmail(email)) {
    return 'Please enter a valid email address';
  }
  return null;
};

// =============================================================================
// USERNAME VALIDATION
// =============================================================================

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/; // Alphanumeric + underscore only

/**
 * Validates username format
 * @param {string} username - Username to validate
 * @returns {boolean} True if username format is valid
 */
export const isValidUsername = username => {
  if (!username || typeof username !== 'string') {
    return false;
  }

  const trimmed = username.trim();

  // Check length
  if (trimmed.length < USERNAME_MIN_LENGTH || trimmed.length > USERNAME_MAX_LENGTH) {
    return false;
  }

  // Check characters (alphanumeric + underscore only)
  if (!USERNAME_REGEX.test(trimmed)) {
    return false;
  }

  return true;
};

/**
 * Validates username and returns error message if invalid
 * @param {string} username - Username to validate
 * @returns {string|null} Error message or null if valid
 */
export const validateUsername = username => {
  if (!username) {
    return 'Username is required';
  }

  const trimmed = username.trim();

  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters`;
  }

  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return `Username must be no more than ${USERNAME_MAX_LENGTH} characters`;
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    return 'Username can only contain letters, numbers, and underscores';
  }

  return null;
};

/**
 * Normalizes username to lowercase for storage
 * @param {string} username - Username to normalize
 * @returns {string} Normalized username
 */
export const normalizeUsername = username => {
  return username.trim().toLowerCase();
};

// =============================================================================
// PASSWORD VALIDATION
// =============================================================================

const PASSWORD_MIN_LENGTH = 8;

/**
 * Validates password strength
 * @param {string} password - Password to validate
 * @returns {boolean} True if password meets requirements
 */
export const isValidPassword = password => {
  if (!password || typeof password !== 'string') {
    return false;
  }

  // Minimum length check
  if (password.length < PASSWORD_MIN_LENGTH) {
    return false;
  }

  return true;
};

/**
 * Validates password and returns error message if invalid
 * @param {string} password - Password to validate
 * @returns {string|null} Error message or null if valid
 */
export const validatePassword = password => {
  if (!password) {
    return 'Password is required';
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }

  return null;
};

/**
 * Validates password confirmation matches
 * @param {string} password - Original password
 * @param {string} confirmPassword - Confirmation password
 * @returns {string|null} Error message or null if valid
 */
export const validatePasswordMatch = (password, confirmPassword) => {
  if (!confirmPassword) {
    return 'Please confirm your password';
  }

  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }

  return null;
};

// =============================================================================
// PHOTO VALIDATION
// =============================================================================

const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic'];

/**
 * Validates photo file size
 * @param {number} sizeInBytes - File size in bytes
 * @returns {boolean} True if size is valid
 */
export const isValidPhotoSize = sizeInBytes => {
  return sizeInBytes > 0 && sizeInBytes <= MAX_PHOTO_SIZE;
};

/**
 * Validates photo file size and returns error if invalid
 * @param {number} sizeInBytes - File size in bytes
 * @returns {string|null} Error message or null if valid
 */
export const validatePhotoSize = sizeInBytes => {
  if (!sizeInBytes || sizeInBytes <= 0) {
    return 'Invalid photo file';
  }

  if (sizeInBytes > MAX_PHOTO_SIZE) {
    const maxSizeMB = MAX_PHOTO_SIZE / (1024 * 1024);
    return `Photo size must be less than ${maxSizeMB}MB`;
  }

  return null;
};

/**
 * Validates photo MIME type
 * @param {string} mimeType - MIME type of the photo
 * @returns {boolean} True if MIME type is allowed
 */
export const isValidPhotoType = mimeType => {
  return ALLOWED_IMAGE_TYPES.includes(mimeType?.toLowerCase());
};

/**
 * Validates photo MIME type and returns error if invalid
 * @param {string} mimeType - MIME type of the photo
 * @returns {string|null} Error message or null if valid
 */
export const validatePhotoType = mimeType => {
  if (!mimeType) {
    return 'Invalid photo type';
  }

  if (!isValidPhotoType(mimeType)) {
    return 'Photo must be JPEG, PNG, or HEIC format';
  }

  return null;
};

// =============================================================================
// TEXT INPUT SANITIZATION (XSS PREVENTION)
// =============================================================================

/**
 * Sanitizes user input to prevent XSS attacks
 * Removes HTML tags and dangerous characters
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized input
 */
export const sanitizeInput = input => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');

  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

  // Remove javascript: protocols
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
};

/**
 * Sanitizes display name (allows more characters than username)
 * @param {string} displayName - Display name to sanitize
 * @param {number} maxLength - Maximum length (default 50)
 * @returns {string} Sanitized display name
 */
export const sanitizeDisplayName = (displayName, maxLength = 50) => {
  if (!displayName) {
    return '';
  }

  let sanitized = sanitizeInput(displayName);

  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
};

/**
 * Sanitizes bio text
 * @param {string} bio - Bio text to sanitize
 * @param {number} maxLength - Maximum length (default 150)
 * @returns {string} Sanitized bio
 */
export const sanitizeBio = (bio, maxLength = 150) => {
  if (!bio) {
    return '';
  }

  let sanitized = sanitizeInput(bio);

  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
};

// =============================================================================
// GENERAL VALIDATION HELPERS
// =============================================================================

/**
 * Validates required field
 * @param {any} value - Value to check
 * @param {string} fieldName - Name of the field for error message
 * @returns {string|null} Error message or null if valid
 */
export const validateRequired = (value, fieldName = 'This field') => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return `${fieldName} is required`;
  }
  return null;
};

/**
 * Validates field length
 * @param {string} value - Value to check
 * @param {number} min - Minimum length
 * @param {number} max - Maximum length
 * @param {string} fieldName - Name of the field
 * @returns {string|null} Error message or null if valid
 */
export const validateLength = (value, min, max, fieldName = 'This field') => {
  if (!value) {
    return null; // Use validateRequired separately
  }

  if (value.length < min) {
    return `${fieldName} must be at least ${min} characters`;
  }

  if (value.length > max) {
    return `${fieldName} must be no more than ${max} characters`;
  }

  return null;
};

/**
 * Validates URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL is valid
 */
export const isValidUrl = url => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// =============================================================================
// EXPORT ALL VALIDATORS
// =============================================================================

export default {
  // Email
  isValidEmail,
  validateEmail,

  // Username
  isValidUsername,
  validateUsername,
  normalizeUsername,

  // Password
  isValidPassword,
  validatePassword,
  validatePasswordMatch,

  // Photo
  isValidPhotoSize,
  validatePhotoSize,
  isValidPhotoType,
  validatePhotoType,

  // Sanitization
  sanitizeInput,
  sanitizeDisplayName,
  sanitizeBio,

  // General
  validateRequired,
  validateLength,
  isValidUrl,
};
