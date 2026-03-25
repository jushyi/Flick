export const isValidEmail = (email: string | null | undefined): boolean => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

export const validateEmail = (email: string | null | undefined): string | null => {
  if (!email) return 'Email is required';
  if (!isValidEmail(email)) return 'Please enter a valid email address';
  return null;
};

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 24;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

export const isValidUsername = (username: string | null | undefined): boolean => {
  if (!username || typeof username !== 'string') return false;

  const trimmed = username.trim();
  if (trimmed.length < USERNAME_MIN_LENGTH || trimmed.length > USERNAME_MAX_LENGTH) return false;
  if (!USERNAME_REGEX.test(trimmed)) return false;

  return true;
};

export const validateUsername = (username: string | null | undefined): string | null => {
  if (!username) return 'Username is required';

  const trimmed = username.trim();
  if (trimmed.length < USERNAME_MIN_LENGTH) return `Username must be at least ${USERNAME_MIN_LENGTH} characters`;
  if (trimmed.length > USERNAME_MAX_LENGTH) return `Username must be no more than ${USERNAME_MAX_LENGTH} characters`;
  if (!USERNAME_REGEX.test(trimmed)) return 'Username can only contain letters, numbers, and underscores';

  return null;
};

export const normalizeUsername = (username: string): string => {
  return username.trim().toLowerCase();
};

const PASSWORD_MIN_LENGTH = 8;

export const isValidPassword = (password: string | null | undefined): boolean => {
  if (!password || typeof password !== 'string') return false;
  if (password.length < PASSWORD_MIN_LENGTH) return false;
  return true;
};

export const validatePassword = (password: string | null | undefined): string | null => {
  if (!password) return 'Password is required';
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  return null;
};

export const validatePasswordMatch = (password: string, confirmPassword: string | null | undefined): string | null => {
  if (!confirmPassword) return 'Please confirm your password';
  if (password !== confirmPassword) return 'Passwords do not match';
  return null;
};

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic'];

export const isValidPhotoSize = (sizeInBytes: number): boolean => {
  return sizeInBytes > 0 && sizeInBytes <= MAX_PHOTO_SIZE;
};

export const validatePhotoSize = (sizeInBytes: number | null | undefined): string | null => {
  if (!sizeInBytes || sizeInBytes <= 0) return 'Invalid photo file';
  if (sizeInBytes > MAX_PHOTO_SIZE) {
    const maxSizeMB = MAX_PHOTO_SIZE / (1024 * 1024);
    return `Photo size must be less than ${maxSizeMB}MB`;
  }
  return null;
};

export const isValidPhotoType = (mimeType: string | null | undefined): boolean => {
  return ALLOWED_IMAGE_TYPES.includes(mimeType?.toLowerCase() ?? '');
};

export const validatePhotoType = (mimeType: string | null | undefined): string | null => {
  if (!mimeType) return 'Invalid photo type';
  if (!isValidPhotoType(mimeType)) return 'Photo must be JPEG, PNG, or HEIC format';
  return null;
};

export const sanitizeInput = (input: string | null | undefined): string => {
  if (!input || typeof input !== 'string') return '';

  let sanitized = input.replace(/<[^>]*>/g, '');
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.trim();

  return sanitized;
};

export const sanitizeDisplayName = (displayName: string | null | undefined, maxLength = 24): string => {
  if (!displayName) return '';
  let sanitized = sanitizeInput(displayName);
  if (sanitized.length > maxLength) sanitized = sanitized.substring(0, maxLength);
  return sanitized;
};

export const sanitizeBio = (bio: string | null | undefined, maxLength = 240): string => {
  if (!bio) return '';
  let sanitized = sanitizeInput(bio);
  if (sanitized.length > maxLength) sanitized = sanitized.substring(0, maxLength);
  return sanitized;
};

export const validateRequired = (value: unknown, fieldName = 'This field'): string | null => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return `${fieldName} is required`;
  }
  return null;
};

export const validateLength = (value: string | null | undefined, min: number, max: number, fieldName = 'This field'): string | null => {
  if (!value) return null;
  if (value.length < min) return `${fieldName} must be at least ${min} characters`;
  if (value.length > max) return `${fieldName} must be no more than ${max} characters`;
  return null;
};

export const isValidUrl = (url: string | null | undefined): boolean => {
  if (!url || typeof url !== 'string') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export default {
  isValidEmail,
  validateEmail,
  isValidUsername,
  validateUsername,
  normalizeUsername,
  isValidPassword,
  validatePassword,
  validatePasswordMatch,
  isValidPhotoSize,
  validatePhotoSize,
  isValidPhotoType,
  validatePhotoType,
  sanitizeInput,
  sanitizeDisplayName,
  sanitizeBio,
  validateRequired,
  validateLength,
  isValidUrl,
};
