import { getPhotoUrl, getSnapUrl } from '../../src/services/supabase/signedUrlService';

describe('signedUrlService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getPhotoUrl', () => {
    it('returns public CDN URL synchronously', () => {
      const url = getPhotoUrl('photos/uid/photo123.webp');
      expect(url).toContain('public');
      expect(url).toContain('photo123.webp');
    });
  });

  describe('getSnapUrl', () => {
    it('returns signed URL with 300s expiry', async () => {
      const url = await getSnapUrl('uid/snap123.webp');
      expect(url).toContain('snap123.webp');
      expect(global.__supabaseMocks.storage.from).toHaveBeenCalledWith('snaps');
    });
    it('returns null on error', async () => {
      global.__supabaseMocks.storage.from.mockReturnValueOnce({
        createSignedUrl: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      });
      const url = await getSnapUrl('uid/missing.webp');
      expect(url).toBeNull();
    });
  });
});
