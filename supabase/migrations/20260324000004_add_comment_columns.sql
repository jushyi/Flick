-- Migration: Add missing columns to comments table
-- Phase 16, Plan 01: Feature parity with Firebase comment model
-- Adds: mentioned_comment_id (reply-to-reply targeting), media_url, media_type, like_count

ALTER TABLE comments ADD COLUMN IF NOT EXISTS mentioned_comment_id UUID REFERENCES comments(id) ON DELETE SET NULL;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS media_type TEXT;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;
