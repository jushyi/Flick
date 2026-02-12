/**
 * Phone Utilities Tests
 *
 * Tests all exported functions from src/utils/phoneUtils.js.
 * Uses libphonenumber-js (real library, not mocked) for formatting.
 */

import {
  formatPhoneWithCountry,
  formatPhoneForDisplay,
  formatAsUserTypes,
  getInputPreview,
} from '../../src/utils/phoneUtils';

// =============================================================================
// formatPhoneWithCountry
// =============================================================================
describe('formatPhoneWithCountry', () => {
  it('should format US E.164 number with country code and national format', () => {
    const result = formatPhoneWithCountry('+14155551234');
    expect(result).toContain('+1');
    expect(result).toContain('415');
  });

  it('should format UK E.164 number with country code', () => {
    const result = formatPhoneWithCountry('+442071234567');
    expect(result).toContain('+44');
  });

  it('should return empty string for empty input', () => {
    expect(formatPhoneWithCountry('')).toBe('');
  });

  it('should return empty string for null', () => {
    expect(formatPhoneWithCountry(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(formatPhoneWithCountry(undefined)).toBe('');
  });

  it('should return original string for invalid phone number', () => {
    const invalid = '+123';
    const result = formatPhoneWithCountry(invalid);
    // Should return original since it can't be parsed as valid
    expect(result).toBe(invalid);
  });
});

// =============================================================================
// formatPhoneForDisplay
// =============================================================================
describe('formatPhoneForDisplay', () => {
  it('should format US number in national format', () => {
    const result = formatPhoneForDisplay('+14155551234', 'US');
    // Should be national format like "(415) 555-1234"
    expect(result).toContain('415');
    expect(result).toContain('555');
    expect(result).toContain('1234');
  });

  it('should format UK number in national format', () => {
    const result = formatPhoneForDisplay('+442071234567', 'GB');
    expect(result).toContain('020');
  });

  it('should return empty string for empty input', () => {
    expect(formatPhoneForDisplay('')).toBe('');
  });

  it('should return empty string for null', () => {
    expect(formatPhoneForDisplay(null)).toBe('');
  });

  it('should return original for unparseable number', () => {
    const invalid = 'not-a-number';
    expect(formatPhoneForDisplay(invalid, 'US')).toBe(invalid);
  });
});

// =============================================================================
// formatAsUserTypes
// =============================================================================
describe('formatAsUserTypes', () => {
  it('should format digits progressively for US numbers', () => {
    const result3 = formatAsUserTypes('415', 'US');
    expect(result3.length).toBeGreaterThan(0);

    const result7 = formatAsUserTypes('4155551', 'US');
    expect(result7.length).toBeGreaterThan(0);

    const result10 = formatAsUserTypes('4155551234', 'US');
    expect(result10).toContain('415');
    expect(result10).toContain('1234');
  });

  it('should return empty string for empty input', () => {
    expect(formatAsUserTypes('')).toBe('');
  });

  it('should return empty string for null', () => {
    expect(formatAsUserTypes(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(formatAsUserTypes(undefined)).toBe('');
  });

  it('should use US as default country code', () => {
    const withDefault = formatAsUserTypes('4155551234');
    const withExplicit = formatAsUserTypes('4155551234', 'US');
    expect(withDefault).toBe(withExplicit);
  });
});

// =============================================================================
// getInputPreview
// =============================================================================
describe('getInputPreview', () => {
  it('should return formatted preview for raw digits', () => {
    const result = getInputPreview('4155551234', 'US');
    expect(result).toContain('415');
    expect(result).toContain('1234');
  });

  it('should return empty string for empty input', () => {
    expect(getInputPreview('')).toBe('');
  });

  it('should return empty string for null', () => {
    expect(getInputPreview(null)).toBe('');
  });

  it('should delegate to formatAsUserTypes', () => {
    const preview = getInputPreview('4155551234', 'US');
    const formatted = formatAsUserTypes('4155551234', 'US');
    expect(preview).toBe(formatted);
  });

  it('should use US as default country code', () => {
    const withDefault = getInputPreview('4155551234');
    const withExplicit = getInputPreview('4155551234', 'US');
    expect(withDefault).toBe(withExplicit);
  });
});
