-- Migration: Phase 18 triggers and cascades
-- Plan 03: Photo soft-delete cascade, friend count maintenance, new message notifications,
--          account deletion cascade, snap cleanup cron
-- Replaces: Firebase Cloud Functions onPhotoSoftDeleted, cleanupExpiredSnaps,
--           processScheduledDeletions, incrementFriendCountOnAccept, decrementFriendCountOnRemove

-- =============================================================================
-- 1. Photo soft-delete cascade trigger (JOBS-09)
-- When a photo is soft-deleted (deleted_at set), cascade cleanup to related tables.
-- The photo row itself is kept for potential recovery; related data is removed.
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_photo_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when deleted_at transitions from NULL to non-NULL
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    -- Remove from albums
    DELETE FROM album_photos WHERE photo_id = NEW.id;
    -- Clean up reactions
    DELETE FROM photo_reactions WHERE photo_id = NEW.id;
    -- Clean up tags
    DELETE FROM photo_tags WHERE photo_id = NEW.id;
    -- Clean up notifications referencing this photo
    DELETE FROM notifications WHERE (data->>'photoId')::uuid = NEW.id;
    -- Clean up pending notifications referencing this photo
    DELETE FROM pending_notifications WHERE photo_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER photo_soft_delete_cascade
  AFTER UPDATE OF deleted_at ON photos
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION handle_photo_soft_delete();


-- =============================================================================
-- 2. Friend count maintenance triggers (JOBS-08)
-- Uses CREATE OR REPLACE for idempotency -- safe whether Phase 16 ran or not.
-- Maintains users.friend_count on friendship accept/remove.
-- =============================================================================

-- Increment friend_count for both users when friendship is accepted
CREATE OR REPLACE FUNCTION increment_friend_count_on_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD IS NULL OR OLD.status != 'accepted') THEN
    UPDATE users SET friend_count = COALESCE(friend_count, 0) + 1 WHERE id = NEW.user1_id;
    UPDATE users SET friend_count = COALESCE(friend_count, 0) + 1 WHERE id = NEW.user2_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Decrement friend_count when an accepted friendship is removed
CREATE OR REPLACE FUNCTION decrement_friend_count_on_remove()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'accepted' THEN
    UPDATE users SET friend_count = GREATEST(COALESCE(friend_count, 0) - 1, 0) WHERE id = OLD.user1_id;
    UPDATE users SET friend_count = GREATEST(COALESCE(friend_count, 0) - 1, 0) WHERE id = OLD.user2_id;
  END IF;
  RETURN OLD;
END;
$$;

-- Use DROP TRIGGER IF EXISTS + CREATE TRIGGER to be idempotent
DROP TRIGGER IF EXISTS friendship_accepted_count ON friendships;
CREATE TRIGGER friendship_accepted_count
  AFTER INSERT OR UPDATE OF status ON friendships
  FOR EACH ROW
  EXECUTE FUNCTION increment_friend_count_on_accept();

DROP TRIGGER IF EXISTS friendship_removed_count ON friendships;
CREATE TRIGGER friendship_removed_count
  AFTER DELETE ON friendships
  FOR EACH ROW
  EXECUTE FUNCTION decrement_friend_count_on_remove();


-- =============================================================================
-- 3. New message push notification trigger (JOBS-06)
-- Fires on INSERT into messages and sends a push notification to the
-- conversation partner via the send-push-notification Edge Function.
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id UUID;
  conv RECORD;
BEGIN
  -- Look up conversation to find the other participant
  SELECT participant1_id, participant2_id INTO conv
  FROM conversations WHERE id = NEW.conversation_id;

  -- Determine recipient (the user who did NOT send the message)
  IF conv.participant1_id = NEW.sender_id THEN
    recipient_id := conv.participant2_id;
  ELSE
    recipient_id := conv.participant1_id;
  END IF;

  -- Send push notification via Edge Function
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'type', 'new_message',
      'user_id', recipient_id,
      'data', jsonb_build_object(
        'source_user_id', NEW.sender_id,
        'type', COALESCE(NEW.type, 'text'),
        'messageText', COALESCE(NEW.text, ''),
        'conversationId', NEW.conversation_id
      )
    ),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_notify_new ON messages;
CREATE TRIGGER messages_notify_new
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();


-- =============================================================================
-- 4. Account deletion cascade function (JOBS-05)
-- Two-step process:
--   Step 1 (SQL): Delete all user data from every table
--   Step 2 (pg_net): Call cleanup-storage Edge Function for storage + auth deletion
-- Runs daily at 3 AM UTC via pg_cron.
-- =============================================================================

CREATE OR REPLACE FUNCTION process_scheduled_deletions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user RECORD;
  storage_paths TEXT[];
  profile_path TEXT;
BEGIN
  -- Process users whose deletion grace period has expired (batch of 10)
  FOR target_user IN
    SELECT id, profile_photo_path
    FROM users
    WHERE deletion_scheduled_at IS NOT NULL
      AND deletion_scheduled_at <= NOW()
    LIMIT 10
  LOOP
    -- Collect storage paths for cleanup (photo URLs/paths)
    SELECT ARRAY_AGG(DISTINCT storage_path)
    INTO storage_paths
    FROM photos
    WHERE user_id = target_user.id
      AND storage_path IS NOT NULL;

    -- Add profile photo path if present
    profile_path := target_user.profile_photo_path;
    IF profile_path IS NOT NULL THEN
      IF storage_paths IS NULL THEN
        storage_paths := ARRAY[profile_path];
      ELSE
        storage_paths := storage_paths || profile_path;
      END IF;
    END IF;

    -- Step 1: Delete all user data from every table (order matters for FKs)
    -- Messages first (child of conversations)
    DELETE FROM messages
    WHERE conversation_id IN (
      SELECT id FROM conversations
      WHERE participant1_id = target_user.id OR participant2_id = target_user.id
    );

    -- Conversations
    DELETE FROM conversations
    WHERE participant1_id = target_user.id OR participant2_id = target_user.id;

    -- Photos (hard delete, not soft delete)
    DELETE FROM photos WHERE user_id = target_user.id;

    -- Social
    DELETE FROM friendships WHERE user1_id = target_user.id OR user2_id = target_user.id;
    DELETE FROM comments WHERE user_id = target_user.id;
    DELETE FROM albums WHERE user_id = target_user.id;
    DELETE FROM blocks WHERE blocker_id = target_user.id OR blocked_id = target_user.id;
    DELETE FROM reports WHERE reporter_id = target_user.id;
    DELETE FROM streaks WHERE user1_id = target_user.id OR user2_id = target_user.id;

    -- Notifications and push infrastructure
    DELETE FROM notifications WHERE user_id = target_user.id;
    DELETE FROM pending_notifications WHERE target_user_id = target_user.id OR source_user_id = target_user.id;
    DELETE FROM push_receipts WHERE user_id = target_user.id;

    -- Step 2: Call cleanup-storage Edge Function for storage files + auth deletion
    IF storage_paths IS NOT NULL AND array_length(storage_paths, 1) > 0 THEN
      PERFORM net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/cleanup-storage',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := jsonb_build_object(
          'type', 'user_deletion',
          'user_id', target_user.id,
          'paths', to_jsonb(storage_paths)
        ),
        timeout_milliseconds := 30000
      );
    ELSE
      -- No storage files, but still need to delete auth user
      PERFORM net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/cleanup-storage',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := jsonb_build_object(
          'type', 'user_deletion',
          'user_id', target_user.id,
          'paths', '[]'::jsonb
        ),
        timeout_milliseconds := 30000
      );
    END IF;

    -- Finally: delete the user row
    DELETE FROM users WHERE id = target_user.id;
  END LOOP;
END;
$$;


-- =============================================================================
-- 5. Snap cleanup cron function (JOBS-03)
-- Finds expired snap messages (viewed > 24 hours ago) and calls the
-- cleanup-storage Edge Function to delete files from Supabase Storage.
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_snaps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_paths TEXT[];
BEGIN
  -- Find snap messages older than 24 hours that have been viewed and still have storage paths
  SELECT ARRAY_AGG(DISTINCT snap_storage_path)
  INTO expired_paths
  FROM messages
  WHERE type = 'snap'
    AND snap_storage_path IS NOT NULL
    AND snap_viewed_at IS NOT NULL
    AND snap_viewed_at < NOW() - INTERVAL '24 hours';

  IF expired_paths IS NOT NULL AND array_length(expired_paths, 1) > 0 THEN
    -- Call cleanup-storage Edge Function to delete files
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/cleanup-storage',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'type', 'expired_snaps',
        'paths', to_jsonb(expired_paths)
      ),
      timeout_milliseconds := 10000
    );

    -- Clear the snap_storage_path so we don't try to clean up again
    UPDATE messages
    SET snap_storage_path = NULL
    WHERE type = 'snap'
      AND snap_storage_path IS NOT NULL
      AND snap_viewed_at IS NOT NULL
      AND snap_viewed_at < NOW() - INTERVAL '24 hours';
  END IF;
END;
$$;


-- =============================================================================
-- 6. Cron schedules
-- =============================================================================

-- Account deletion: daily at 3 AM UTC
SELECT cron.schedule('process-scheduled-deletions', '0 3 * * *', 'SELECT process_scheduled_deletions()');

-- Snap cleanup: every 2 hours
SELECT cron.schedule('cleanup-expired-snaps', '0 */2 * * *', 'SELECT cleanup_expired_snaps()');
