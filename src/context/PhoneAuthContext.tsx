import React, { createContext, useContext, useState, type ReactNode } from 'react';
import logger from '../utils/logger';

interface PhoneAuthContextValue {
  e164Phone: string | null;
  setE164Phone: (phone: string | null) => void;
}

const PhoneAuthContext = createContext<PhoneAuthContextValue | null>(null);

interface PhoneAuthProviderProps {
  children: ReactNode;
}

export const PhoneAuthProvider = ({ children }: PhoneAuthProviderProps): React.JSX.Element => {
  const [e164Phone, setE164Phone] = useState<string | null>(null);

  logger.debug('PhoneAuthProvider: Mounted');

  return (
    <PhoneAuthContext.Provider value={{ e164Phone, setE164Phone }}>
      {children}
    </PhoneAuthContext.Provider>
  );
};

export const usePhoneAuth = (): PhoneAuthContextValue => {
  const context = useContext(PhoneAuthContext);
  if (!context) {
    logger.error('usePhoneAuth: Must be used within PhoneAuthProvider');
    throw new Error('usePhoneAuth must be used within PhoneAuthProvider');
  }
  return context;
};

export default PhoneAuthContext;
