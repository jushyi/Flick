-- Migration: Create photos and related tables
-- Phase 12, Plan 02: Core schema for Flick
-- Replaces Firestore photos/, photo_reactions, photo_tags, viewed_photos

CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT,                                  -- NULL until upload completes
  local_uri TEXT,                                  -- Client-side only (PowerSync)
  thumbnail_data_url TEXT,                         -- Base64 progressive loading placeholder
  status TEXT NOT NULL DEFAULT 'developing',       -- 'developing' or 'revealed'
  photo_state TEXT,                                -- NULL, 'journal', 'archive'
  media_type TEXT NOT NULL DEFAULT 'photo',        -- 'photo' or 'video'
  caption TEXT,                                    -- Max 100 chars, enforced by app
  reveal_at TIMESTAMPTZ,                           -- When to reveal
  storage_path TEXT,                               -- Supabase Storage path
  comment_count INTEGER DEFAULT 0,
  reaction_count INTEGER DEFAULT 0,
  deleted_at TIMESTAMPTZ,                          -- Soft delete
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_photos_user_status ON photos(user_id, status);
CREATE INDEX idx_photos_reveal ON photos(status, reveal_at) WHERE status = 'developing';
CREATE INDEX idx_photos_user_created ON photos(user_id, created_at DESC);
CREATE INDEX idx_photos_feed ON photos(user_id, photo_state, created_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Photo reactions (normalized from nested Firestore map)
CREATE TABLE photo_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(photo_id, user_id, emoji)
);

CREATE INDEX idx_photo_reactions_photo ON photo_reactions(photo_id);

ALTER TABLE photo_reactions ENABLE ROW LEVEL SECURITY;

-- Photo tags (normalized from array field)
CREATE TABLE photo_tags (
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (photo_id, user_id)
);

ALTER TABLE photo_tags ENABLE ROW LEVEL SECURITY;

-- Viewed photos tracking
CREATE TABLE viewed_photos (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, photo_id)
);

ALTER TABLE viewed_photos ENABLE ROW LEVEL SECURITY;
