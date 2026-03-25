-- Migration: Phase 18 schema additions
-- Background Jobs & Notifications infrastructure
-- Adds tables and columns needed by Edge Functions and pg_cron jobs

-- ============================================================================
-- 1. Enable required extensions (idempotent)
-- ============================================================================

-- pg_net: HTTP requests from PostgreSQL (used by triggers to call Edge Functions)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- pg_cron: Scheduled jobs within PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- ============================================================================
-- 2. Add push_to_start_token column to users table
--    Stores APNs push-to-start token for Live Activities
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS push_to_start_token TEXT;

-- ============================================================================
-- 3. Add notification_preferences column to users table
--    JSONB object: { enabled: bool, likes: bool, comments: bool, ... }
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}'::jsonb;

-- ============================================================================
-- 4. Create pending_notifications table (reaction/tag batching - JOBS-07)
--    Accumulates notifications that should be batched before sending
--    e.g. multiple reactions within 30 seconds get merged into one push
-- ============================================================================

CREATE TABLE pending_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  source_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pending_notifications_target ON pending_notifications(target_user_id, type);
CREATE INDEX idx_pending_notifications_created ON pending_notifications(created_at);

ALTER TABLE pending_notifications ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write pending notifications (server-side only)
CREATE POLICY "pending_notifications_service_only" ON pending_notifications
  FOR ALL USING (false);

-- ============================================================================
-- 5. Create push_receipts table (Expo receipt tracking)
--    Stores ticket IDs from Expo Push API for later receipt checking
--    Allows detecting invalid tokens and delivery failures
-- ============================================================================

CREATE TABLE push_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  push_token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_push_receipts_created ON push_receipts(created_at);

ALTER TABLE push_receipts ENABLE ROW LEVEL SECURITY;

-- Only service_role can access push receipts
CREATE POLICY "push_receipts_service_only" ON push_receipts
  FOR ALL USING (false);
