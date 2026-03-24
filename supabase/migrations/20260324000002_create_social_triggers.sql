-- Migration: Create social triggers for count maintenance and block cleanup
-- Phase 16, Plan 01: Core services infrastructure
-- Automates friend_count, comment_count, comment_like_count, and blocked user content cleanup

-- ============================================================================
-- Friend count trigger
-- Increments/decrements users.friend_count when friendships are accepted/deleted
-- ============================================================================
CREATE OR REPLACE FUNCTION update_friend_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'accepted' THEN
    UPDATE users SET friend_count = friend_count + 1 WHERE id = NEW.user1_id;
    UPDATE users SET friend_count = friend_count + 1 WHERE id = NEW.user2_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    UPDATE users SET friend_count = friend_count + 1 WHERE id = NEW.user1_id;
    UPDATE users SET friend_count = friend_count + 1 WHERE id = NEW.user2_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'accepted' THEN
    UPDATE users SET friend_count = GREATEST(friend_count - 1, 0) WHERE id = OLD.user1_id;
    UPDATE users SET friend_count = GREATEST(friend_count - 1, 0) WHERE id = OLD.user2_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER friendships_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON friendships
  FOR EACH ROW EXECUTE FUNCTION update_friend_count();

-- ============================================================================
-- Comment count trigger
-- Increments/decrements photos.comment_count on comment INSERT/DELETE
-- ============================================================================
CREATE OR REPLACE FUNCTION update_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE photos SET comment_count = comment_count + 1 WHERE id = NEW.photo_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE photos SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.photo_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER comments_count_trigger
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_comment_count();

-- ============================================================================
-- Comment like count trigger
-- Increments/decrements comments.like_count on comment_likes INSERT/DELETE
-- ============================================================================
CREATE OR REPLACE FUNCTION update_comment_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.comment_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER comment_likes_count_trigger
  AFTER INSERT OR DELETE ON comment_likes
  FOR EACH ROW EXECUTE FUNCTION update_comment_like_count();

-- ============================================================================
-- Block cleanup trigger
-- On block INSERT: removes blocked user's comments, reactions, comment likes
-- on blocker's photos, and deletes any friendship between them
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_blocked_user_content()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM comments
  WHERE user_id = NEW.blocked_id
    AND photo_id IN (SELECT id FROM photos WHERE user_id = NEW.blocker_id);

  DELETE FROM photo_reactions
  WHERE user_id = NEW.blocked_id
    AND photo_id IN (SELECT id FROM photos WHERE user_id = NEW.blocker_id);

  DELETE FROM comment_likes
  WHERE user_id = NEW.blocked_id
    AND comment_id IN (
      SELECT c.id FROM comments c
      JOIN photos p ON p.id = c.photo_id
      WHERE p.user_id = NEW.blocker_id
    );

  DELETE FROM friendships
  WHERE (user1_id = NEW.blocker_id AND user2_id = NEW.blocked_id)
     OR (user1_id = NEW.blocked_id AND user2_id = NEW.blocker_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER blocks_cleanup_trigger
  AFTER INSERT ON blocks
  FOR EACH ROW EXECUTE FUNCTION cleanup_blocked_user_content();
