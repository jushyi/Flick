/**
 * Comment Service Tests (Supabase)
 *
 * Tests CRUD operations for comments via Supabase, including flat threading,
 * comment likes, and validation.
 *
 * The service imports `supabase` from `@/lib/supabase`. We import the same
 * module to get the exact mock instance, then override `.from()` per test.
 */

// Import the same supabase instance the service uses
import { supabase } from '@/lib/supabase';

// Must import after mocks are set up
let commentService: typeof import('../../src/services/supabase/commentService');

beforeAll(() => {
  commentService = require('../../src/services/supabase/commentService');
});

// ============================================================================
// getComments
// ============================================================================
describe('getComments', () => {
  it('returns mapped comments with user data', async () => {
    const mockData = [
      {
        id: 'comment-1',
        photo_id: 'photo-1',
        user_id: 'user-1',
        parent_id: null,
        mentioned_comment_id: null,
        text: 'Hello world',
        mentions: [],
        media_url: null,
        media_type: null,
        like_count: 0,
        created_at: '2026-03-24T00:00:00Z',
        user: { username: 'alice', display_name: 'Alice', profile_photo_path: '/alice.webp' },
      },
    ];

    const mockOrder = jest.fn().mockResolvedValue({ data: mockData, error: null });
    const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

    const result = await commentService.getComments('photo-1');

    expect(supabase.from).toHaveBeenCalledWith('comments');
    expect(mockSelect).toHaveBeenCalledWith(
      expect.stringContaining('user:users')
    );
    expect(mockEq).toHaveBeenCalledWith('photo_id', 'photo-1');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'comment-1',
      photoId: 'photo-1',
      userId: 'user-1',
      text: 'Hello world',
      user: {
        username: 'alice',
        displayName: 'Alice',
        profilePhotoPath: '/alice.webp',
      },
    });
  });
});

// ============================================================================
// addComment
// ============================================================================
describe('addComment', () => {
  it('validates text length and throws if > 2000 chars', async () => {
    const longText = 'a'.repeat(2001);
    await expect(
      commentService.addComment({
        photoId: 'photo-1',
        userId: 'user-1',
        text: longText,
      })
    ).rejects.toThrow('Comment text exceeds maximum length');
  });

  it('validates mentions count and throws if > 10', async () => {
    const tooManyMentions = Array.from({ length: 11 }, (_, i) => `user-${i}`);
    await expect(
      commentService.addComment({
        photoId: 'photo-1',
        userId: 'user-1',
        text: 'Hello',
        mentions: tooManyMentions,
      })
    ).rejects.toThrow('Too many mentions');
  });

  it('flattens threading when target has parent_id', async () => {
    // First call: lookup target comment
    const mockTargetSingle = jest.fn().mockResolvedValue({
      data: { id: 'reply-1', parent_id: 'top-level-1' },
      error: null,
    });
    const mockTargetEq = jest.fn().mockReturnValue({ single: mockTargetSingle });
    const mockTargetSelect = jest.fn().mockReturnValue({ eq: mockTargetEq });

    // Second call: insert new comment
    const mockInsertSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'new-comment',
        photo_id: 'photo-1',
        user_id: 'user-1',
        parent_id: 'top-level-1',
        mentioned_comment_id: 'reply-1',
        text: 'Reply to reply',
        mentions: [],
        media_url: null,
        media_type: null,
        like_count: 0,
        created_at: '2026-03-24T00:00:00Z',
        user: { username: 'bob', display_name: 'Bob', profile_photo_path: null },
      },
      error: null,
    });
    const mockInsertSelect = jest.fn().mockReturnValue({ single: mockInsertSingle });
    const mockInsert = jest.fn().mockReturnValue({ select: mockInsertSelect });

    let callCount = 0;
    (supabase.from as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { select: mockTargetSelect };
      return { insert: mockInsert };
    });

    const result = await commentService.addComment({
      photoId: 'photo-1',
      userId: 'user-1',
      text: 'Reply to reply',
      parentId: 'reply-1',
    });

    expect(result.parentId).toBe('top-level-1');
    expect(result.mentionedCommentId).toBe('reply-1');
  });

  it('sets mentioned_comment_id correctly for direct reply to top-level', async () => {
    const mockTargetSingle = jest.fn().mockResolvedValue({
      data: { id: 'top-level-1', parent_id: null },
      error: null,
    });
    const mockTargetEq = jest.fn().mockReturnValue({ single: mockTargetSingle });
    const mockTargetSelect = jest.fn().mockReturnValue({ eq: mockTargetEq });

    const mockInsertSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'new-comment',
        photo_id: 'photo-1',
        user_id: 'user-1',
        parent_id: 'top-level-1',
        mentioned_comment_id: 'top-level-1',
        text: 'Reply to top-level',
        mentions: [],
        media_url: null,
        media_type: null,
        like_count: 0,
        created_at: '2026-03-24T00:00:00Z',
        user: { username: 'bob', display_name: 'Bob', profile_photo_path: null },
      },
      error: null,
    });
    const mockInsertSelect = jest.fn().mockReturnValue({ single: mockInsertSingle });
    const mockInsert = jest.fn().mockReturnValue({ select: mockInsertSelect });

    let callCount = 0;
    (supabase.from as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { select: mockTargetSelect };
      return { insert: mockInsert };
    });

    const result = await commentService.addComment({
      photoId: 'photo-1',
      userId: 'user-1',
      text: 'Reply to top-level',
      parentId: 'top-level-1',
    });

    expect(result.parentId).toBe('top-level-1');
    expect(result.mentionedCommentId).toBe('top-level-1');
  });
});

// ============================================================================
// deleteComment
// ============================================================================
describe('deleteComment', () => {
  it('deletes comment by ID', async () => {
    const mockDeleteEq = jest.fn().mockResolvedValue({ error: null });
    const mockDelete = jest.fn().mockReturnValue({ eq: mockDeleteEq });
    (supabase.from as jest.Mock).mockReturnValue({ delete: mockDelete });

    await commentService.deleteComment('comment-1');

    expect(supabase.from).toHaveBeenCalledWith('comments');
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 'comment-1');
  });
});

// ============================================================================
// likeComment
// ============================================================================
describe('likeComment', () => {
  it('inserts into comment_likes', async () => {
    const mockLikeInsert = jest.fn().mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({ insert: mockLikeInsert });

    await commentService.likeComment('comment-1', 'user-1');

    expect(supabase.from).toHaveBeenCalledWith('comment_likes');
    expect(mockLikeInsert).toHaveBeenCalledWith({
      comment_id: 'comment-1',
      user_id: 'user-1',
    });
  });
});

// ============================================================================
// unlikeComment
// ============================================================================
describe('unlikeComment', () => {
  it('deletes from comment_likes', async () => {
    const mockUnlikeEq2 = jest.fn().mockResolvedValue({ error: null });
    const mockUnlikeEq1 = jest.fn().mockReturnValue({ eq: mockUnlikeEq2 });
    const mockUnlikeDelete = jest.fn().mockReturnValue({ eq: mockUnlikeEq1 });
    (supabase.from as jest.Mock).mockReturnValue({ delete: mockUnlikeDelete });

    await commentService.unlikeComment('comment-1', 'user-1');

    expect(supabase.from).toHaveBeenCalledWith('comment_likes');
    expect(mockUnlikeDelete).toHaveBeenCalled();
    expect(mockUnlikeEq1).toHaveBeenCalledWith('comment_id', 'comment-1');
    expect(mockUnlikeEq2).toHaveBeenCalledWith('user_id', 'user-1');
  });
});

// ============================================================================
// getCommentLikes
// ============================================================================
describe('getCommentLikes', () => {
  it('returns array of user IDs', async () => {
    const mockLikesEq = jest.fn().mockResolvedValue({
      data: [{ user_id: 'user-1' }, { user_id: 'user-2' }],
      error: null,
    });
    const mockLikesSelect = jest.fn().mockReturnValue({ eq: mockLikesEq });
    (supabase.from as jest.Mock).mockReturnValue({ select: mockLikesSelect });

    const result = await commentService.getCommentLikes('comment-1');

    expect(supabase.from).toHaveBeenCalledWith('comment_likes');
    expect(mockLikesSelect).toHaveBeenCalledWith('user_id');
    expect(mockLikesEq).toHaveBeenCalledWith('comment_id', 'comment-1');
    expect(result).toEqual(['user-1', 'user-2']);
  });
});
