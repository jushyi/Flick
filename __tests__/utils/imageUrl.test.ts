/**
 * Tests for imageUrl utility
 *
 * Tests CDN transform URL generation (both storagePath and fullUrl variants)
 * and signed URL expiry detection.
 */

// The global supabase mock from jest.setup.js handles @supabase/supabase-js.
// We need to mock @/lib/supabase which imports createClient.
jest.mock('@/lib/supabase', () => {
  const mockGetPublicUrl = jest.fn((path: string, options?: any) => {
    if (options?.transform) {
      const params = new URLSearchParams();
      if (options.transform.width) params.set('width', String(options.transform.width));
      if (options.transform.quality) params.set('quality', String(options.transform.quality));
      return {
        data: {
          publicUrl: `https://test.supabase.co/storage/v1/render/image/public/photos/${path}?${params.toString()}`,
        },
      };
    }
    return {
      data: {
        publicUrl: `https://test.supabase.co/storage/v1/object/public/photos/${path}`,
      },
    };
  });

  const mockFrom = jest.fn((bucket: string) => ({
    getPublicUrl: jest.fn((path: string, options?: any) => {
      if (options?.transform) {
        const params = new URLSearchParams();
        if (options.transform.width) params.set('width', String(options.transform.width));
        if (options.transform.quality) params.set('quality', String(options.transform.quality));
        return {
          data: {
            publicUrl: `https://test.supabase.co/storage/v1/render/image/public/${bucket}/${path}?${params.toString()}`,
          },
        };
      }
      return {
        data: {
          publicUrl: `https://test.supabase.co/storage/v1/object/public/${bucket}/${path}`,
        },
      };
    }),
  }));

  return {
    supabase: {
      storage: {
        from: mockFrom,
      },
    },
  };
});

import {
  getTransformedPhotoUrl,
  appendTransformParams,
  getSignedUrlExpiry,
  isUrlNearExpiry,
  FEED_CARD_WIDTH,
} from '@/utils/imageUrl';

// Helper to create a JWT-like token with an exp claim
function makeJwt(exp: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  const signature = 'fake-signature';
  return `${header}.${payload}.${signature}`;
}

describe('imageUrl', () => {
  describe('FEED_CARD_WIDTH', () => {
    it('equals 400', () => {
      expect(FEED_CARD_WIDTH).toBe(400);
    });
  });

  describe('getTransformedPhotoUrl', () => {
    it('returns CDN URL with width param for feed cards', () => {
      const url = getTransformedPhotoUrl('user/photo.webp', { width: 400 });
      expect(url).toContain('render/image');
      expect(url).toContain('width=400');
    });

    it('returns standard CDN URL without transform when no width', () => {
      const url = getTransformedPhotoUrl('user/photo.webp');
      expect(url).toContain('object/public');
      expect(url).not.toContain('render/image');
    });

    it('uses custom bucket when specified', () => {
      const url = getTransformedPhotoUrl('user/profile.webp', { bucket: 'profiles' });
      expect(url).toContain('profiles');
    });
  });

  describe('appendTransformParams', () => {
    const baseUrl =
      'https://abc.supabase.co/storage/v1/object/public/photos/user/photo.webp';

    it('replaces /object/public/ with /render/image/public/ and appends width', () => {
      const result = appendTransformParams(baseUrl, { width: 400 });
      expect(result).toContain('/render/image/public/');
      expect(result).not.toContain('/object/public/');
      expect(result).toContain('width=400');
      expect(result).toContain('format=webp');
    });

    it('returns original URL if URL does not contain /object/public/', () => {
      const externalUrl = 'https://example.com/photo.jpg';
      const result = appendTransformParams(externalUrl, { width: 400 });
      expect(result).toBe(externalUrl);
    });

    it('appends quality option when provided', () => {
      const result = appendTransformParams(baseUrl, { width: 400, quality: 75 });
      expect(result).toContain('quality=75');
    });

    it('returns URL unchanged when no options provided', () => {
      const result = appendTransformParams(baseUrl);
      expect(result).toBe(baseUrl);
    });
  });

  describe('Buffer.from canary', () => {
    it('Buffer.from base64 decode works in this environment', () => {
      const decoded = Buffer.from('dGVzdA==', 'base64').toString();
      expect(decoded).toBe('test');
    });
  });

  describe('getSignedUrlExpiry', () => {
    it('returns expiry timestamp in ms from a valid signed URL JWT', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const token = makeJwt(exp);
      const url = `https://test.supabase.co/storage/v1/object/sign/snaps/user/snap.webp?token=${token}`;

      const result = getSignedUrlExpiry(url);
      expect(result).toBe(exp * 1000);
    });

    it('returns null for URL without token param', () => {
      const url = 'https://test.supabase.co/storage/v1/object/public/photos/user/photo.webp';
      expect(getSignedUrlExpiry(url)).toBeNull();
    });

    it('returns null for malformed JWT', () => {
      const url =
        'https://test.supabase.co/storage/v1/object/sign/snaps/user/snap.webp?token=not.a.jwt';
      expect(getSignedUrlExpiry(url)).toBeNull();
    });
  });

  describe('isUrlNearExpiry', () => {
    it('returns true when URL expires within 60s', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const exp = Math.floor(now / 1000) + 30; // 30s from now
      const token = makeJwt(exp);
      const url = `https://test.supabase.co/storage/v1/object/sign/snaps/user/snap.webp?token=${token}`;

      expect(isUrlNearExpiry(url)).toBe(true);

      jest.restoreAllMocks();
    });

    it('returns false when URL has >60s remaining', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const exp = Math.floor(now / 1000) + 300; // 5 min from now
      const token = makeJwt(exp);
      const url = `https://test.supabase.co/storage/v1/object/sign/snaps/user/snap.webp?token=${token}`;

      expect(isUrlNearExpiry(url)).toBe(false);

      jest.restoreAllMocks();
    });

    it('returns true when URL has no parseable expiry (safety fallback)', () => {
      const url = 'https://test.supabase.co/storage/v1/object/public/photos/user/photo.webp';
      expect(isUrlNearExpiry(url)).toBe(true);
    });
  });
});
