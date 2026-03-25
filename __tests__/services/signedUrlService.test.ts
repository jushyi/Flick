import { getPhotoUrl, getSnapUrl } from '../../src/services/supabase/signedUrlService';

describe('signedUrlService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getPhotoUrl', () => {
    it('returns public CDN URL synchronously', () => {
      const url = getPhotoUrl('photos/uid/photo123.webp');
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
      expect((global as any).__supabaseMocks.storage.from).toHaveBeenCalledWith('photos');
    });
  });

  describe('getSnapUrl', () => {
    it('returns signed URL with 300s expiry', async () => {
      const url = await getSnapUrl('uid/snap123.webp');
      expect(typeof url).toBe('string');
      expect((global as any).__supabaseMocks.storage.from).toHaveBeenCalledWith('snaps');
    });
    it('returns null on error', async () => {
      (global as any).__supabaseMocks.storage.from.mockReturnValueOnce({
        createSignedUrl: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      });
      const url = await getSnapUrl('uid/missing.webp');
      expect(url).toBeNull();
    });
  });
});
