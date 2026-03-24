-- Migration: PostgreSQL triggers for message lifecycle (Phase 17)
-- Three trigger functions: conversation metadata update, streak update on snap, snap cleanup chain

-- =============================================================================
-- 1. update_conversation_on_message()
--    AFTER INSERT on messages: updates conversation last_message_* fields and
--    increments the OTHER participant's unread count (reactions do NOT increment)
-- =============================================================================
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv RECORD;
  v_preview TEXT;
BEGIN
  -- Fetch conversation to determine participant positions
  SELECT participant1_id, participant2_id
    INTO v_conv
    FROM conversations
   WHERE id = NEW.conversation_id;

  -- Build last_message_text preview based on message type
  CASE NEW.type
    WHEN 'snap' THEN v_preview := 'Snap';
    WHEN 'reaction' THEN v_preview := 'Reacted';
    WHEN 'tagged_photo' THEN v_preview := 'Tagged you in a photo';
    WHEN 'reply' THEN v_preview := COALESCE(LEFT(NEW.text, 100), 'Reply');
    ELSE v_preview := COALESCE(LEFT(NEW.text, 100), '');
  END CASE;

  -- Update conversation metadata + increment OTHER participant's unread count
  -- Reactions do NOT increment unread count (matches Firebase behavior)
  IF NEW.sender_id = v_conv.participant1_id THEN
    UPDATE conversations
       SET last_message_text = v_preview,
           last_message_at = NEW.created_at,
           last_message_type = NEW.type,
           last_message_sender_id = NEW.sender_id,
           unread_count_p2 = CASE WHEN NEW.type = 'reaction' THEN unread_count_p2 ELSE unread_count_p2 + 1 END
     WHERE id = NEW.conversation_id;
  ELSE
    UPDATE conversations
       SET last_message_text = v_preview,
           last_message_at = NEW.created_at,
           last_message_type = NEW.type,
           last_message_sender_id = NEW.sender_id,
           unread_count_p1 = CASE WHEN NEW.type = 'reaction' THEN unread_count_p1 ELSE unread_count_p1 + 1 END
     WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();


-- =============================================================================
-- 2. update_streak_on_snap()
--    AFTER INSERT on messages WHERE type='snap': upserts streak record,
--    tracks per-user last snap time, detects mutual snapping, increments
--    day_count, and calculates tiered expiry windows
-- =============================================================================
CREATE OR REPLACE FUNCTION update_streak_on_snap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv RECORD;
  v_user1 UUID;
  v_user2 UUID;
  v_is_user1 BOOLEAN;
  v_streak RECORD;
  v_new_day_count INTEGER;
  v_new_expires_at TIMESTAMPTZ;
BEGIN
  -- Fetch conversation participants
  SELECT participant1_id, participant2_id
    INTO v_conv
    FROM conversations
   WHERE id = NEW.conversation_id;

  -- Ensure user1_id < user2_id (matches streaks table CHECK constraint)
  IF v_conv.participant1_id < v_conv.participant2_id THEN
    v_user1 := v_conv.participant1_id;
    v_user2 := v_conv.participant2_id;
  ELSE
    v_user1 := v_conv.participant2_id;
    v_user2 := v_conv.participant1_id;
  END IF;

  v_is_user1 := (NEW.sender_id = v_user1);

  -- Upsert streak record: create if not exists, update sender's last snap time
  INSERT INTO streaks (user1_id, user2_id, last_snap_at_user1, last_snap_at_user2, day_count)
  VALUES (
    v_user1,
    v_user2,
    CASE WHEN v_is_user1 THEN NOW() ELSE NULL END,
    CASE WHEN NOT v_is_user1 THEN NOW() ELSE NULL END,
    0
  )
  ON CONFLICT (user1_id, user2_id)
  DO UPDATE SET
    last_snap_at_user1 = CASE WHEN v_is_user1 THEN NOW() ELSE streaks.last_snap_at_user1 END,
    last_snap_at_user2 = CASE WHEN NOT v_is_user1 THEN NOW() ELSE streaks.last_snap_at_user2 END;

  -- Re-fetch the streak to check for mutual snapping
  SELECT * INTO v_streak
    FROM streaks
   WHERE user1_id = v_user1 AND user2_id = v_user2;

  -- Check mutual snapping: both users snapped within the last 24 hours
  IF v_streak.last_snap_at_user1 IS NOT NULL
     AND v_streak.last_snap_at_user2 IS NOT NULL
     AND v_streak.last_snap_at_user1 > NOW() - INTERVAL '24 hours'
     AND v_streak.last_snap_at_user2 > NOW() - INTERVAL '24 hours'
  THEN
    -- Mutual snap detected: increment day_count
    v_new_day_count := v_streak.day_count + 1;

    -- Calculate expires_at based on tiered windows
    CASE
      WHEN v_new_day_count < 3 THEN
        -- Not yet activated: no expiry
        v_new_expires_at := NULL;
      WHEN v_new_day_count < 10 THEN
        -- 48 hours from last_mutual_at
        v_new_expires_at := NOW() + INTERVAL '48 hours';
      WHEN v_new_day_count < 50 THEN
        -- 72 hours from last_mutual_at
        v_new_expires_at := NOW() + INTERVAL '72 hours';
      ELSE
        -- 96 hours from last_mutual_at
        v_new_expires_at := NOW() + INTERVAL '96 hours';
    END CASE;

    UPDATE streaks
       SET day_count = v_new_day_count,
           last_mutual_at = NOW(),
           expires_at = v_new_expires_at,
           warning_sent = FALSE
     WHERE user1_id = v_user1 AND user2_id = v_user2;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_streak_on_snap
  AFTER INSERT ON messages
  FOR EACH ROW
  WHEN (NEW.type = 'snap')
  EXECUTE FUNCTION update_streak_on_snap();


-- =============================================================================
-- 3. handle_snap_viewed()
--    AFTER UPDATE on messages: when snap_viewed_at changes from NULL to a value,
--    calls the snap-cleanup Edge Function via pg_net to delete the snap file
--    from Supabase Storage
-- =============================================================================
CREATE OR REPLACE FUNCTION handle_snap_viewed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only process snaps with a storage path
  IF NEW.type = 'snap' AND NEW.snap_storage_path IS NOT NULL THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/snap-cleanup',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('storage_path', NEW.snap_storage_path)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handle_snap_viewed
  AFTER UPDATE OF snap_viewed_at ON messages
  FOR EACH ROW
  WHEN (OLD.snap_viewed_at IS NULL AND NEW.snap_viewed_at IS NOT NULL)
  EXECUTE FUNCTION handle_snap_viewed();
