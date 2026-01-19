/**
 * Phone Authentication Service
 *
 * Uses React Native Firebase for native phone verification on iOS
 * This approach uses native APNs silent push or reCAPTCHA fallback
 *
 * Flow: PhoneInputScreen -> VerificationScreen -> App
 */

import { getAuth, signInWithPhoneNumber } from '@react-native-firebase/auth';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import logger from '../../utils/logger';

/**
 * Map Firebase phone auth error codes to user-friendly messages
 * @param {string} errorCode - Firebase error code
 * @returns {string} - User-friendly error message
 */
export const getPhoneAuthErrorMessage = (errorCode) => {
  logger.debug('phoneAuthService.getPhoneAuthErrorMessage', { errorCode });

  switch (errorCode) {
    case 'auth/invalid-phone-number':
      return 'Invalid phone number. Please check the number and try again.';
    case 'auth/missing-phone-number':
      return 'Please enter your phone number.';
    case 'auth/quota-exceeded':
      return 'Too many SMS requests. Please wait a few minutes and try again.';
    case 'auth/invalid-verification-code':
      return 'Incorrect code. Please check and try again.';
    case 'auth/code-expired':
    case 'auth/session-expired':
      return 'Code expired. Please go back and request a new code.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes before trying again.';
    case 'auth/operation-not-allowed':
      return 'Phone sign-in is not enabled. Please contact support.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.';
    case 'auth/captcha-check-failed':
      return 'Verification check failed. Please try again.';
    case 'auth/app-not-authorized':
      return 'App authorization failed. Please try again later.';
    case 'auth/missing-client-identifier':
      return 'Configuration error. Please restart the app and try again.';
    case 'auth/internal-error':
      return 'Something went wrong. Please try again.';
    case 'auth/invalid-verification-id':
      return 'Session expired. Please go back and request a new code.';
    default:
      logger.warn('phoneAuthService: Unknown error code', { errorCode });
      return 'Something went wrong. Please try again.';
  }
};

/**
 * Validate phone number using libphonenumber-js
 * @param {string} phoneNumber - Phone number without country code
 * @param {string} countryCode - ISO country code (e.g., 'US', 'GB')
 * @returns {object} - { valid, e164?, formatted?, error? }
 */
export const validatePhoneNumber = (phoneNumber, countryCode) => {
  logger.debug('phoneAuthService.validatePhoneNumber', {
    phoneNumber: phoneNumber ? `${phoneNumber.slice(0, 3)}***` : null,
    countryCode
  });

  // Check for empty phone number
  if (!phoneNumber || phoneNumber.trim() === '') {
    logger.warn('phoneAuthService.validatePhoneNumber: Empty phone number');
    return { valid: false, error: 'Please enter your phone number.' };
  }

  try {
    // Parse the phone number with country code
    const parsed = parsePhoneNumberFromString(phoneNumber, countryCode);

    if (!parsed) {
      logger.warn('phoneAuthService.validatePhoneNumber: Could not parse', { countryCode });
      return { valid: false, error: 'Invalid phone number format.' };
    }

    if (!parsed.isValid()) {
      logger.warn('phoneAuthService.validatePhoneNumber: Invalid number', {
        countryCode,
        isPossible: parsed.isPossible()
      });
      return { valid: false, error: 'Please enter a valid phone number for your region.' };
    }

    const result = {
      valid: true,
      e164: parsed.format('E.164'),      // +14155551234
      formatted: parsed.formatNational(), // (415) 555-1234
      country: parsed.country,
    };

    logger.info('phoneAuthService.validatePhoneNumber: Valid', {
      e164: result.e164,
      country: result.country
    });

    return result;
  } catch (error) {
    logger.error('phoneAuthService.validatePhoneNumber: Error', { error: error.message });
    return { valid: false, error: 'Invalid phone number format.' };
  }
};

/**
 * Send SMS verification code to phone number using React Native Firebase
 *
 * @param {string} phoneNumber - Phone number without country code
 * @param {string} countryCode - ISO country code (e.g., 'US', 'GB')
 * @returns {Promise<object>} - { success, confirmation?, formattedNumber?, error? }
 */
export const sendVerificationCode = async (phoneNumber, countryCode) => {
  logger.debug('phoneAuthService.sendVerificationCode: Starting', {
    phoneNumber: phoneNumber ? `${phoneNumber.slice(0, 3)}***` : null,
    countryCode
  });

  // Validate phone number first
  const validation = validatePhoneNumber(phoneNumber, countryCode);
  if (!validation.valid) {
    logger.warn('phoneAuthService.sendVerificationCode: Validation failed', {
      error: validation.error
    });
    return { success: false, error: validation.error };
  }

  try {
    logger.debug('phoneAuthService.sendVerificationCode: Calling signInWithPhoneNumber', {
      e164: validation.e164
    });

    // Get auth instance and sign in with phone number
    const auth = getAuth();
    const confirmation = await signInWithPhoneNumber(auth, validation.e164);

    logger.info('phoneAuthService.sendVerificationCode: Code sent successfully', {
      formattedNumber: validation.formatted,
      hasConfirmation: !!confirmation
    });

    return {
      success: true,
      confirmation,
      formattedNumber: validation.formatted,
      e164: validation.e164,
    };
  } catch (error) {
    const errorMessage = getPhoneAuthErrorMessage(error.code);
    logger.error('phoneAuthService.sendVerificationCode: Failed', {
      errorCode: error.code,
      errorMessage: error.message,
      userMessage: errorMessage,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
    });
    return { success: false, error: errorMessage };
  }
};

/**
 * Verify SMS code and complete sign-in
 * @param {object} confirmation - Confirmation object from sendVerificationCode
 * @param {string} code - 6-digit verification code
 * @returns {Promise<object>} - { success, user?, error? }
 */
export const verifyCode = async (confirmation, code) => {
  logger.debug('phoneAuthService.verifyCode: Starting', {
    hasConfirmation: !!confirmation,
    codeLength: code?.length
  });

  // Validate confirmation object exists
  if (!confirmation) {
    logger.error('phoneAuthService.verifyCode: No confirmation object');
    return { success: false, error: 'Verification session expired. Please request a new code.' };
  }

  // Validate code format
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    logger.warn('phoneAuthService.verifyCode: Invalid code format', {
      codeLength: code?.length,
      isNumeric: /^\d+$/.test(code || '')
    });
    return { success: false, error: 'Please enter the 6-digit code.' };
  }

  try {
    logger.debug('phoneAuthService.verifyCode: Confirming code');

    // Confirm the verification code
    const userCredential = await confirmation.confirm(code);

    logger.info('phoneAuthService.verifyCode: Success', {
      userId: userCredential.user?.uid
    });

    return {
      success: true,
      user: userCredential.user,
    };
  } catch (error) {
    const errorMessage = getPhoneAuthErrorMessage(error.code);
    logger.error('phoneAuthService.verifyCode: Failed', {
      errorCode: error.code,
      errorMessage: error.message,
      userMessage: errorMessage
    });
    return { success: false, error: errorMessage };
  }
};

/**
 * Get current authenticated user from React Native Firebase
 * @returns {object|null} - Current Firebase user or null
 */
export const getCurrentUser = () => {
  const auth = getAuth();
  const user = auth.currentUser;
  logger.debug('phoneAuthService.getCurrentUser', {
    hasUser: !!user,
    userId: user?.uid
  });
  return user;
};

/**
 * Sign out from React Native Firebase
 * @returns {Promise<object>} - { success, error? }
 */
export const signOut = async () => {
  logger.debug('phoneAuthService.signOut: Starting');

  try {
    const auth = getAuth();
    await auth.signOut();
    logger.info('phoneAuthService.signOut: Success');
    return { success: true };
  } catch (error) {
    logger.error('phoneAuthService.signOut: Failed', {
      errorCode: error.code,
      errorMessage: error.message
    });
    return { success: false, error: error.message };
  }
};

/**
 * Subscribe to auth state changes (React Native Firebase)
 * @param {function} callback - Callback function (user) => void
 * @returns {function} - Unsubscribe function
 */
export const onAuthStateChanged = (callback) => {
  logger.debug('phoneAuthService.onAuthStateChanged: Subscribing');
  const auth = getAuth();
  return auth.onAuthStateChanged(callback);
};
