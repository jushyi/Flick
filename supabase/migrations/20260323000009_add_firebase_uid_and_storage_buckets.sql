-- Migration: Add firebase_uid column and storage buckets with RLS
-- Phase 13, Plan 01: Auth & Storage Migration Foundation
-- firebase_uid enables silent migration lookups from Firebase to Supabase

-- Add firebase_uid column for migration lookups
ALTER TABLE users ADD COLUMN firebase_uid TEXT UNIQUE;
CREATE INDEX idx_users_firebase_uid ON users (firebase_uid) WHERE firebase_uid IS NOT NULL;

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('photos', 'photos', true, 52428800, ARRAY['image/webp', 'image/jpeg', 'image/png', 'video/quicktime', 'video/mp4']),
  ('snaps', 'snaps', false, 10485760, ARRAY['image/webp', 'image/jpeg', 'image/png']),
  ('profile-photos', 'profile-photos', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png']),
  ('selects', 'selects', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png']),
  ('comment-images', 'comment-images', true, 10485760, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies: public bucket reads
CREATE POLICY "Public read photos" ON storage.objects FOR SELECT USING (bucket_id = 'photos');
CREATE POLICY "Public read profile-photos" ON storage.objects FOR SELECT USING (bucket_id = 'profile-photos');
CREATE POLICY "Public read selects" ON storage.objects FOR SELECT USING (bucket_id = 'selects');
CREATE POLICY "Public read comment-images" ON storage.objects FOR SELECT USING (bucket_id = 'comment-images');

-- Storage RLS policies: authenticated upload to own path
CREATE POLICY "Users upload own photos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users upload own profile-photos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users upload own selects" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'selects' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users upload own comment-images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('comment-images') AND auth.role() = 'authenticated');

-- Storage RLS policies: delete own files
CREATE POLICY "Users delete own photos" ON storage.objects FOR DELETE
  USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own profile-photos" ON storage.objects FOR DELETE
  USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own selects" ON storage.objects FOR DELETE
  USING (bucket_id = 'selects' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Snaps: private bucket, upload by sender, read by conversation participant
CREATE POLICY "Snap upload by sender" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'snaps' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Snap read by participant" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'snaps'
    AND EXISTS (
      SELECT 1 FROM conversations c
      JOIN messages m ON m.conversation_id = c.id
      WHERE m.snap_storage_path = name
        AND (c.participant1_id = auth.uid() OR c.participant2_id = auth.uid())
    )
  );
CREATE POLICY "Snap delete by sender" ON storage.objects FOR DELETE
  USING (bucket_id = 'snaps' AND (storage.foldername(name))[1] = auth.uid()::text);
