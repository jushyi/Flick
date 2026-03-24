/**
 * Comment Service (Supabase)
 *
 * Handles CRUD operations for comments on photos via Supabase.
 * Flat threading model: parent_id always points to top-level comment,
 * mentioned_comment_id tracks the specific comment being replied to.
 *
 * All functions throw on error (TanStack catches at hook level).
 */

import { supabase } from '@/lib/supabase';

import logger from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface Comment {
  id: string;
  photoId: string;
  userId: string;
  parentId: string | null;
  mentionedCommentId: string | null;
  text: string;
  mentions: string[];
  mediaUrl: string | null;
  mediaType: string | null;
  likeCount: number;
  createdAt: string;
  user?: {
    username: string;
    displayName: string;
    profilePhotoPath: string | null;
  };
}

export interface AddCommentParams {
  photoId: string;
  userId: string;
  text: string;
  parentId?: string | null;
  mentionedCommentId?: string | null;
  mentions?: string[];
  mediaUrl?: string | null;
  mediaType?: string | null;
}

// ============================================================================
// Constants
// ============================================================================

export const MAX_COMMENT_LENGTH = 2000;
export const MAX_MENTIONS_PER_COMMENT = 10;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map a snake_case DB row to a camelCase Comment object.
 */
function mapComment(row: any): Comment {
  return {
    id: row.id,
    photoId: row.photo_id,
    userId: row.user_id,
    parentId: row.parent_id ?? null,
    mentionedCommentId: row.mentioned_comment_id ?? null,
    text: row.text,
    mentions: row.mentions ?? [],
    mediaUrl: row.media_url ?? null,
    mediaType: row.media_type ?? null,
    likeCount: row.like_count ?? 0,
    createdAt: row.created_at,
    user: row.user
      ? {
          username: row.user.username,
          displayName: row.user.display_name,
          profilePhotoPath: row.user.profile_photo_path ?? null,
        }
      : undefined,
  };
}

// ============================================================================
// CRUD Functions
// ============================================================================

/**
 * Fetch comments for a photo, ordered by created_at ascending.
 * Joins user profile data for display.
 */
export async function getComments(photoId: string): Promise<Comment[]> {
  logger.debug('commentService.getComments: Starting', { photoId });

  const { data, error } = await supabase
    .from('comments')
    .select('*, user:users(username, display_name, profile_photo_path)')
    .eq('photo_id', photoId)
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('commentService.getComments: Failed', { photoId, error: error.message });
    throw error;
  }

  const comments = (data ?? []).map(mapComment);
  logger.info('commentService.getComments: Success', { photoId, count: comments.length });
  return comments;
}

/**
 * Add a comment to a photo.
 * Flat threading: if replying to a comment that already has a parent_id,
 * use that comment's parent_id (flatten) and set mentioned_comment_id to the original target.
 */
export async function addComment(params: AddCommentParams): Promise<Comment> {
  const {
    photoId,
    userId,
    text,
    parentId = null,
    mentionedCommentId = null,
    mentions = [],
    mediaUrl = null,
    mediaType = null,
  } = params;

  logger.debug('commentService.addComment: Starting', {
    photoId,
    userId,
    textLength: text?.length,
    isReply: !!parentId,
  });

  // Validation
  if (text && text.length > MAX_COMMENT_LENGTH) {
    throw new Error('Comment text exceeds maximum length');
  }

  if (mentions.length > MAX_MENTIONS_PER_COMMENT) {
    throw new Error('Too many mentions');
  }

  // Resolve flat threading
  let resolvedParentId = parentId;
  let resolvedMentionedCommentId = mentionedCommentId;

  if (parentId) {
    // Look up the target comment to check if it has a parent_id
    const { data: targetComment, error: targetError } = await supabase
      .from('comments')
      .select('id, parent_id')
      .eq('id', parentId)
      .single();

    if (targetError) {
      logger.error('commentService.addComment: Failed to fetch target comment', {
        parentId,
        error: targetError.message,
      });
      throw targetError;
    }

    if (targetComment?.parent_id) {
      // Reply-to-reply: flatten to the original top-level parent
      resolvedParentId = targetComment.parent_id;
      resolvedMentionedCommentId = mentionedCommentId || parentId;
    } else {
      // Reply to top-level comment
      resolvedParentId = parentId;
      resolvedMentionedCommentId = mentionedCommentId || parentId;
    }
  }

  // Insert the comment
  const { data, error } = await supabase
    .from('comments')
    .insert({
      photo_id: photoId,
      user_id: userId,
      text,
      parent_id: resolvedParentId,
      mentioned_comment_id: resolvedMentionedCommentId,
      mentions,
      media_url: mediaUrl,
      media_type: mediaType,
    })
    .select('*, user:users(username, display_name, profile_photo_path)')
    .single();

  if (error) {
    logger.error('commentService.addComment: Failed', { photoId, error: error.message });
    throw error;
  }

  const comment = mapComment(data);
  logger.info('commentService.addComment: Success', { photoId, commentId: comment.id });
  return comment;
}

/**
 * Delete a comment by ID.
 */
export async function deleteComment(commentId: string): Promise<void> {
  logger.debug('commentService.deleteComment: Starting', { commentId });

  const { error } = await supabase.from('comments').delete().eq('id', commentId);

  if (error) {
    logger.error('commentService.deleteComment: Failed', { commentId, error: error.message });
    throw error;
  }

  logger.info('commentService.deleteComment: Success', { commentId });
}

/**
 * Like a comment. Inserts into comment_likes table.
 */
export async function likeComment(commentId: string, userId: string): Promise<void> {
  logger.debug('commentService.likeComment: Starting', { commentId, userId });

  const { error } = await supabase
    .from('comment_likes')
    .insert({ comment_id: commentId, user_id: userId });

  if (error) {
    logger.error('commentService.likeComment: Failed', { commentId, error: error.message });
    throw error;
  }

  logger.info('commentService.likeComment: Success', { commentId, userId });
}

/**
 * Unlike a comment. Deletes from comment_likes table.
 */
export async function unlikeComment(commentId: string, userId: string): Promise<void> {
  logger.debug('commentService.unlikeComment: Starting', { commentId, userId });

  const { error } = await supabase
    .from('comment_likes')
    .delete()
    .eq('comment_id', commentId)
    .eq('user_id', userId);

  if (error) {
    logger.error('commentService.unlikeComment: Failed', { commentId, error: error.message });
    throw error;
  }

  logger.info('commentService.unlikeComment: Success', { commentId, userId });
}

/**
 * Get all user IDs who liked a comment.
 */
export async function getCommentLikes(commentId: string): Promise<string[]> {
  logger.debug('commentService.getCommentLikes: Starting', { commentId });

  const { data, error } = await supabase
    .from('comment_likes')
    .select('user_id')
    .eq('comment_id', commentId);

  if (error) {
    logger.error('commentService.getCommentLikes: Failed', { commentId, error: error.message });
    throw error;
  }

  const userIds = (data ?? []).map((row: any) => row.user_id);
  logger.info('commentService.getCommentLikes: Success', { commentId, count: userIds.length });
  return userIds;
}
