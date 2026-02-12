/**
 * Validation Utilities Tests
 *
 * Tests all exported validators from src/utils/validation.js.
 * These are pure functions — no mocks needed.
 */

import {
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
} from '../../src/utils/validation';

// =============================================================================
// isValidEmail
// =============================================================================
describe('isValidEmail', () => {
  it('should return true for valid email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('user.name@example.com')).toBe(true);
    expect(isValidEmail('user+tag@example.com')).toBe(true);
    expect(isValidEmail('user@subdomain.example.com')).toBe(true);
  });

  it('should return false for email without @ symbol', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('should return false for email without domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('should return false for email without TLD', () => {
    expect(isValidEmail('user@example')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isValidEmail(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isValidEmail(undefined)).toBe(false);
  });

  it('should return false for non-string types', () => {
    expect(isValidEmail(123)).toBe(false);
    expect(isValidEmail({})).toBe(false);
  });

  it('should handle emails with whitespace by trimming', () => {
    expect(isValidEmail('  user@example.com  ')).toBe(true);
  });
});

// =============================================================================
// validateEmail
// =============================================================================
describe('validateEmail', () => {
  it('should return null for valid email', () => {
    expect(validateEmail('user@example.com')).toBeNull();
  });

  it('should return error for empty email', () => {
    expect(validateEmail('')).toBe('Email is required');
  });

  it('should return error for invalid email format', () => {
    expect(validateEmail('notanemail')).toBe('Please enter a valid email address');
  });
});

// =============================================================================
// isValidUsername
// =============================================================================
describe('isValidUsername', () => {
  it('should return true for valid usernames', () => {
    expect(isValidUsername('abc')).toBe(true);
    expect(isValidUsername('user_name')).toBe(true);
    expect(isValidUsername('User123')).toBe(true);
    expect(isValidUsername('a'.repeat(24))).toBe(true);
  });

  it('should return false for username shorter than 3 characters', () => {
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('a')).toBe(false);
  });

  it('should return false for username longer than 24 characters', () => {
    expect(isValidUsername('a'.repeat(25))).toBe(false);
  });

  it('should return false for usernames with invalid characters', () => {
    expect(isValidUsername('user name')).toBe(false);
    expect(isValidUsername('user@name')).toBe(false);
    expect(isValidUsername('user-name')).toBe(false);
    expect(isValidUsername('user.name')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidUsername('')).toBe(false);
  });

  it('should return false for null and undefined', () => {
    expect(isValidUsername(null)).toBe(false);
    expect(isValidUsername(undefined)).toBe(false);
  });

  it('should return false for non-string types', () => {
    expect(isValidUsername(123)).toBe(false);
  });
});

// =============================================================================
// validateUsername
// =============================================================================
describe('validateUsername', () => {
  it('should return null for valid username', () => {
    expect(validateUsername('validuser')).toBeNull();
  });

  it('should return error for empty username', () => {
    expect(validateUsername('')).toBe('Username is required');
  });

  it('should return error for too short username', () => {
    expect(validateUsername('ab')).toBe('Username must be at least 3 characters');
  });

  it('should return error for too long username', () => {
    expect(validateUsername('a'.repeat(25))).toBe('Username must be no more than 24 characters');
  });

  it('should return error for invalid characters', () => {
    expect(validateUsername('user name')).toBe(
      'Username can only contain letters, numbers, and underscores'
    );
  });
});

// =============================================================================
// normalizeUsername
// =============================================================================
describe('normalizeUsername', () => {
  it('should lowercase the username', () => {
    expect(normalizeUsername('TestUser')).toBe('testuser');
  });

  it('should trim whitespace', () => {
    expect(normalizeUsername('  testuser  ')).toBe('testuser');
  });

  it('should handle already lowercase', () => {
    expect(normalizeUsername('testuser')).toBe('testuser');
  });
});

// =============================================================================
// isValidPassword
// =============================================================================
describe('isValidPassword', () => {
  it('should return true for passwords with 8+ characters', () => {
    expect(isValidPassword('12345678')).toBe(true);
    expect(isValidPassword('longerpassword')).toBe(true);
  });

  it('should return false for passwords shorter than 8 characters', () => {
    expect(isValidPassword('1234567')).toBe(false);
  });

  it('should return false for empty, null, undefined', () => {
    expect(isValidPassword('')).toBe(false);
    expect(isValidPassword(null)).toBe(false);
    expect(isValidPassword(undefined)).toBe(false);
  });

  it('should return false for non-string types', () => {
    expect(isValidPassword(12345678)).toBe(false);
  });
});

// =============================================================================
// validatePassword / validatePasswordMatch
// =============================================================================
describe('validatePassword', () => {
  it('should return null for valid password', () => {
    expect(validatePassword('validpass')).toBeNull();
  });

  it('should return error for empty password', () => {
    expect(validatePassword('')).toBe('Password is required');
  });

  it('should return error for short password', () => {
    expect(validatePassword('short')).toBe('Password must be at least 8 characters');
  });
});

describe('validatePasswordMatch', () => {
  it('should return null when passwords match', () => {
    expect(validatePasswordMatch('password1', 'password1')).toBeNull();
  });

  it('should return error when passwords do not match', () => {
    expect(validatePasswordMatch('password1', 'password2')).toBe('Passwords do not match');
  });

  it('should return error for empty confirmation', () => {
    expect(validatePasswordMatch('password1', '')).toBe('Please confirm your password');
  });
});

// =============================================================================
// isValidPhotoSize
// =============================================================================
describe('isValidPhotoSize', () => {
  it('should return true for valid photo sizes', () => {
    expect(isValidPhotoSize(1)).toBe(true);
    expect(isValidPhotoSize(5 * 1024 * 1024)).toBe(true);
    expect(isValidPhotoSize(10 * 1024 * 1024)).toBe(true); // exactly 10MB
  });

  it('should return false for size exceeding 10MB', () => {
    expect(isValidPhotoSize(10 * 1024 * 1024 + 1)).toBe(false);
  });

  it('should return false for zero or negative sizes', () => {
    expect(isValidPhotoSize(0)).toBe(false);
    expect(isValidPhotoSize(-1)).toBe(false);
  });
});

// =============================================================================
// validatePhotoSize
// =============================================================================
describe('validatePhotoSize', () => {
  it('should return null for valid size', () => {
    expect(validatePhotoSize(5 * 1024 * 1024)).toBeNull();
  });

  it('should return error for too large', () => {
    expect(validatePhotoSize(11 * 1024 * 1024)).toBe('Photo size must be less than 10MB');
  });

  it('should return error for zero/null', () => {
    expect(validatePhotoSize(0)).toBe('Invalid photo file');
    expect(validatePhotoSize(null)).toBe('Invalid photo file');
  });
});

// =============================================================================
// isValidPhotoType
// =============================================================================
describe('isValidPhotoType', () => {
  it('should return true for allowed MIME types', () => {
    expect(isValidPhotoType('image/jpeg')).toBe(true);
    expect(isValidPhotoType('image/jpg')).toBe(true);
    expect(isValidPhotoType('image/png')).toBe(true);
    expect(isValidPhotoType('image/heic')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isValidPhotoType('IMAGE/JPEG')).toBe(true);
    expect(isValidPhotoType('Image/PNG')).toBe(true);
  });

  it('should return false for disallowed MIME types', () => {
    expect(isValidPhotoType('image/gif')).toBe(false);
    expect(isValidPhotoType('image/webp')).toBe(false);
    expect(isValidPhotoType('application/pdf')).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isValidPhotoType(null)).toBe(false);
    expect(isValidPhotoType(undefined)).toBe(false);
  });
});

// =============================================================================
// validatePhotoType
// =============================================================================
describe('validatePhotoType', () => {
  it('should return null for valid types', () => {
    expect(validatePhotoType('image/jpeg')).toBeNull();
  });

  it('should return error for invalid type', () => {
    expect(validatePhotoType('image/gif')).toBe('Photo must be JPEG, PNG, or HEIC format');
  });

  it('should return error for missing type', () => {
    expect(validatePhotoType('')).toBe('Invalid photo type');
    expect(validatePhotoType(null)).toBe('Invalid photo type');
  });
});

// =============================================================================
// sanitizeInput
// =============================================================================
describe('sanitizeInput', () => {
  it('should remove HTML tags', () => {
    expect(sanitizeInput('Hello <b>world</b>')).toBe('Hello world');
    expect(sanitizeInput('<div>content</div>')).toBe('content');
  });

  it('should remove javascript: protocols', () => {
    expect(sanitizeInput('javascript:alert(1)')).toBe('alert(1)');
  });

  it('should trim whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('should return empty string for null/undefined', () => {
    expect(sanitizeInput(null)).toBe('');
    expect(sanitizeInput(undefined)).toBe('');
  });

  it('should return empty string for non-string types', () => {
    expect(sanitizeInput(123)).toBe('');
    expect(sanitizeInput({})).toBe('');
  });

  it('should handle strings without dangerous content', () => {
    expect(sanitizeInput('Hello world')).toBe('Hello world');
  });
});

// =============================================================================
// sanitizeDisplayName
// =============================================================================
describe('sanitizeDisplayName', () => {
  it('should truncate to default maxLength of 24', () => {
    const longName = 'A'.repeat(30);
    expect(sanitizeDisplayName(longName).length).toBe(24);
  });

  it('should truncate to custom maxLength', () => {
    const longName = 'A'.repeat(30);
    expect(sanitizeDisplayName(longName, 10).length).toBe(10);
  });

  it('should sanitize HTML from display name', () => {
    expect(sanitizeDisplayName('<script>alert</script>Name')).toBe('alertName');
  });

  it('should return empty string for falsy input', () => {
    expect(sanitizeDisplayName('')).toBe('');
    expect(sanitizeDisplayName(null)).toBe('');
    expect(sanitizeDisplayName(undefined)).toBe('');
  });

  it('should trim whitespace', () => {
    expect(sanitizeDisplayName('  Test User  ')).toBe('Test User');
  });
});

// =============================================================================
// sanitizeBio
// =============================================================================
describe('sanitizeBio', () => {
  it('should truncate to default maxLength of 240', () => {
    const longBio = 'A'.repeat(300);
    expect(sanitizeBio(longBio).length).toBe(240);
  });

  it('should truncate to custom maxLength', () => {
    const longBio = 'A'.repeat(300);
    expect(sanitizeBio(longBio, 100).length).toBe(100);
  });

  it('should sanitize HTML from bio', () => {
    expect(sanitizeBio('<b>Bold bio</b>')).toBe('Bold bio');
  });

  it('should return empty string for falsy input', () => {
    expect(sanitizeBio('')).toBe('');
    expect(sanitizeBio(null)).toBe('');
  });
});

// =============================================================================
// validateRequired
// =============================================================================
describe('validateRequired', () => {
  it('should return null for non-empty values', () => {
    expect(validateRequired('hello')).toBeNull();
    expect(validateRequired(123)).toBeNull();
    expect(validateRequired(true)).toBeNull();
  });

  it('should return error for empty string', () => {
    expect(validateRequired('')).toBe('This field is required');
  });

  it('should return error for whitespace-only string', () => {
    expect(validateRequired('   ')).toBe('This field is required');
  });

  it('should return error for null and undefined', () => {
    expect(validateRequired(null)).toBe('This field is required');
    expect(validateRequired(undefined)).toBe('This field is required');
  });

  it('should use custom field name in error message', () => {
    expect(validateRequired('', 'Email')).toBe('Email is required');
  });
});

// =============================================================================
// validateLength
// =============================================================================
describe('validateLength', () => {
  it('should return null for value within range', () => {
    expect(validateLength('hello', 1, 10)).toBeNull();
    expect(validateLength('abc', 3, 3)).toBeNull();
  });

  it('should return error for value too short', () => {
    expect(validateLength('ab', 3, 10)).toBe('This field must be at least 3 characters');
  });

  it('should return error for value too long', () => {
    expect(validateLength('a'.repeat(11), 1, 10)).toBe(
      'This field must be no more than 10 characters'
    );
  });

  it('should return null for null/undefined (use validateRequired separately)', () => {
    expect(validateLength(null, 1, 10)).toBeNull();
    expect(validateLength(undefined, 1, 10)).toBeNull();
  });

  it('should use custom field name in error message', () => {
    expect(validateLength('ab', 3, 10, 'Username')).toBe('Username must be at least 3 characters');
  });
});

// =============================================================================
// isValidUrl
// =============================================================================
describe('isValidUrl', () => {
  it('should return true for valid URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com')).toBe(true);
    expect(isValidUrl('https://example.com/path?query=1')).toBe(true);
    expect(isValidUrl('ftp://files.example.com')).toBe(true);
  });

  it('should return false for invalid URLs', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('example.com')).toBe(false);
    expect(isValidUrl('://missing-protocol.com')).toBe(false);
  });

  it('should return false for empty/null/undefined', () => {
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl(null)).toBe(false);
    expect(isValidUrl(undefined)).toBe(false);
  });

  it('should return false for non-string types', () => {
    expect(isValidUrl(123)).toBe(false);
  });
});
