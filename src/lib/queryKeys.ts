export const queryKeys = {
  profile: {
    all: ['profile'] as const,
    detail: (userId: string) => ['profile', userId] as const,
    me: () => ['profile', 'me'] as const,
  },
  photos: {
    all: ['photos'] as const,
    list: (userId: string) => ['photos', 'list', userId] as const,
    detail: (photoId: string) => ['photos', 'detail', photoId] as const,
    feed: () => ['photos', 'feed'] as const,
  },
  conversations: {
    all: ['conversations'] as const,
    list: () => ['conversations', 'list'] as const,
    detail: (conversationId: string) =>
      ['conversations', 'detail', conversationId] as const,
    messages: (conversationId: string) =>
      ['conversations', 'messages', conversationId] as const,
  },
  friends: {
    all: ['friends'] as const,
    list: (userId: string) => ['friends', 'list', userId] as const,
    requests: () => ['friends', 'requests'] as const,
  },
  comments: {
    all: ['comments'] as const,
    list: (photoId: string) => ['comments', 'list', photoId] as const,
    likes: (photoId: string) => ['comments', 'likes', photoId] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => ['notifications', 'list'] as const,
  },
  albums: {
    all: ['albums'] as const,
    list: (userId: string) => ['albums', 'list', userId] as const,
    detail: (albumId: string) => ['albums', 'detail', albumId] as const,
    monthly: (userId: string) => ['albums', 'monthly', userId] as const,
  },
  friendships: {
    all: ['friendships'] as const,
    list: (userId: string) => ['friendships', 'list', userId] as const,
    pending: (userId: string) => ['friendships', 'pending', userId] as const,
    sent: (userId: string) => ['friendships', 'sent', userId] as const,
    status: (userId1: string, userId2: string) =>
      ['friendships', 'status', userId1, userId2] as const,
  },
  blocks: {
    all: ['blocks'] as const,
    list: (userId: string) => ['blocks', 'list', userId] as const,
  },
  contacts: {
    all: ['contacts'] as const,
    suggestions: (userId: string) => ['contacts', 'suggestions', userId] as const,
  },
  streaks: {
    all: ['streaks'] as const,
    detail: (streakId: string) => ['streaks', 'detail', streakId] as const,
    forUser: (userId: string) => ['streaks', 'forUser', userId] as const,
  },
} as const;
