import { sendVerificationCode, verifyCode, getPhoneAuthErrorMessage, validatePhoneNumber, signOut } from '../../src/services/supabase/phoneAuthService';

describe('phoneAuthService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('validatePhoneNumber', () => {
    it('returns valid with E.164 for valid US number', () => {
      const result = validatePhoneNumber('2025551234', 'US');
      expect(result.valid).toBe(true);
      expect(result.e164).toBe('+12025551234');
    });
    it('returns invalid for bad number', () => {
      const result = validatePhoneNumber('123', 'US');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('sendVerificationCode', () => {
    it('calls signInWithOtp with E.164 phone and returns success', async () => {
      global.__supabaseMocks.auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
      const result = await sendVerificationCode('2025551234', 'US');
      expect(result.success).toBe(true);
      expect(result.e164).toBe('+12025551234');
      expect(global.__supabaseMocks.auth.signInWithOtp).toHaveBeenCalledWith({ phone: '+12025551234' });
    });
    it('returns error for invalid phone', async () => {
      const result = await sendVerificationCode('123', 'US');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
    it('maps Supabase error to user-friendly message', async () => {
      global.__supabaseMocks.auth.signInWithOtp.mockResolvedValue({ data: null, error: { message: 'rate limit exceeded' } });
      const result = await sendVerificationCode('2025551234', 'US');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many attempts');
    });
  });

  describe('verifyCode', () => {
    it('calls verifyOtp with phone, token, and type sms', async () => {
      const mockSession = { access_token: 'abc', refresh_token: 'def' };
      global.__supabaseMocks.auth.verifyOtp.mockResolvedValue({ data: { session: mockSession }, error: null });
      const result = await verifyCode('+12025551234', '123456');
      expect(result.success).toBe(true);
      expect(result.session).toEqual(mockSession);
      expect(global.__supabaseMocks.auth.verifyOtp).toHaveBeenCalledWith({ phone: '+12025551234', token: '123456', type: 'sms' });
    });
    it('returns error for invalid code', async () => {
      global.__supabaseMocks.auth.verifyOtp.mockResolvedValue({ data: null, error: { message: 'otp_not_found' } });
      const result = await verifyCode('+12025551234', '000000');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid code');
    });
  });

  describe('getPhoneAuthErrorMessage', () => {
    it('maps otp_expired', () => {
      expect(getPhoneAuthErrorMessage('otp_expired')).toContain('expired');
    });
    it('maps otp_not_found', () => {
      expect(getPhoneAuthErrorMessage('otp_not_found')).toContain('Invalid code');
    });
  });

  describe('signOut', () => {
    it('calls supabase.auth.signOut', async () => {
      global.__supabaseMocks.auth.signOut.mockResolvedValue({ error: null });
      const result = await signOut();
      expect(result.success).toBe(true);
    });
  });
});
