-- Migration: Create RLS helper functions
-- Phase 12, Plan 02: Security definer functions for RLS policies
-- These functions are used by RLS policies created in Plan 03

-- Check if current authenticated user is friends with target user
CREATE OR REPLACE FUNCTION is_friend(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
    AND (
      (user1_id = auth.uid() AND user2_id = target_user_id)
      OR (user1_id = target_user_id AND user2_id = auth.uid())
    )
  );
$$;

-- Check if either user has blocked the other
CREATE OR REPLACE FUNCTION is_blocked(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = target_user_id)
       OR (blocker_id = target_user_id AND blocked_id = auth.uid())
  );
$$;

-- Check if current user is a participant in a conversation
CREATE OR REPLACE FUNCTION is_conversation_participant(conv_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversations
    WHERE id = conv_id
    AND (participant1_id = auth.uid() OR participant2_id = auth.uid())
  );
$$;
