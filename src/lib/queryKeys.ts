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
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => ['notifications', 'list'] as const,
  },
  albums: {
    all: ['albums'] as const,
    list: (userId: string) => ['albums', 'list', userId] as const,
    detail: (albumId: string) => ['albums', 'detail', albumId] as const,
  },
} as const;
