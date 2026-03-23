import React, { createContext, useContext, useState } from 'react';
import logger from '../utils/logger';

/**
 * PhoneAuthContext
 *
 * Simplified for Supabase OTP flow. Stores E.164 phone number between
 * PhoneInputScreen and VerificationScreen. No ConfirmationResult needed --
 * Supabase OTP is inherently stateless.
 */
const PhoneAuthContext = createContext(null);

/**
 * PhoneAuthProvider
 * Provides E.164 phone state to child components via context.
 */
export const PhoneAuthProvider = ({ children }) => {
  const [e164Phone, setE164Phone] = useState(null);

  logger.debug('PhoneAuthProvider: Mounted');

  return (
    <PhoneAuthContext.Provider value={{ e164Phone, setE164Phone }}>
      {children}
    </PhoneAuthContext.Provider>
  );
};

/**
 * usePhoneAuth hook
 * Access the phone auth context containing E.164 phone state.
 * Must be used within a PhoneAuthProvider.
 *
 * @returns {{ e164Phone: string | null, setE164Phone: (phone: string | null) => void }}
 */
export const usePhoneAuth = () => {
  const context = useContext(PhoneAuthContext);
  if (!context) {
    logger.error('usePhoneAuth: Must be used within PhoneAuthProvider');
    throw new Error('usePhoneAuth must be used within PhoneAuthProvider');
  }
  return context;
};

export default PhoneAuthContext;
