-- Migration: Create messaging tables
-- Phase 12, Plan 02: Core schema for Flick
-- Replaces Firestore conversations/, messages/, streaks

-- Conversations (deterministic pair ordering, like friendships)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_type TEXT,                          -- 'text', 'reaction', 'reply', 'snap', 'tagged_photo'
  last_message_sender_id UUID REFERENCES users(id),
  unread_count_p1 INTEGER DEFAULT 0,
  unread_count_p2 INTEGER DEFAULT 0,
  deleted_at_p1 TIMESTAMPTZ,                       -- Soft delete per participant
  deleted_at_p2 TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant1_id, participant2_id),
  CHECK (participant1_id < participant2_id)
);

CREATE INDEX idx_conversations_p1 ON conversations(participant1_id);
CREATE INDEX idx_conversations_p2 ON conversations(participant2_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'text',               -- 'text', 'reaction', 'reply', 'snap', 'tagged_photo'
  text TEXT,
  gif_url TEXT,
  reply_to_id UUID REFERENCES messages(id),
  snap_storage_path TEXT,                          -- Supabase Storage path for snap
  snap_viewed_at TIMESTAMPTZ,
  tagged_photo_id UUID REFERENCES photos(id),
  unsent_at TIMESTAMPTZ,                           -- Soft unsend (message hidden but retained)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Streaks (deterministic pair ordering)
CREATE TABLE streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_count INTEGER DEFAULT 0,
  last_snap_at_user1 TIMESTAMPTZ,
  last_snap_at_user2 TIMESTAMPTZ,
  last_mutual_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  warning_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id)
);

CREATE INDEX idx_streaks_expires ON streaks(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_streaks_user1 ON streaks(user1_id);
CREATE INDEX idx_streaks_user2 ON streaks(user2_id);

ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;
