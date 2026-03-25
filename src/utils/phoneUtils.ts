import { AsYouType, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import logger from './logger';

export const formatPhoneWithCountry = (e164: string | null | undefined): string => {
  if (!e164) return '';

  try {
    const parsed = parsePhoneNumberFromString(e164);
    if (parsed && parsed.isValid()) {
      const countryCode = `+${parsed.countryCallingCode}`;
      const national = parsed.formatNational();
      return `${countryCode} ${national}`;
    }
    return e164;
  } catch (err) {
    const error = err as Error;
    logger.warn('phoneUtils.formatPhoneWithCountry: Parse failed', {
      error: error.message,
    });
    return e164;
  }
};

export const formatPhoneForDisplay = (e164: string | null | undefined, countryCode?: CountryCode): string => {
  if (!e164) return '';

  try {
    const parsed = parsePhoneNumberFromString(e164, countryCode);
    if (parsed && parsed.isValid()) {
      return parsed.formatNational();
    }
    return e164;
  } catch (err) {
    const error = err as Error;
    logger.warn('phoneUtils.formatPhoneForDisplay: Parse failed', {
      error: error.message,
      countryCode,
    });
    return e164;
  }
};

export const formatAsUserTypes = (digits: string | null | undefined, countryCode: CountryCode = 'US'): string => {
  if (!digits) return '';

  try {
    const formatter = new AsYouType(countryCode);
    const formatted = formatter.input(digits);
    return formatted;
  } catch (err) {
    const error = err as Error;
    logger.warn('phoneUtils.formatAsUserTypes: Format failed', {
      error: error.message,
      countryCode,
    });
    return digits;
  }
};

export const getInputPreview = (rawDigits: string | null | undefined, countryCode: CountryCode = 'US'): string => {
  if (!rawDigits || rawDigits.length === 0) return '';
  return formatAsUserTypes(rawDigits, countryCode);
};
