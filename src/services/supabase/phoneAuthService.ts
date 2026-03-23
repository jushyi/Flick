/**
 * Phone Authentication Service (Supabase)
 *
 * Uses Supabase Auth for stateless phone OTP verification.
 * No ConfirmationResult needed -- Supabase OTP is inherently stateless.
 *
 * Flow: PhoneInputScreen -> VerificationScreen -> App
 */

import { parsePhoneNumberFromString } from 'libphonenumber-js';

import { supabase } from '../../lib/supabase';

import logger from '../../utils/logger';

/**
 * Map Supabase auth error messages to user-friendly strings
 * @param errorMessage - Supabase error message string
 * @returns User-friendly error message
 */
export const getPhoneAuthErrorMessage = (errorMessage: string): string => {
  logger.debug('phoneAuthService.getPhoneAuthErrorMessage', { errorMessage });

  const msg = errorMessage.toLowerCase();

  if (msg.includes('otp_expired') || msg.includes('expired')) {
    return 'Code expired. Tap Resend to get a new code.';
  }
  if (msg.includes('otp_not_found') || msg.includes('invalid') || msg.includes('not found')) {
    return 'Invalid code. Please check and try again.';
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (msg.includes('phone') && msg.includes('invalid')) {
    return 'Invalid phone number. Please check the number and try again.';
  }

  return 'Unable to send verification code. Please try again.';
};

/**
 * Validate phone number using libphonenumber-js
 * @param phoneNumber - Phone number without country code
 * @param countryCode - ISO country code (e.g., 'US', 'GB')
 * @returns Validation result with E.164 format if valid
 */
export const validatePhoneNumber = (
  phoneNumber: string,
  countryCode: string
): { valid: boolean; e164?: string; error?: string } => {
  logger.debug('phoneAuthService.validatePhoneNumber', {
    phoneNumber: phoneNumber ? `${phoneNumber.slice(0, 3)}***` : null,
    countryCode,
  });

  if (!phoneNumber || phoneNumber.trim() === '') {
    return { valid: false, error: 'Please enter your phone number.' };
  }

  try {
    const parsed = parsePhoneNumberFromString(phoneNumber, countryCode as any);

    if (!parsed || !parsed.isValid()) {
      return { valid: false, error: 'Please enter a valid phone number.' };
    }

    return {
      valid: true,
      e164: parsed.format('E.164'),
    };
  } catch (error: any) {
    logger.error('phoneAuthService.validatePhoneNumber: Error', { error: error.message });
    return { valid: false, error: 'Invalid phone number format.' };
  }
};

/**
 * Send SMS verification code via Supabase OTP
 *
 * @param phoneNumber - Phone number without country code
 * @param countryCode - ISO country code (e.g., 'US', 'GB')
 * @returns Result with success status and E.164 phone
 */
export const sendVerificationCode = async (
  phoneNumber: string,
  countryCode: string
): Promise<{ success: boolean; e164?: string; error?: string }> => {
  logger.debug('phoneAuthService.sendVerificationCode: Starting', {
    phoneNumber: phoneNumber ? `${phoneNumber.slice(0, 3)}***` : null,
    countryCode,
  });

  const validation = validatePhoneNumber(phoneNumber, countryCode);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone: validation.e164!,
    });

    if (error) {
      const errorMessage = getPhoneAuthErrorMessage(error.message);
      logger.error('phoneAuthService.sendVerificationCode: Supabase error', {
        errorMessage: error.message,
        userMessage: errorMessage,
      });
      return { success: false, error: errorMessage };
    }

    logger.info('phoneAuthService.sendVerificationCode: Code sent successfully', {
      e164: validation.e164,
    });

    return {
      success: true,
      e164: validation.e164,
    };
  } catch (error: any) {
    logger.error('phoneAuthService.sendVerificationCode: Failed', {
      error: error.message,
    });
    return { success: false, error: 'Unable to send verification code. Please try again.' };
  }
};

/**
 * Verify SMS code and complete sign-in via Supabase OTP
 *
 * @param phone - E.164 formatted phone number
 * @param code - 6-digit verification code
 * @returns Result with session on success
 */
export const verifyCode = async (
  phone: string,
  code: string
): Promise<{ success: boolean; session?: any; error?: string }> => {
  logger.debug('phoneAuthService.verifyCode: Starting', {
    hasPhone: !!phone,
    codeLength: code?.length,
  });

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: 'sms',
    });

    if (error) {
      const errorMessage = getPhoneAuthErrorMessage(error.message);
      logger.error('phoneAuthService.verifyCode: Failed', {
        errorMessage: error.message,
        userMessage: errorMessage,
      });
      return { success: false, error: errorMessage };
    }

    logger.info('phoneAuthService.verifyCode: Success');

    return {
      success: true,
      session: data.session,
    };
  } catch (error: any) {
    logger.error('phoneAuthService.verifyCode: Failed', {
      error: error.message,
    });
    return { success: false, error: 'Verification failed. Please try again.' };
  }
};

/**
 * Sign out from Supabase
 * @returns Result with success status
 */
export const signOut = async (): Promise<{ success: boolean; error?: string }> => {
  logger.debug('phoneAuthService.signOut: Starting');

  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.error('phoneAuthService.signOut: Failed', { error: error.message });
      return { success: false, error: error.message };
    }

    logger.info('phoneAuthService.signOut: Success');
    return { success: true };
  } catch (error: any) {
    logger.error('phoneAuthService.signOut: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};
