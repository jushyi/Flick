// Mock supabase before importing connector
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
    from: jest.fn(),
  },
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { SupabaseConnector } from '../../src/lib/powersync/connector';
import { supabase } from '../../src/lib/supabase';

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

describe('SupabaseConnector', () => {
  let connector: SupabaseConnector;

  beforeEach(() => {
    connector = new SupabaseConnector();
    jest.clearAllMocks();
  });

  describe('fetchCredentials', () => {
    it('returns credentials when session exists', async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token',
            expires_at: 1700000000,
          },
        },
        error: null,
      });

      const creds = await connector.fetchCredentials();
      expect(creds).toEqual({
        endpoint: process.env.EXPO_PUBLIC_POWERSYNC_URL ?? '',
        token: 'test-token',
        expiresAt: new Date(1700000000 * 1000),
      });
    });

    it('returns null when no session', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const creds = await connector.fetchCredentials();
      expect(creds).toBeNull();
    });

    it('throws on auth error', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Auth failed' },
      });

      await expect(connector.fetchCredentials()).rejects.toThrow(
        'Could not fetch Supabase session'
      );
    });
  });

  describe('uploadData', () => {
    const mockDatabase = {
      getNextCrudTransaction: jest.fn(),
    } as any;

    it('does nothing when no transaction', async () => {
      mockDatabase.getNextCrudTransaction.mockResolvedValue(null);
      await connector.uploadData(mockDatabase);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('handles PUT operation via upsert', async () => {
      const mockComplete = jest.fn();
      const mockUpsert = jest.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ upsert: mockUpsert });
      mockDatabase.getNextCrudTransaction.mockResolvedValue({
        crud: [{ op: 'PUT', table: 'photos', id: 'photo-1', opData: { status: 'revealed' } }],
        complete: mockComplete,
      });

      await connector.uploadData(mockDatabase);
      expect(mockFrom).toHaveBeenCalledWith('photos');
      expect(mockUpsert).toHaveBeenCalledWith({ status: 'revealed', id: 'photo-1' });
      expect(mockComplete).toHaveBeenCalled();
    });

    it('handles PATCH operation via update', async () => {
      const mockComplete = jest.fn();
      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ update: mockUpdate });
      mockDatabase.getNextCrudTransaction.mockResolvedValue({
        crud: [
          { op: 'PATCH', table: 'users', id: 'user-1', opData: { display_name: 'New Name' } },
        ],
        complete: mockComplete,
      });

      await connector.uploadData(mockDatabase);
      expect(mockUpdate).toHaveBeenCalledWith({ display_name: 'New Name' });
      expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
      expect(mockComplete).toHaveBeenCalled();
    });

    it('handles DELETE operation', async () => {
      const mockComplete = jest.fn();
      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ delete: mockDelete });
      mockDatabase.getNextCrudTransaction.mockResolvedValue({
        crud: [{ op: 'DELETE', table: 'photos', id: 'photo-1', opData: null }],
        complete: mockComplete,
      });

      await connector.uploadData(mockDatabase);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', 'photo-1');
      expect(mockComplete).toHaveBeenCalled();
    });

    it('completes transaction on fatal PostgreSQL error code', async () => {
      const mockComplete = jest.fn();
      const mockUpsert = jest.fn().mockRejectedValue({ code: '23505', message: 'unique violation' });
      mockFrom.mockReturnValue({ upsert: mockUpsert });
      mockDatabase.getNextCrudTransaction.mockResolvedValue({
        crud: [{ op: 'PUT', table: 'photos', id: 'photo-1', opData: {} }],
        complete: mockComplete,
      });

      await connector.uploadData(mockDatabase);
      expect(mockComplete).toHaveBeenCalled();
    });

    it('re-throws on retryable error', async () => {
      const mockComplete = jest.fn();
      const networkError = new Error('Network timeout');
      const mockUpsert = jest.fn().mockRejectedValue(networkError);
      mockFrom.mockReturnValue({ upsert: mockUpsert });
      mockDatabase.getNextCrudTransaction.mockResolvedValue({
        crud: [{ op: 'PUT', table: 'photos', id: 'photo-1', opData: {} }],
        complete: mockComplete,
      });

      await expect(connector.uploadData(mockDatabase)).rejects.toThrow('Network timeout');
      expect(mockComplete).not.toHaveBeenCalled();
    });
  });
});
