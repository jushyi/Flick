-- Seed data for Flick dev database
-- Run with: npx supabase db reset --linked
-- Applied after all migrations

-- Test users (UUIDs are deterministic for testing)
INSERT INTO users (id, phone, username, display_name, bio, profile_setup_completed, selects, created_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', '+15551234567', 'alice', 'Alice', 'Test user Alice', true, '["photography","music"]'::jsonb, NOW() - INTERVAL '30 days'),
  ('b0000000-0000-0000-0000-000000000002', '+15559876543', 'bob', 'Bob', 'Test user Bob', true, '["gaming","art"]'::jsonb, NOW() - INTERVAL '25 days'),
  ('c0000000-0000-0000-0000-000000000003', '+15555551234', 'charlie', 'Charlie', NULL, false, '[]'::jsonb, NOW() - INTERVAL '1 day');

-- Friendship between alice and bob (accepted)
INSERT INTO friendships (user1_id, user2_id, status, initiated_by) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'accepted', 'a0000000-0000-0000-0000-000000000001');

-- Sample photos
INSERT INTO photos (id, user_id, status, photo_state, media_type, storage_path, created_at) VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'revealed', 'journal', 'photo', 'photos/a0000000/photo1.jpg', NOW() - INTERVAL '2 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'developing', NULL, 'photo', 'photos/a0000000/photo2.jpg', NOW() - INTERVAL '5 minutes'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000002', 'revealed', 'journal', 'video', 'photos/b0000000/video1.mp4', NOW() - INTERVAL '1 day');

-- Sample conversation between alice and bob
INSERT INTO conversations (participant1_id, participant2_id, last_message_text, last_message_at, last_message_type, last_message_sender_id) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'Hey!', NOW() - INTERVAL '1 hour', 'text', 'a0000000-0000-0000-0000-000000000001');
