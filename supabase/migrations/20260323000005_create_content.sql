-- Migration: Create content tables
-- Phase 12, Plan 02: Core schema for Flick
-- Replaces Firestore comments/, albums/, notifications/, reactionBatches/, support_requests

-- Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',                    -- Array of mentioned user IDs
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_photo ON comments(photo_id, created_at);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Comment likes
CREATE TABLE comment_likes (
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- Albums
CREATE TABLE albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'custom',             -- 'custom' or 'monthly'
  month_key TEXT,                                  -- e.g. '2026-03' for monthly albums
  cover_photo_id UUID REFERENCES photos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_albums_user ON albums(user_id);
CREATE INDEX idx_albums_monthly ON albums(user_id, type, month_key) WHERE type = 'monthly';

ALTER TABLE albums ENABLE ROW LEVEL SECURITY;

-- Album photos (junction table)
CREATE TABLE album_photos (
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (album_id, photo_id)
);

ALTER TABLE album_photos ENABLE ROW LEVEL SECURITY;

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                              -- 'friend_request', 'photo_reveal', 'comment', 'reaction', 'snap', 'tag', 'streak_warning', etc.
  title TEXT,
  body TEXT,
  data JSONB DEFAULT '{}',                         -- Flexible payload: photoId, senderId, etc.
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Reaction batches (for notification debouncing/batching)
CREATE TABLE reaction_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  reactor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reactions JSONB DEFAULT '[]'::jsonb,             -- Array of {emoji, timestamp}
  status TEXT NOT NULL DEFAULT 'pending',           -- 'pending', 'sent'
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reaction_batches_status ON reaction_batches(status) WHERE status = 'pending';
CREATE INDEX idx_reaction_batches_cleanup ON reaction_batches(sent_at) WHERE sent_at IS NOT NULL;

ALTER TABLE reaction_batches ENABLE ROW LEVEL SECURITY;

-- Support requests
CREATE TABLE support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;
