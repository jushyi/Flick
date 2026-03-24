-- Migration: Add messaging columns and message_deletions table for Phase 17
-- Adds read receipt columns, emoji/reply_preview columns, message_deletions table, and pg_net extension

-- 1. Add read receipt columns to conversations
ALTER TABLE conversations ADD COLUMN last_read_at_p1 TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN last_read_at_p2 TIMESTAMPTZ;

-- 2. Add emoji column to messages (for reaction messages: 'heart', 'laugh', 'surprise', 'sad', 'angry', 'thumbs_up')
ALTER TABLE messages ADD COLUMN emoji TEXT;

-- 3. Add reply_preview JSONB column to messages (denormalized reply context)
-- Shape: { "sender_id": "uuid", "type": "text|snap|reaction|tagged_photo", "text": "first 100 chars or null" }
ALTER TABLE messages ADD COLUMN reply_preview JSONB;

-- 4. Create message_deletions junction table (delete-for-me: user inserts a row to hide a message for themselves only)
CREATE TABLE message_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

ALTER TABLE message_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_deletions_insert" ON message_deletions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "message_deletions_select" ON message_deletions FOR SELECT
  USING (user_id = auth.uid());

-- 5. Enable pg_net extension (needed for snap cleanup trigger to call Edge Function)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
