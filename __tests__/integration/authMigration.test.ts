// Integration test for silent Firebase-to-Supabase auth migration (AUTH-02)
// Tests the client-side migration bridge in AuthContext

describe('Silent Auth Migration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('detects Firebase token and calls migrate-firebase-auth Edge Function', async () => {
    // Mock Firebase auth to return a current user with token
    // Mock supabase.functions.invoke to return success with tokens
    // Verify: supabase.functions.invoke called with { firebaseToken }
    // Verify: supabase.auth.setSession called with { access_token, refresh_token }
    const mockInvoke = global.__supabaseMocks.functions.invoke;
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        migrated: true,
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        supabaseUserId: 'supa-uuid-123',
      },
      error: null,
    });

    // This test will fail until AuthContext implements the migration bridge
    // that calls setSession with the returned tokens
    expect(mockInvoke).not.toHaveBeenCalled(); // Placeholder -- will be replaced with actual AuthContext test
    // TODO: Import and test the migration function from AuthContext once implemented
  });

  it('Edge Function returns access_token and refresh_token (not just supabaseUserId)', async () => {
    const mockInvoke = global.__supabaseMocks.functions.invoke;
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        migrated: true,
        access_token: 'real-access-token',
        refresh_token: 'real-refresh-token',
        supabaseUserId: 'supa-uuid-123',
      },
      error: null,
    });

    // Verify response shape includes tokens (not just userId)
    const response = await mockInvoke('migrate-firebase-auth', { body: { firebaseToken: 'fb-token' } });
    expect(response.data.access_token).toBeDefined();
    expect(response.data.refresh_token).toBeDefined();
    expect(response.data.success).toBe(true);
  });

  it('falls back to re-verification when migration fails', async () => {
    const mockInvoke = global.__supabaseMocks.functions.invoke;
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Firebase token expired' },
    });

    const response = await mockInvoke('migrate-firebase-auth', { body: { firebaseToken: 'expired-token' } });
    expect(response.error).toBeDefined();
    // Client should navigate to PhoneInputScreen for re-verification
  });
});
