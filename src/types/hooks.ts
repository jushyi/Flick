/**
 * Hook return type definitions
 *
 * Typed return values for custom hooks used across the app.
 * Based on actual hook implementations in src/hooks/.
 */

import type { RefObject } from 'react';
import type { Photo, FeedPhoto, Conversation } from './services';

/**
 * Return type for useCamera hook.
 * Based on src/hooks/useCamera.ios.js return value.
 */
export type UseCameraReturn = {
  cameraRef: RefObject<any>;
  hasPermission: boolean | null;
  facing: 'front' | 'back';
  flash: 'on' | 'off';
  zoom: number;
  isRecording: boolean;
  isCapturing: boolean;
  toggleFacing: () => void;
  toggleFlash: () => void;
  setZoom: (level: number) => void;
  capturePhoto: (taggedUserIds?: string[]) => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
};

/**
 * Return type for useDarkroom hook.
 * Based on src/hooks/useDarkroom.js return value.
 */
export type UseDarkroomReturn = {
  developingPhotos: Photo[];
  revealedPhotos: Photo[];
  isRevealing: boolean;
  countdown: number | null;
  revealPhotos: () => Promise<void>;
  isLoading: boolean;
};

/**
 * Return type for useFeedPhotos hook.
 * Based on src/hooks/useFeedPhotos.ts return value.
 */
export type UseFeedPhotosReturn = {
  feedGroups: Array<{
    userId: string;
    username: string;
    displayName: string;
    photoUrl: string | null;
    photos: FeedPhoto[];
  }>;
  hotPhotos: FeedPhoto[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

/**
 * Return type for useComments hook.
 * Based on src/hooks/useComments.js return value.
 */
export type UseCommentsReturn = {
  comments: Array<{
    id: string;
    text: string;
    userId: string;
    username: string;
    displayName: string;
    photoUrl: string | null;
    mentions: string[];
    parentId: string | null;
    imageUrl: string | null;
    likeCount: number;
    isLiked: boolean;
    createdAt: string;
  }>;
  isLoading: boolean;
  addComment: (text: string, mentions?: string[], imageUrl?: string | null) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  toggleLike: (commentId: string) => Promise<void>;
  replyTo: (commentId: string) => void;
  cancelReply: () => void;
  replyTarget: { id: string; username: string } | null;
};

/**
 * Return type for useMessages hook.
 * Based on src/hooks/useMessages.js return value.
 */
export type UseMessagesReturn = {
  conversations: Array<Conversation & {
    friendProfile: {
      id: string;
      username: string;
      displayName: string;
      photoUrl: string | null;
    } | null;
  }>;
  isLoading: boolean;
  error: string | null;
  totalUnreadCount: number;
  deleteConversation: (conversationId: string) => Promise<void>;
  refetch: () => void;
};

/**
 * Return type for useConversation hook.
 * Based on src/hooks/useConversation.js return value.
 */
export type UseConversationReturn = {
  messages: Array<any>; // Message type with extended fields
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  sendMessage: (text: string) => Promise<void>;
  sendReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string) => Promise<void>;
  sendReply: (text: string, replyToId: string) => Promise<void>;
  loadMore: () => Promise<void>;
  deleteMessageForMe: (messageId: string) => Promise<void>;
};

/**
 * Return type for useStreak hook.
 * Based on src/hooks/useStreaks.js return value.
 */
export type UseStreakReturn = {
  streakState: 'default' | 'building' | 'pending' | 'active' | 'warning';
  dayCount: number;
  isLoading: boolean;
};

/**
 * Return type for useViewedStories hook.
 * Based on src/hooks/useViewedStories.js return value.
 */
export type UseViewedStoriesReturn = {
  viewedPhotoIds: Set<string>;
  isLoading: boolean;
  markAsViewed: (photoIds: string[]) => Promise<void>;
};
