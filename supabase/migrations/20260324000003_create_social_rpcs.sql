-- Migration: Create social RPC functions
-- Phase 16, Plan 01: Core services infrastructure
-- Contact sync phone lookup and monthly photo grouping

-- ============================================================================
-- Contact sync RPC
-- Finds users matching given phone numbers, excluding:
--   - The requesting user themselves
--   - Users who haven't completed profile setup
--   - Existing friends or pending requests
--   - Blocked users (in either direction)
-- ============================================================================
CREATE OR REPLACE FUNCTION find_contacts_on_app(
  phone_numbers TEXT[],
  requesting_user_id UUID
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  profile_photo_path TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.username, u.display_name, u.profile_photo_path
  FROM users u
  WHERE u.phone = ANY(phone_numbers)
    AND u.id != requesting_user_id
    AND u.profile_setup_completed = true
    AND NOT EXISTS (
      SELECT 1 FROM friendships f
      WHERE (f.user1_id = requesting_user_id AND f.user2_id = u.id)
         OR (f.user1_id = u.id AND f.user2_id = requesting_user_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM blocks b
      WHERE (b.blocker_id = requesting_user_id AND b.blocked_id = u.id)
         OR (b.blocker_id = u.id AND b.blocked_id = requesting_user_id)
    );
$$;

-- ============================================================================
-- Monthly photos RPC
-- Groups a user's revealed photos by month for the monthly album view
-- Returns month_key (YYYY-MM), count, and JSONB array of photo metadata
-- ============================================================================
CREATE OR REPLACE FUNCTION get_monthly_photos(target_user_id UUID)
RETURNS TABLE (
  month_key TEXT,
  photo_count BIGINT,
  photos JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    to_char(created_at, 'YYYY-MM') AS month_key,
    COUNT(*) AS photo_count,
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'image_url', image_url,
        'created_at', created_at,
        'photo_state', photo_state
      ) ORDER BY created_at DESC
    ) AS photos
  FROM photos
  WHERE user_id = target_user_id
    AND status = 'revealed'
    AND photo_state IN ('journal', 'archive')
    AND deleted_at IS NULL
  GROUP BY to_char(created_at, 'YYYY-MM')
  ORDER BY month_key DESC;
$$;
