-- Migration: Create pg_cron scheduled functions
-- Phase 18, Plan 02: Background jobs replacing Firebase Cloud Functions
-- Replaces: processDarkroomReveals, processStreakExpiry, cleanupOldNotifications,
--           expirePinnedSnapNotifications, sendDeletionReminders

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- 1. process_darkroom_reveals()
-- Replaces Firebase Cloud Function: processDarkroomReveals
-- Schedule: Every 2 minutes
-- Purpose: Reveal developing photos whose reveal_at time has passed,
--          then notify each affected user via push notification.
-- ============================================================================

CREATE OR REPLACE FUNCTION process_darkroom_reveals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user RECORD;
BEGIN
  -- Phase 1: Batch-reveal photos that are ready (limited to 500 per run)
  UPDATE photos
  SET status = 'revealed',
      updated_at = NOW()
  WHERE id IN (
    SELECT id FROM photos
    WHERE status = 'developing'
      AND reveal_at <= NOW()
      AND deleted_at IS NULL
    LIMIT 500
  );

  -- If no rows updated, exit early
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Phase 2: Notify each user whose photos were just revealed
  FOR _user IN
    SELECT user_id, COUNT(*) AS photo_count
    FROM photos
    WHERE status = 'revealed'
      AND updated_at >= NOW() - INTERVAL '3 minutes'
      AND deleted_at IS NULL
    GROUP BY user_id
  LOOP
    PERFORM net.http_post(
      url := current_setting('app.settings.edge_function_url') || '/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'type', 'photo_reveal',
        'user_id', _user.user_id,
        'data', jsonb_build_object('count', _user.photo_count)
      ),
      timeout_milliseconds := 5000
    );
  END LOOP;
END;
$$;

-- ============================================================================
-- 2. process_streak_expiry()
-- Replaces Firebase Cloud Function: processStreakExpiry
-- Schedule: Every 15 minutes
-- Purpose: Phase 1 - Send 4-hour warning push to both users in at-risk streaks.
--          Phase 2 - Reset streaks that have expired.
-- ============================================================================

CREATE OR REPLACE FUNCTION process_streak_expiry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _streak RECORD;
BEGIN
  -- Phase 1: Send warnings for streaks expiring within 4 hours
  FOR _streak IN
    SELECT
      s.id AS streak_id,
      s.user1_id,
      s.user2_id,
      s.day_count,
      u1.display_name AS user1_name,
      u2.display_name AS user2_name
    FROM streaks s
    JOIN users u1 ON u1.id = s.user1_id
    JOIN users u2 ON u2.id = s.user2_id
    WHERE s.expires_at <= NOW() + INTERVAL '4 hours'
      AND s.expires_at > NOW()
      AND s.warning_sent = FALSE
      AND s.day_count > 0
    LIMIT 200
  LOOP
    -- Mark warning as sent first to avoid duplicate sends
    UPDATE streaks
    SET warning_sent = TRUE
    WHERE id = _streak.streak_id;

    -- Notify user1 (partner is user2)
    PERFORM net.http_post(
      url := current_setting('app.settings.edge_function_url') || '/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'type', 'streak_warning',
        'user_id', _streak.user1_id,
        'data', jsonb_build_object(
          'other_name', _streak.user2_name,
          'day_count', _streak.day_count
        )
      ),
      timeout_milliseconds := 5000
    );

    -- Notify user2 (partner is user1)
    PERFORM net.http_post(
      url := current_setting('app.settings.edge_function_url') || '/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'type', 'streak_warning',
        'user_id', _streak.user2_id,
        'data', jsonb_build_object(
          'other_name', _streak.user1_name,
          'day_count', _streak.day_count
        )
      ),
      timeout_milliseconds := 5000
    );
  END LOOP;

  -- Phase 2: Expire streaks that have passed their deadline
  UPDATE streaks
  SET day_count = 0,
      last_mutual_at = NULL,
      expires_at = NULL,
      warning_sent = FALSE,
      last_snap_at_user1 = NULL,
      last_snap_at_user2 = NULL
  WHERE expires_at IS NOT NULL
    AND expires_at <= NOW()
    AND day_count > 0;
END;
$$;

-- Schedule the first two cron jobs
SELECT cron.schedule('process-darkroom-reveals', '*/2 * * * *', 'SELECT process_darkroom_reveals()');
SELECT cron.schedule('process-streak-expiry', '*/15 * * * *', 'SELECT process_streak_expiry()');
