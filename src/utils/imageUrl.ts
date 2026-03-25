/**
 * Image URL Utilities
 *
 * Provides helpers for Supabase Storage image transforms and signed URL expiry detection.
 *
 * Two entry points for transforms:
 * - getTransformedPhotoUrl(storagePath) -- when storage path is available (e.g., new uploads)
 * - appendTransformParams(fullUrl) -- when only the full CDN URL is available (e.g., feed RPC data)
 *
 * Signed URL expiry:
 * - getSignedUrlExpiry(url) -- extracts exp claim from JWT token parameter
 * - isUrlNearExpiry(url) -- checks if URL expires within threshold (default 60s)
 */

import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Width in px for feed card images (responsive sizing) */
export const FEED_CARD_WIDTH = 400;

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------

interface TransformOptions {
  width?: number;
  quality?: number;
  bucket?: string;
}

/**
 * Get a transformed photo URL using a storage path.
 * Use when you have the storage path (e.g., from new uploads or when storagePath is available).
 *
 * @param storagePath - Path within the bucket (e.g., 'user-id/photo.webp')
 * @param options - Transform options (width, quality, bucket)
 * @returns Public URL string (with or without transform params)
 */
export function getTransformedPhotoUrl(
  storagePath: string,
  options?: TransformOptions
): string {
  const bucket = options?.bucket ?? 'photos';
  const width = options?.width;
  const quality = options?.quality;

  if (width) {
    const transform: Record<string, number> = { width };
    if (quality) {
      transform.quality = quality;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath, { transform });
    return data.publicUrl;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return data.publicUrl;
}

interface AppendTransformOptions {
  width?: number;
  quality?: number;
}

/**
 * Append image transform parameters to a full Supabase public CDN URL.
 * Use when you have the FULL public URL (e.g., FeedPhoto.imageUrl from feed RPC).
 *
 * Replaces '/storage/v1/object/public/' with '/storage/v1/render/image/public/'
 * and appends width/format/quality query params.
 *
 * If the URL does not contain the expected path segment, returns it unchanged (graceful no-op).
 *
 * @param fullUrl - Full public CDN URL
 * @param options - Transform options (width, quality)
 * @returns Transformed URL or original URL unchanged
 */
export function appendTransformParams(
  fullUrl: string,
  options?: AppendTransformOptions
): string {
  if (!options?.width) {
    return fullUrl;
  }

  const objectPublicSegment = '/storage/v1/object/public/';
  if (!fullUrl.includes(objectPublicSegment)) {
    return fullUrl;
  }

  let transformed = fullUrl.replace(objectPublicSegment, '/storage/v1/render/image/public/');
  transformed += `?width=${options.width}&format=webp`;

  if (options.quality) {
    transformed += `&quality=${options.quality}`;
  }

  return transformed;
}

// ---------------------------------------------------------------------------
// Signed URL expiry
// ---------------------------------------------------------------------------

/**
 * Decode a base64 string to a UTF-8 string.
 * Tries Buffer.from first (Node.js / React Native with polyfill),
 * falls back to atob for environments where Buffer is unavailable.
 */
function decodeBase64(encoded: string): string {
  // Normalize base64url to standard base64
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  // Pad if necessary
  const pad = base64.length % 4;
  if (pad) {
    base64 += '='.repeat(4 - pad);
  }

  try {
    // Try Buffer first (available in Node.js and React Native)
    const BufferImpl = require('buffer').Buffer;
    return BufferImpl.from(base64, 'base64').toString('utf-8');
  } catch {
    // Fallback to atob (available in modern JS environments)
    return decodeURIComponent(
      escape(atob(base64))
    );
  }
}

/**
 * Extract the expiry timestamp from a signed URL's JWT token.
 *
 * @param signedUrl - A Supabase signed URL containing a `token` query parameter
 * @returns Expiry time in milliseconds, or null if unparseable
 */
export function getSignedUrlExpiry(signedUrl: string): number | null {
  try {
    const url = new URL(signedUrl);
    const token = url.searchParams.get('token');
    if (!token) {
      return null;
    }

    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }

    const payloadJson = decodeBase64(parts[1]);
    const payload = JSON.parse(payloadJson);

    if (typeof payload.exp !== 'number') {
      return null;
    }

    return payload.exp * 1000;
  } catch {
    return null;
  }
}

/**
 * Check if a signed URL is near expiry.
 * Returns true if the URL expires within the threshold (fail-safe: returns true if unparseable).
 *
 * @param signedUrl - A Supabase signed URL
 * @param thresholdMs - Threshold in milliseconds (default 60 seconds)
 * @returns true if URL is expired or will expire within threshold
 */
export function isUrlNearExpiry(signedUrl: string, thresholdMs = 60_000): boolean {
  const expiry = getSignedUrlExpiry(signedUrl);
  if (expiry === null) {
    return true; // Can't determine expiry = treat as expired (fail-safe)
  }
  return Date.now() + thresholdMs >= expiry;
}
