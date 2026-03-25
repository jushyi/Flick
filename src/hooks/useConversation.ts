/**
 * useConversation Hook (Supabase + TanStack + Realtime)
 *
 * Manages message list and actions for a single conversation including:
 * - Paginated message fetching via TanStack useInfiniteQuery
 * - Real-time new message and update detection via Supabase Realtime channel
 * - Deduplication of messages across pages via Map keyed by message ID
 * - Read receipt marking on mount and foreground transitions
 * - All 10 message action functions (send, react, reply, unsend, delete, snap, etc.)
 *
 * This is the NEW hook (.ts) for the Supabase migration. The old .js file
 * is preserved for strangler fig -- screens will be switched later.
 */
import { useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';

import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
import {
  getMessages,
  sendMessage,
  sendReaction,
  removeReaction,
  sendReply,
  unsendMessage,
  deleteMessageForMe,
  markConversationRead,
  sendTaggedPhotoMessage,
  type MessageRow,
} from '../services/supabase/messageService';
import {
  uploadAndSendSnap,
  markSnapViewed,
  getSignedSnapUrl,
} from '../services/supabase/snapService';

import { useAuth } from '../context/AuthContext';

import logger from '../utils/logger';

// ============================================================================
// Constants
// ============================================================================

const PAGE_SIZE = 25;
const STALE_TIME = 30_000; // 30 seconds (project convention)

// ============================================================================
// Helpers
// ============================================================================

/**
 * Dismiss any presented notifications for a specific conversation.
 * Best-effort -- errors are silently ignored.
 */
const dismissConversationNotifications = async (convId: string) => {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    const toDelete = presented.filter(n => n.request.content.data?.conversationId === convId);
    await Promise.all(
      toDelete.map(n => Notifications.dismissNotificationAsync(n.request.identifier))
    );
  } catch {
    // Notification dismissal is best-effort
  }
};

// ============================================================================
// Hook
// ============================================================================

export interface UseConversationResult {
  messages: MessageRow[];
  isLoading: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
  sendMessage: (text: string, gifUrl?: string) => Promise<{ messageId: string }>;
  sendReaction: (targetMessageId: string, emoji: string) => Promise<{ messageId: string }>;
  removeReaction: (targetMessageId: string) => Promise<void>;
  sendReply: (
    text: string,
    replyToId: string,
    replyPreview: { sender_id: string; type: string; text: string | null }
  ) => Promise<{ messageId: string }>;
  unsendMessage: (messageId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  sendSnap: (localUri: string, caption?: string) => Promise<{ messageId: string }>;
  markSnapViewed: (messageId: string) => Promise<void>;
  getSnapUrl: (storagePath: string) => Promise<string>;
  sendTaggedPhoto: (taggedPhotoId: string) => Promise<{ messageId: string }>;
}

/**
 * useConversation Hook
 *
 * Provides paginated messages via TanStack useInfiniteQuery, real-time updates
 * via Supabase Realtime channel, and all message action functions.
 *
 * @param conversationId - Conversation document ID
 * @returns Message list state and actions
 */
export function useConversation(conversationId: string): UseConversationResult {
  const { userProfile } = useAuth() as unknown as {
    userProfile: { uid: string; settings?: { readReceipts?: boolean } } | null;
  };
  const userId = userProfile?.uid ?? '';
  const readReceiptsEnabled = userProfile?.settings?.readReceipts !== false;
  const queryClient = useQueryClient();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // --------------------------------------------------------------------------
  // Data fetching: paginated messages via TanStack useInfiniteQuery
  // --------------------------------------------------------------------------

  const {
    data,
    isLoading,
    hasNextPage = false,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.conversations.messages(conversationId),
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      return getMessages(conversationId, userId, {
        cursor: pageParam ?? undefined,
        limit: PAGE_SIZE,
      });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: MessageRow[]) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return lastPage[lastPage.length - 1].created_at;
    },
    enabled: !!conversationId && !!userId,
    staleTime: STALE_TIME,
  });

  // --------------------------------------------------------------------------
  // Deduplication: flatten pages and deduplicate by message ID
  // --------------------------------------------------------------------------

  const messages = useMemo(() => {
    if (!data?.pages) return [];

    const map = new Map<string, MessageRow>();
    data.pages.flat().forEach(msg => map.set(msg.id, msg));

    // Return sorted by created_at descending (newest first for inverted FlatList)
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [data]);

  // --------------------------------------------------------------------------
  // Realtime subscription: invalidate queries on new/updated messages
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (!conversationId) return;

    logger.debug('useConversation: Setting up Realtime channel', { conversationId });

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          logger.debug('useConversation: Realtime INSERT received', { conversationId });
          queryClient.invalidateQueries({
            queryKey: queryKeys.conversations.messages(conversationId),
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          logger.debug('useConversation: Realtime UPDATE received', { conversationId });
          queryClient.invalidateQueries({
            queryKey: queryKeys.conversations.messages(conversationId),
          });
        }
      )
      .subscribe();

    return () => {
      logger.debug('useConversation: Cleaning up Realtime channel', { conversationId });
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  // --------------------------------------------------------------------------
  // Read receipts: mark as read on mount and foreground transitions
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (!conversationId || !userId) return;

    const doMarkRead = () => {
      if (readReceiptsEnabled) {
        markConversationRead(conversationId, userId).catch(err => {
          logger.error('useConversation: markConversationRead failed', {
            conversationId,
            error: err.message,
          });
        });
      }
    };

    // Mark as read on mount
    doMarkRead();

    // Dismiss notifications when entering conversation
    dismissConversationNotifications(conversationId);

    // Mark as read when app returns to foreground
    const subscription = AppState.addEventListener('change', nextState => {
      if (appStateRef.current !== 'active' && nextState === 'active') {
        doMarkRead();
      }
      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, [conversationId, userId, readReceiptsEnabled]);

  // --------------------------------------------------------------------------
  // Message actions
  // --------------------------------------------------------------------------

  const messagesQueryKey = queryKeys.conversations.messages(conversationId);

  const invalidateMessages = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: messagesQueryKey });
  }, [queryClient, messagesQueryKey]);

  // 1. Send message
  const handleSendMessage = useCallback(
    async (text: string, gifUrl?: string) => {
      const result = await sendMessage({
        conversationId,
        senderId: userId,
        text,
        gifUrl: gifUrl ?? null,
      });
      invalidateMessages();
      return result;
    },
    [conversationId, userId, invalidateMessages]
  );

  // 2. Send reaction
  const handleSendReaction = useCallback(
    async (targetMessageId: string, emoji: string) => {
      const result = await sendReaction(conversationId, userId, targetMessageId, emoji);
      invalidateMessages();
      return result;
    },
    [conversationId, userId, invalidateMessages]
  );

  // 3. Remove reaction
  const handleRemoveReaction = useCallback(
    async (targetMessageId: string) => {
      await removeReaction(conversationId, userId, targetMessageId);
      invalidateMessages();
    },
    [conversationId, userId, invalidateMessages]
  );

  // 4. Send reply
  const handleSendReply = useCallback(
    async (
      text: string,
      replyToId: string,
      replyPreview: { sender_id: string; type: string; text: string | null }
    ) => {
      const result = await sendReply({
        conversationId,
        senderId: userId,
        text,
        replyToId,
        replyPreview,
      });
      invalidateMessages();
      return result;
    },
    [conversationId, userId, invalidateMessages]
  );

  // 5. Unsend message
  const handleUnsendMessage = useCallback(
    async (messageId: string) => {
      await unsendMessage(messageId);
      invalidateMessages();
    },
    [invalidateMessages]
  );

  // 6. Delete message for me
  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      await deleteMessageForMe(messageId, userId);
      invalidateMessages();
    },
    [userId, invalidateMessages]
  );

  // 7. Send snap
  const handleSendSnap = useCallback(
    async (localUri: string, caption?: string) => {
      const result = await uploadAndSendSnap(conversationId, userId, localUri, caption ?? null);
      invalidateMessages();
      return result;
    },
    [conversationId, userId, invalidateMessages]
  );

  // 8. Mark snap viewed
  const handleMarkSnapViewed = useCallback(
    async (messageId: string) => {
      await markSnapViewed(messageId);
      invalidateMessages();
    },
    [invalidateMessages]
  );

  // 9. Get snap URL
  const handleGetSnapUrl = useCallback(async (storagePath: string) => {
    return getSignedSnapUrl(storagePath);
  }, []);

  // 10. Send tagged photo
  const handleSendTaggedPhoto = useCallback(
    async (taggedPhotoId: string) => {
      const result = await sendTaggedPhotoMessage(conversationId, userId, taggedPhotoId);
      invalidateMessages();
      return result;
    },
    [conversationId, userId, invalidateMessages]
  );

  return {
    messages,
    isLoading,
    hasNextPage: hasNextPage ?? false,
    fetchNextPage,
    isFetchingNextPage,
    sendMessage: handleSendMessage,
    sendReaction: handleSendReaction,
    removeReaction: handleRemoveReaction,
    sendReply: handleSendReply,
    unsendMessage: handleUnsendMessage,
    deleteMessage: handleDeleteMessage,
    sendSnap: handleSendSnap,
    markSnapViewed: handleMarkSnapViewed,
    getSnapUrl: handleGetSnapUrl,
    sendTaggedPhoto: handleSendTaggedPhoto,
  };
}

// ============================================================================
// Standalone mutation: mark conversation as read (optimistic)
// ============================================================================

/**
 * Optimistic mutation for marking a conversation as read.
 * Sets unread count to 0 instantly, invalidates conversation list badge.
 */
export function useMarkAsRead() {
  return useOptimisticMutation({
    mutationFn: ({ conversationId, userId }: { conversationId: string; userId: string }) =>
      markConversationRead(conversationId, userId),
    queryKey: (vars: { conversationId: string }) =>
      queryKeys.conversations.detail(vars.conversationId),
    updater: (old: Record<string, unknown> | undefined, _vars) => {
      if (!old) return old;
      return { ...old, unreadCount: 0 };
    },
    errorMessage: 'Failed to mark as read',
    invalidateKeys: [queryKeys.conversations.list()],
  });
}
