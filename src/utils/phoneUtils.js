/**
 * Phone Number Formatting Utilities
 *
 * Provides display formatting for phone numbers in the auth flow.
 * All numbers are stored in E.164 format - these utilities only affect display.
 */

import { AsYouType, parsePhoneNumberFromString } from 'libphonenumber-js';
import logger from './logger';

/**
 * Format phone number for display with country code
 * Returns a user-friendly format like "+1 (415) 555-1234"
 *
 * @param {string} e164 - Phone number in E.164 format (e.g., "+14155551234")
 * @returns {string} - Formatted phone number or original if parsing fails
 */
export const formatPhoneWithCountry = e164 => {
  if (!e164) {
    return '';
  }

  try {
    const parsed = parsePhoneNumberFromString(e164);
    if (parsed && parsed.isValid()) {
      // Format: "+1 (415) 555-1234" for US numbers
      const countryCode = `+${parsed.countryCallingCode}`;
      const national = parsed.formatNational();
      return `${countryCode} ${national}`;
    }
    return e164;
  } catch (error) {
    logger.warn('phoneUtils.formatPhoneWithCountry: Parse failed', {
      error: error.message,
    });
    return e164;
  }
};

/**
 * Format phone number for display without country code
 * Returns national format like "(415) 555-1234"
 *
 * @param {string} e164 - Phone number in E.164 format (e.g., "+14155551234")
 * @param {string} countryCode - ISO country code (e.g., 'US') for context
 * @returns {string} - Formatted phone number or original if parsing fails
 */
export const formatPhoneForDisplay = (e164, countryCode) => {
  if (!e164) {
    return '';
  }

  try {
    const parsed = parsePhoneNumberFromString(e164, countryCode);
    if (parsed && parsed.isValid()) {
      return parsed.formatNational();
    }
    return e164;
  } catch (error) {
    logger.warn('phoneUtils.formatPhoneForDisplay: Parse failed', {
      error: error.message,
      countryCode,
    });
    return e164;
  }
};

/**
 * Format phone input as user types
 * Returns incrementally formatted number like "(415) 555-" as user enters digits
 *
 * @param {string} digits - Raw phone number digits (e.g., "4155551234")
 * @param {string} countryCode - ISO country code (e.g., 'US')
 * @returns {string} - Formatted partial phone number
 */
export const formatAsUserTypes = (digits, countryCode = 'US') => {
  if (!digits) {
    return '';
  }

  try {
    const formatter = new AsYouType(countryCode);
    const formatted = formatter.input(digits);
    return formatted;
  } catch (error) {
    logger.warn('phoneUtils.formatAsUserTypes: Format failed', {
      error: error.message,
      countryCode,
    });
    return digits;
  }
};

/**
 * Get the formatted preview text to show while user is typing
 * This provides visual feedback without affecting the actual stored value
 *
 * @param {string} rawDigits - Raw phone number digits entered by user
 * @param {string} countryCode - ISO country code (e.g., 'US')
 * @returns {string} - Formatted preview text
 */
export const getInputPreview = (rawDigits, countryCode = 'US') => {
  if (!rawDigits || rawDigits.length === 0) {
    return '';
  }

  return formatAsUserTypes(rawDigits, countryCode);
};
