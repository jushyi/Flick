/**
 * useMessages Hook (Supabase + PowerSync)
 *
 * Manages conversation list state for the Messages tab.
 * Reads conversation data from PowerSync local SQLite -- zero network latency.
 * PowerSync handles sync from Supabase; no direct REST calls or Realtime subscriptions needed.
 *
 * This is the NEW hook (.ts) for the Supabase migration. The old .js file
 * is preserved for strangler fig -- screens will be switched later.
 */
import { useState, useCallback, useMemo } from 'react';

import { useQuery as usePowerSyncQuery } from '@powersync/react';

import {
  softDeleteConversation,
  type ConversationRow,
} from '../services/supabase/messageService';

import { useAuth } from '../context/AuthContext';

import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface ConversationListItem extends ConversationRow {
  otherUserId: string;
  unreadCount: number;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useMessages Hook
 *
 * Returns the current user's conversation list from PowerSync local SQLite.
 * Each conversation includes a derived `otherUserId` and `unreadCount`.
 * Soft-deleted conversations are filtered out (deleted_at > last_message_at).
 *
 * @returns Conversation list state and actions
 */
export function useMessages() {
  const { userProfile } = useAuth() as { userProfile: { uid: string } | null };
  const userId = userProfile?.uid;

  // Query conversations where user is either participant, ordered by last message
  const { data: rows, isLoading } = usePowerSyncQuery(
    `SELECT * FROM conversations
     WHERE (participant1_id = ? OR participant2_id = ?)
     AND last_message_at IS NOT NULL
     ORDER BY last_message_at DESC`,
    [userId ?? '', userId ?? ''],
  );

  // Map, filter soft-deleted, and derive otherUserId + unreadCount
  const conversations: ConversationListItem[] = useMemo(() => {
    if (!userId || !rows) return [];

    return (rows as ConversationRow[])
      .filter((conv) => {
        const isP1 = conv.participant1_id === userId;
        const deletedAt = isP1 ? conv.deleted_at_p1 : conv.deleted_at_p2;

        if (!deletedAt) return true;
        if (!conv.last_message_at) return false;

        // Show conversation only if a new message arrived after soft-delete
        return conv.last_message_at > deletedAt;
      })
      .map((conv) => {
        const isP1 = conv.participant1_id === userId;
        return {
          ...conv,
          otherUserId: isP1 ? conv.participant2_id : conv.participant1_id,
          unreadCount: isP1 ? conv.unread_count_p1 : conv.unread_count_p2,
        };
      });
  }, [rows, userId]);

  // Soft-delete a conversation for the current user
  const deleteConversation = useCallback(
    async (conversationId: string) => {
      if (!conversationId || !userId) {
        logger.warn('useMessages.deleteConversation: Missing required fields', {
          conversationId,
          userId,
        });
        return;
      }

      logger.info('useMessages.deleteConversation: Deleting', {
        conversationId,
        userId,
      });

      try {
        await softDeleteConversation(conversationId, userId);
        logger.info('useMessages.deleteConversation: Success', { conversationId });
      } catch (error: any) {
        logger.error('useMessages.deleteConversation: Failed', {
          conversationId,
          error: error.message,
        });
        throw error;
      }
    },
    [userId],
  );

  return {
    conversations,
    loading: isLoading,
    deleteConversation,
  };
}
