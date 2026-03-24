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
});
