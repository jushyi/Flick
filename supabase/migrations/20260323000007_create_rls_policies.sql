-- Migration: Create RLS policies for all 18 tables
-- Phase 12, Plan 03: Row Level Security enforcement
-- Every friendship-based policy includes AND NOT is_blocked() for block isolation

-- ============================================
-- USERS
-- ============================================

-- Users: read own profile always
CREATE POLICY "users_select_own" ON users FOR SELECT
  USING (id = auth.uid());

-- Users: read other profiles if not blocked
CREATE POLICY "users_select_others" ON users FOR SELECT
  USING (id != auth.uid() AND NOT is_blocked(id));

-- Users: update own profile only
CREATE POLICY "users_update_own" ON users FOR UPDATE
  USING (id = auth.uid());

-- No INSERT policy (users created by auth trigger)
-- No DELETE policy (account deletion via Edge Function with service_role)

-- ============================================
-- PHOTOS
-- ============================================

-- Photos: owner sees all own photos
CREATE POLICY "photos_select_own" ON photos FOR SELECT
  USING (user_id = auth.uid());

-- Photos: friends see revealed+journal only, blocked users excluded
CREATE POLICY "photos_select_friends" ON photos FOR SELECT
  USING (
    user_id != auth.uid()
    AND status = 'revealed'
    AND photo_state = 'journal'
    AND deleted_at IS NULL
    AND is_friend(user_id)
    AND NOT is_blocked(user_id)
  );

-- Photos: insert own photos only
CREATE POLICY "photos_insert" ON photos FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Photos: update own photos only
CREATE POLICY "photos_update_own" ON photos FOR UPDATE
  USING (user_id = auth.uid());

-- Photos: delete own photos only
CREATE POLICY "photos_delete_own" ON photos FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- PHOTO REACTIONS
-- ============================================

-- Reactions: see reactions on own photos or visible friend photos
CREATE POLICY "photo_reactions_select" ON photo_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM photos p
      WHERE p.id = photo_reactions.photo_id
      AND (
        p.user_id = auth.uid()
        OR (p.photo_state = 'journal' AND is_friend(p.user_id) AND NOT is_blocked(p.user_id))
      )
    )
  );

-- Reactions: create own reactions
CREATE POLICY "photo_reactions_insert" ON photo_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Reactions: delete own reactions
CREATE POLICY "photo_reactions_delete" ON photo_reactions FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- PHOTO TAGS
-- ============================================

-- Tags: see tags on own photos or visible friend photos
CREATE POLICY "photo_tags_select" ON photo_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM photos p
      WHERE p.id = photo_tags.photo_id
      AND (
        p.user_id = auth.uid()
        OR (p.photo_state = 'journal' AND is_friend(p.user_id) AND NOT is_blocked(p.user_id))
      )
    )
  );

-- Tags: photo owner can add tags
CREATE POLICY "photo_tags_insert" ON photo_tags FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM photos WHERE id = photo_tags.photo_id AND user_id = auth.uid())
  );

-- Tags: photo owner can remove tags
CREATE POLICY "photo_tags_delete" ON photo_tags FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM photos WHERE id = photo_tags.photo_id AND user_id = auth.uid())
  );

-- ============================================
-- VIEWED PHOTOS
-- ============================================

-- Viewed photos: read own viewed records
CREATE POLICY "viewed_photos_select_own" ON viewed_photos FOR SELECT
  USING (user_id = auth.uid());

-- Viewed photos: insert own viewed records
CREATE POLICY "viewed_photos_insert" ON viewed_photos FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- FRIENDSHIPS
-- ============================================

-- Friendships: see own friendships
CREATE POLICY "friendships_select" ON friendships FOR SELECT
  USING (user1_id = auth.uid() OR user2_id = auth.uid());

-- Friendships: create where you are the initiator and a participant
CREATE POLICY "friendships_insert" ON friendships FOR INSERT
  WITH CHECK (
    initiated_by = auth.uid()
    AND (user1_id = auth.uid() OR user2_id = auth.uid())
  );

-- Friendships: update where you are a participant
CREATE POLICY "friendships_update" ON friendships FOR UPDATE
  USING (user1_id = auth.uid() OR user2_id = auth.uid());

-- Friendships: delete where you are a participant
CREATE POLICY "friendships_delete" ON friendships FOR DELETE
  USING (user1_id = auth.uid() OR user2_id = auth.uid());

-- ============================================
-- BLOCKS
-- ============================================

-- Blocks: only blocker can see their blocks
CREATE POLICY "blocks_select" ON blocks FOR SELECT
  USING (blocker_id = auth.uid());

-- Blocks: only blocker can create blocks
CREATE POLICY "blocks_insert" ON blocks FOR INSERT
  WITH CHECK (blocker_id = auth.uid());

-- Blocks: only blocker can remove blocks
CREATE POLICY "blocks_delete" ON blocks FOR DELETE
  USING (blocker_id = auth.uid());

-- ============================================
-- REPORTS
-- ============================================

-- Reports: users can submit reports
CREATE POLICY "reports_insert" ON reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

-- No SELECT policy for regular users (admin only via service_role)

-- ============================================
-- CONVERSATIONS
-- ============================================

-- Conversations: participants only can view
CREATE POLICY "conversations_select" ON conversations FOR SELECT
  USING (participant1_id = auth.uid() OR participant2_id = auth.uid());

-- Conversations: participants can create
CREATE POLICY "conversations_insert" ON conversations FOR INSERT
  WITH CHECK (participant1_id = auth.uid() OR participant2_id = auth.uid());

-- Conversations: participants can update (mark read, soft delete)
CREATE POLICY "conversations_update" ON conversations FOR UPDATE
  USING (participant1_id = auth.uid() OR participant2_id = auth.uid());

-- ============================================
-- MESSAGES
-- ============================================

-- Messages: only conversation participants can see messages
CREATE POLICY "messages_select" ON messages FOR SELECT
  USING (is_conversation_participant(conversation_id));

-- Messages: sender must be authenticated and a participant
CREATE POLICY "messages_insert" ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND is_conversation_participant(conversation_id)
  );

-- Messages: sender can update own messages (unsend)
CREATE POLICY "messages_update" ON messages FOR UPDATE
  USING (sender_id = auth.uid());

-- ============================================
-- STREAKS
-- ============================================

-- Streaks: participants can view their streaks
CREATE POLICY "streaks_select" ON streaks FOR SELECT
  USING (user1_id = auth.uid() OR user2_id = auth.uid());

-- INSERT/UPDATE/DELETE handled by Edge Functions (service_role)

-- ============================================
-- COMMENTS
-- ============================================

-- Comments: see comments on own photos or visible friend photos
CREATE POLICY "comments_select" ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM photos p
      WHERE p.id = comments.photo_id
      AND (
        p.user_id = auth.uid()
        OR (p.photo_state = 'journal' AND is_friend(p.user_id) AND NOT is_blocked(p.user_id))
      )
    )
  );

-- Comments: post comments on own photos or visible friend photos
CREATE POLICY "comments_insert" ON comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM photos p
      WHERE p.id = comments.photo_id
      AND (
        p.user_id = auth.uid()
        OR (p.photo_state = 'journal' AND is_friend(p.user_id) AND NOT is_blocked(p.user_id))
      )
    )
  );

-- Comments: delete own comments
CREATE POLICY "comments_delete" ON comments FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- COMMENT LIKES
-- ============================================

-- Comment likes: see likes on comments of visible photos
CREATE POLICY "comment_likes_select" ON comment_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM comments c
      JOIN photos p ON p.id = c.photo_id
      WHERE c.id = comment_likes.comment_id
      AND (
        p.user_id = auth.uid()
        OR (p.photo_state = 'journal' AND is_friend(p.user_id) AND NOT is_blocked(p.user_id))
      )
    )
  );

-- Comment likes: create own likes
CREATE POLICY "comment_likes_insert" ON comment_likes FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Comment likes: delete own likes
CREATE POLICY "comment_likes_delete" ON comment_likes FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- ALBUMS
-- ============================================

-- Albums: see own albums
CREATE POLICY "albums_select_own" ON albums FOR SELECT
  USING (user_id = auth.uid());

-- Albums: see friend albums (blocked users excluded)
CREATE POLICY "albums_select_friends" ON albums FOR SELECT
  USING (is_friend(user_id) AND NOT is_blocked(user_id));

-- Albums: create own albums
CREATE POLICY "albums_insert" ON albums FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Albums: update own albums
CREATE POLICY "albums_update" ON albums FOR UPDATE
  USING (user_id = auth.uid());

-- Albums: delete own albums
CREATE POLICY "albums_delete" ON albums FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- ALBUM PHOTOS
-- ============================================

-- Album photos: see photos in own or friend albums
CREATE POLICY "album_photos_select" ON album_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM albums
      WHERE id = album_photos.album_id
      AND (user_id = auth.uid() OR (is_friend(user_id) AND NOT is_blocked(user_id)))
    )
  );

-- Album photos: add photos to own albums
CREATE POLICY "album_photos_insert" ON album_photos FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM albums WHERE id = album_photos.album_id AND user_id = auth.uid())
  );

-- Album photos: remove photos from own albums
CREATE POLICY "album_photos_delete" ON album_photos FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM albums WHERE id = album_photos.album_id AND user_id = auth.uid())
  );

-- ============================================
-- NOTIFICATIONS
-- ============================================

-- Notifications: see own notifications
CREATE POLICY "notifications_select" ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Notifications: update own notifications (mark read)
CREATE POLICY "notifications_update" ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- INSERT/DELETE by Edge Functions (service_role)

-- ============================================
-- REACTION BATCHES
-- ============================================

-- Reaction batches: see batches for own photos or own reactions
CREATE POLICY "reaction_batches_select" ON reaction_batches FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM photos WHERE id = reaction_batches.photo_id AND user_id = auth.uid())
    OR reactor_id = auth.uid()
  );

-- ============================================
-- SUPPORT REQUESTS
-- ============================================

-- Support requests: submit own requests
CREATE POLICY "support_requests_insert" ON support_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Support requests: see own requests
CREATE POLICY "support_requests_select" ON support_requests FOR SELECT
  USING (user_id = auth.uid());
