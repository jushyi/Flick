-- Migration: Create users table
-- Phase 12, Plan 02: Core schema for Flick
-- Replaces Firestore users/ collection

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id UUID PRIMARY KEY,                            -- Firebase Auth UID preserved during migration
  phone TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  profile_photo_path TEXT,                        -- Storage path, not URL
  name_color TEXT,
  selects JSONB DEFAULT '[]'::jsonb,              -- Array of interest strings e.g. ["photography","music"]
  song JSONB,                                     -- {name, artist, previewUrl, artworkUrl}
  pinned_snap_data JSONB,                         -- Pinned snap metadata (message_id, sender, etc.)
  friend_count INTEGER DEFAULT 0,
  daily_photo_count INTEGER DEFAULT 0,
  last_photo_date DATE,
  fcm_token TEXT,
  push_token TEXT,                                -- Expo push token
  profile_setup_completed BOOLEAN DEFAULT FALSE,
  read_receipts_enabled BOOLEAN DEFAULT TRUE,
  deletion_scheduled_at TIMESTAMPTZ,
  deletion_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_deletion ON users(deletion_scheduled_at) WHERE deletion_scheduled_at IS NOT NULL;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Auto-update updated_at timestamp (reusable trigger function)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
