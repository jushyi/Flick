-- =============================================================================
-- get_feed: Single RPC call that JOINs photos + users + friendships with
-- block filtering and cursor-based pagination.
-- Replaces chunked Firestore `in` queries (30-ID limit).
-- =============================================================================

CREATE OR REPLACE FUNCTION get_feed(
  p_user_id UUID,
  p_cursor TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  image_url TEXT,
  thumbnail_data_url TEXT,
  status TEXT,
  photo_state TEXT,
  media_type TEXT,
  caption TEXT,
  storage_path TEXT,
  comment_count INTEGER,
  reaction_count INTEGER,
  created_at TIMESTAMPTZ,
  username TEXT,
  display_name TEXT,
  profile_photo_path TEXT,
  name_color TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.id,
    p.user_id,
    p.image_url,
    p.thumbnail_data_url,
    p.status,
    p.photo_state,
    p.media_type,
    p.caption,
    p.storage_path,
    p.comment_count,
    p.reaction_count,
    p.created_at,
    u.username,
    u.display_name,
    u.profile_photo_path,
    u.name_color
  FROM photos p
  INNER JOIN users u ON u.id = p.user_id
  INNER JOIN friendships f ON (
    (f.user1_id = p_user_id AND f.user2_id = p.user_id)
    OR (f.user2_id = p_user_id AND f.user1_id = p.user_id)
  )
  WHERE f.status = 'accepted'
    AND p.status = 'revealed'
    AND p.photo_state = 'journal'
    AND p.deleted_at IS NULL
    AND p.image_url IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM blocks b
      WHERE (b.blocker_id = p_user_id AND b.blocked_id = p.user_id)
         OR (b.blocker_id = p.user_id AND b.blocked_id = p_user_id)
    )
    AND (p_cursor IS NULL OR p.created_at < p_cursor)
  ORDER BY p.created_at DESC
  LIMIT p_limit;
$$;

-- =============================================================================
-- increment_daily_photo_count: Atomically increments the daily photo counter,
-- resetting on new day. Enforces 36-photo daily limit.
-- =============================================================================

CREATE OR REPLACE FUNCTION increment_daily_photo_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE users
  SET
    daily_photo_count = CASE
      WHEN last_photo_date = CURRENT_DATE THEN daily_photo_count + 1
      ELSE 1
    END,
    last_photo_date = CURRENT_DATE
  WHERE id = p_user_id
    AND (last_photo_date != CURRENT_DATE OR daily_photo_count < 36)
  RETURNING daily_photo_count INTO new_count;

  IF new_count IS NULL THEN
    -- Either user not found or daily limit reached
    SELECT daily_photo_count INTO new_count FROM users WHERE id = p_user_id;
    IF new_count IS NULL THEN
      RAISE EXCEPTION 'User not found: %', p_user_id;
    END IF;
  END IF;

  RETURN new_count;
END;
$$;
