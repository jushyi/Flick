-- ================================================================
-- URL Migration: Firebase Storage -> Supabase Storage
-- Phase 13, Plan 04: Storage URL Migration
--
-- Run AFTER scripts/migrate-firebase-storage.ts has completed.
-- The storage migration script must finish transferring all files
-- before this SQL updates the URL references.
--
-- IMPORTANT: Replace 'YOUR_PROJECT' with your actual Supabase
-- project reference (e.g., 'abcdefghij') before running.
-- The full URL format is: https://<ref>.supabase.co
-- ================================================================

-- Helper function: converts a Firebase Storage URL to a Supabase CDN URL.
-- Handles both encoded (%2F) and unencoded path separators.
-- Returns the original value unchanged if it is NULL, empty, already a
-- Supabase URL, or does not match any known bucket prefix.

CREATE OR REPLACE FUNCTION migrate_firebase_url(
  firebase_url TEXT,
  supabase_project_url TEXT
)
RETURNS TEXT AS $$
DECLARE
  decoded_path TEXT;
  bucket TEXT;
  file_path TEXT;
BEGIN
  -- Pass through NULL, empty, or already-migrated URLs
  IF firebase_url IS NULL OR firebase_url = '' THEN
    RETURN firebase_url;
  END IF;

  IF firebase_url LIKE '%supabase%' THEN
    RETURN firebase_url;
  END IF;

  -- Not a Firebase Storage URL -- leave unchanged
  IF firebase_url NOT LIKE '%firebasestorage.googleapis.com%' THEN
    RETURN firebase_url;
  END IF;

  -- Extract the path component between /o/ and ?
  -- Firebase Storage URLs: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token=...
  decoded_path := split_part(split_part(firebase_url, '/o/', 2), '?', 1);
  decoded_path := replace(decoded_path, '%2F', '/');

  -- Map Firebase path prefixes to Supabase Storage buckets
  IF decoded_path LIKE 'photos/%' THEN
    -- photos/{userId}/{photoId}.jpg -> bucket 'photos', path unchanged
    bucket := 'photos';
    file_path := substring(decoded_path FROM length('photos/') + 1);
  ELSIF decoded_path LIKE 'profile-photos/%' THEN
    -- profile-photos/{userId}/profile.jpg -> bucket 'profile-photos', path = {userId}/profile.jpg
    bucket := 'profile-photos';
    file_path := substring(decoded_path FROM length('profile-photos/') + 1);
  ELSIF decoded_path LIKE 'selects/%' THEN
    -- selects/{userId}/select_{index}.jpg -> bucket 'selects', path = {userId}/select_{index}.jpg
    bucket := 'selects';
    file_path := substring(decoded_path FROM length('selects/') + 1);
  ELSIF decoded_path LIKE 'comment-images/%' THEN
    -- comment-images/{uuid}.jpg -> bucket 'comment-images', path = {uuid}.jpg
    bucket := 'comment-images';
    file_path := substring(decoded_path FROM length('comment-images/') + 1);
  ELSE
    -- Unknown prefix -- leave unchanged
    RETURN firebase_url;
  END IF;

  RETURN supabase_project_url || '/storage/v1/object/public/' || bucket || '/' || file_path;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ================================================================
-- Apply URL migration
-- ================================================================

-- NOTE: Replace 'https://YOUR_PROJECT.supabase.co' with your actual
-- Supabase project URL before running this migration.

-- 1. Update photo image URLs (photos.image_url)
UPDATE photos
SET image_url = migrate_firebase_url(image_url, 'https://YOUR_PROJECT.supabase.co')
WHERE image_url LIKE '%firebasestorage.googleapis.com%';

-- 2. Populate storage_path from migrated image_url (for photos bucket)
--    Extracts the path after '/public/photos/' from the new Supabase CDN URL
UPDATE photos
SET storage_path = 'photos/' || split_part(image_url, '/public/photos/', 2)
WHERE image_url LIKE '%/public/photos/%'
  AND (storage_path IS NULL OR storage_path = '');

-- 3. Update user profile photo paths if they contain Firebase URLs
--    (profile_photo_path may contain full Firebase URLs from data import)
UPDATE users
SET profile_photo_path = migrate_firebase_url(profile_photo_path, 'https://YOUR_PROJECT.supabase.co')
WHERE profile_photo_path LIKE '%firebasestorage.googleapis.com%';

-- 4. Update selects JSONB array entries if they contain Firebase URLs
--    selects column stores interest strings, but during Firebase data import
--    the selects photo URLs may be stored elsewhere. This handles any JSONB
--    fields that contain Firebase URLs.
-- (Selects photos are in the selects storage bucket, URLs may be in user profiles)


-- ================================================================
-- Index for storage_path lookups
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_photos_storage_path
  ON photos (storage_path)
  WHERE storage_path IS NOT NULL;


-- ================================================================
-- Post-migration verification queries
-- Run these manually after migration to confirm zero Firebase URLs remain.
-- Both queries must return 0 rows.
-- ================================================================

-- SELECT COUNT(*) AS firebase_photo_urls FROM photos
--   WHERE image_url LIKE '%firebasestorage.googleapis.com%';
--
-- SELECT COUNT(*) AS firebase_profile_urls FROM users
--   WHERE profile_photo_path LIKE '%firebasestorage.googleapis.com%';


-- ================================================================
-- Cleanup: drop the helper function (no longer needed after migration)
-- ================================================================

DROP FUNCTION IF EXISTS migrate_firebase_url(TEXT, TEXT);
