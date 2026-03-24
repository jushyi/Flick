import { queryKeys } from '../../src/lib/queryKeys';

describe('queryKeys', () => {
  it('profile.all returns ["profile"]', () => {
    expect(queryKeys.profile.all).toEqual(['profile']);
  });

  it('profile.detail returns ["profile", userId]', () => {
    expect(queryKeys.profile.detail('user-123')).toEqual(['profile', 'user-123']);
  });

  it('profile.me returns ["profile", "me"]', () => {
    expect(queryKeys.profile.me()).toEqual(['profile', 'me']);
  });

  it('photos.feed returns ["photos", "feed"]', () => {
    expect(queryKeys.photos.feed()).toEqual(['photos', 'feed']);
  });

  it('photos.list returns ["photos", "list", userId]', () => {
    expect(queryKeys.photos.list('user-456')).toEqual(['photos', 'list', 'user-456']);
  });

  it('conversations.messages returns ["conversations", "messages", id]', () => {
    expect(queryKeys.conversations.messages('conv-1')).toEqual([
      'conversations',
      'messages',
      'conv-1',
    ]);
  });

  it('friends.requests returns ["friends", "requests"]', () => {
    expect(queryKeys.friends.requests()).toEqual(['friends', 'requests']);
  });

  it('comments.list returns ["comments", "list", photoId]', () => {
    expect(queryKeys.comments.list('photo-1')).toEqual(['comments', 'list', 'photo-1']);
  });

  it('notifications.list returns ["notifications", "list"]', () => {
    expect(queryKeys.notifications.list()).toEqual(['notifications', 'list']);
  });

  it('albums.detail returns ["albums", "detail", albumId]', () => {
    expect(queryKeys.albums.detail('album-1')).toEqual(['albums', 'detail', 'album-1']);
  });

  it('albums.monthly returns ["albums", "monthly", userId]', () => {
    expect(queryKeys.albums.monthly('user-1')).toEqual(['albums', 'monthly', 'user-1']);
  });

  it('comments.likes returns ["comments", "likes", photoId]', () => {
    expect(queryKeys.comments.likes('photo-1')).toEqual(['comments', 'likes', 'photo-1']);
  });

  it('friendships.all returns ["friendships"]', () => {
    expect(queryKeys.friendships.all).toEqual(['friendships']);
  });

  it('friendships.list returns ["friendships", "list", userId]', () => {
    expect(queryKeys.friendships.list('user-1')).toEqual(['friendships', 'list', 'user-1']);
  });

  it('friendships.pending returns ["friendships", "pending", userId]', () => {
    expect(queryKeys.friendships.pending('user-1')).toEqual([
      'friendships',
      'pending',
      'user-1',
    ]);
  });

  it('friendships.sent returns ["friendships", "sent", userId]', () => {
    expect(queryKeys.friendships.sent('user-1')).toEqual(['friendships', 'sent', 'user-1']);
  });

  it('friendships.status returns ["friendships", "status", userId1, userId2]', () => {
    expect(queryKeys.friendships.status('user-1', 'user-2')).toEqual([
      'friendships',
      'status',
      'user-1',
      'user-2',
    ]);
  });

  it('blocks.all returns ["blocks"]', () => {
    expect(queryKeys.blocks.all).toEqual(['blocks']);
  });

  it('blocks.list returns ["blocks", "list", userId]', () => {
    expect(queryKeys.blocks.list('user-1')).toEqual(['blocks', 'list', 'user-1']);
  });

  it('contacts.all returns ["contacts"]', () => {
    expect(queryKeys.contacts.all).toEqual(['contacts']);
  });

  it('contacts.suggestions returns ["contacts", "suggestions", userId]', () => {
    expect(queryKeys.contacts.suggestions('user-1')).toEqual([
      'contacts',
      'suggestions',
      'user-1',
    ]);
  });
});
