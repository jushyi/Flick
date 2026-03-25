/**
 * sentryService tests
 *
 * Tests for src/services/sentryService.ts.
 * Validates Sentry initialization, user context, and trace wrapping.
 */

import * as Sentry from '@sentry/react-native';

// Sentry is mocked in jest.setup.ts

describe('sentryService', () => {
  // These imports will resolve once Plan 02 creates the source module
  let initSentry: () => void;
  let withTrace: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
  let setSentryUser: (user: { id: string; username: string } | null) => void;

  beforeAll(() => {
    // Dynamic import to avoid failure before source module exists
    const mod = require('../../src/services/sentryService');
    initSentry = mod.initSentry;
    withTrace = mod.withTrace;
    setSentryUser = mod.setSentryUser;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initSentry', () => {
    it('calls Sentry.init with configuration', () => {
      initSentry();
      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: expect.any(String),
        })
      );
    });
  });

  describe('setSentryUser', () => {
    it('sets user context when user provided', () => {
      setSentryUser({ id: 'user-1', username: 'testuser' });
      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: 'user-1',
        username: 'testuser',
      });
    });

    it('clears user context when null', () => {
      setSentryUser(null);
      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });
  });

  describe('withTrace', () => {
    it('wraps operation in Sentry span and returns result', async () => {
      const result = await withTrace('test-op', async () => 'result');
      expect(Sentry.startSpan).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'test-op' }),
        expect.any(Function)
      );
      expect(result).toBe('result');
    });

    it('propagates errors from traced operation', async () => {
      await expect(
        withTrace('fail-op', async () => {
          throw new Error('fail');
        })
      ).rejects.toThrow('fail');
    });
  });
});
