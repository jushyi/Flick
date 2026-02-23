/**
 * useConversation Hook
 *
 * Manages message list and actions for a single conversation including:
 * - Real-time subscription to recent messages
 * - Real-time subscription to conversation document (readReceipts, metadata)
 * - Cursor-based pagination for older messages
 * - Merged, deduplicated, sorted message list
 * - Send message functionality
 * - Mark as read on mount (first-read-only, foreground-only)
 * - Notification dismissal for the conversation
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';

import { getFirestore, doc, onSnapshot } from '@react-native-firebase/firestore';

import {
  subscribeToMessages,
  loadMoreMessages,
  sendMessage,
  markConversationRead,
} from '../services/firebase/messageService';

import logger from '../utils/logger';

/**
 * Dismiss any presented notifications for a specific conversation.
 * Best-effort — errors are silently ignored.
 *
 * @param {string} convId - Conversation ID to dismiss notifications for
 */
const dismissConversationNotifications = async convId => {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    const toDelete = presented.filter(n => n.request.content.data?.conversationId === convId);
    await Promise.all(
      toDelete.map(n => Notifications.dismissNotificationAsync(n.request.identifier))
    );
  } catch (_err) {
    // Ignore errors — notification dismissal is best-effort
  }
};

/**
 * useConversation Hook
 *
 * @param {string} conversationId - Conversation document ID
 * @param {string} currentUserId - Current user's UID
 * @param {object|null} deletedAtCutoff - Firestore Timestamp cutoff for soft-deletion filtering
 * @returns {object} - Message list state and actions
 */
const useConversation = (conversationId, currentUserId, deletedAtCutoff = null) => {
  const [recentMessages, setRecentMessages] = useState([]);
  const [olderMessages, setOlderMessages] = useState([]);
  const [conversationDoc, setConversationDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const unsubscribeRef = useRef(null);
  const convDocUnsubscribeRef = useRef(null);
  const lastDocRef = useRef(null);

  logger.debug('useConversation: Hook initialized', {
    conversationId,
    currentUserId,
    hasDeletedAtCutoff: !!deletedAtCutoff,
  });

  /**
   * Subscribe to real-time message updates (newest messages)
   */
  useEffect(() => {
    if (!conversationId) {
      logger.warn('useConversation: No conversationId provided');
      setLoading(false);
      return;
    }

    logger.debug('useConversation: Setting up subscription', { conversationId });
    setLoading(true);

    // Reset older messages and pagination when conversation changes
    setOlderMessages([]);
    lastDocRef.current = null;
    setHasMore(true);

    unsubscribeRef.current = subscribeToMessages(
      conversationId,
      result => {
        logger.debug('useConversation: Subscription callback', {
          success: result.success,
          messageCount: result.messages?.length,
        });

        if (result.success) {
          setRecentMessages(result.messages || []);

          // Track lastDoc cursor for pagination handoff
          if (result.lastDoc) {
            lastDocRef.current = result.lastDoc;
          }
        } else {
          logger.error('useConversation: Subscription error', { error: result.error });
        }

        setLoading(false);
      },
      deletedAtCutoff,
      25
    );

    // Cleanup subscription on unmount or conversationId change
    return () => {
      logger.debug('useConversation: Cleaning up subscription', { conversationId });
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [conversationId, deletedAtCutoff]);

  /**
   * Subscribe to conversation document for real-time readReceipts and metadata
   */
  useEffect(() => {
    if (!conversationId) return;

    const db = getFirestore();
    const convRef = doc(db, 'conversations', conversationId);

    logger.debug('useConversation: Setting up conversation doc subscription', {
      conversationId,
    });

    convDocUnsubscribeRef.current = onSnapshot(
      convRef,
      snapshot => {
        if (snapshot.exists) {
          const data = { id: snapshot.id, ...snapshot.data() };
          setConversationDoc(data);
          logger.debug('useConversation: Conversation doc updated', {
            conversationId,
            hasReadReceipts: !!data.readReceipts,
          });
        }
      },
      error => {
        logger.error('useConversation: Conversation doc subscription error', {
          conversationId,
          error: error.message,
        });
      }
    );

    return () => {
      if (convDocUnsubscribeRef.current) {
        convDocUnsubscribeRef.current();
        convDocUnsubscribeRef.current = null;
      }
    };
  }, [conversationId]);

  /**
   * Mark conversation as read and dismiss notifications.
   * First-read-only: only writes when there are unread messages (preserves original read timestamp).
   * Foreground-only: only writes when app is in foreground (active state).
   * Also triggers mark-as-read when app returns to foreground with unread messages.
   */
  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const shouldMarkRead = () => {
      const unread = conversationDoc?.unreadCount?.[currentUserId];
      return unread > 0 && AppState.currentState === 'active';
    };

    // Mark as read on mount/focus (if conditions are met)
    if (shouldMarkRead()) {
      logger.debug('useConversation: Marking as read', { conversationId, currentUserId });
      markConversationRead(conversationId, currentUserId);
    }

    // Always dismiss notifications when entering conversation
    dismissConversationNotifications(conversationId);

    // Listen for app state changes — mark as read when returning to foreground
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        const unread = conversationDoc?.unreadCount?.[currentUserId];
        if (unread > 0) {
          logger.debug('useConversation: App returned to foreground, marking as read', {
            conversationId,
            currentUserId,
          });
          markConversationRead(conversationId, currentUserId);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [conversationId, currentUserId, conversationDoc]);

  /**
   * Load older messages (pagination).
   * Guards against double-loading and missing cursor.
   * Follows the exact guard pattern from useFeedPhotos.js.
   */
  const loadMore = useCallback(async () => {
    // Don't load if already loading or no more messages
    if (loadingMore || !hasMore || !lastDocRef.current) return;

    logger.debug('useConversation: Loading more messages', { conversationId });

    try {
      setLoadingMore(true);

      const result = await loadMoreMessages(
        conversationId,
        lastDocRef.current,
        deletedAtCutoff,
        25
      );

      if (result.success) {
        setOlderMessages(prev => [...prev, ...result.messages]);

        // Update cursor and hasMore from response
        if (result.lastDoc) {
          lastDocRef.current = result.lastDoc;
        }
        setHasMore(result.hasMore);
      } else {
        logger.error('useConversation: loadMore failed', { error: result.error });
      }
    } catch (err) {
      logger.error('useConversation: loadMore error', { error: err.message });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, conversationId, deletedAtCutoff]);

  /**
   * Merged, deduplicated, and sorted message list.
   * Combines recentMessages (real-time) and olderMessages (paginated).
   * Sorted by createdAt descending (newest first for inverted FlatList).
   */
  const messages = useMemo(() => {
    const map = new Map();
    [...recentMessages, ...olderMessages].forEach(m => map.set(m.id, m));
    return Array.from(map.values()).sort(
      (a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
    );
  }, [recentMessages, olderMessages]);

  /**
   * Send a message in the conversation.
   * The real-time subscription will automatically pick up the new message.
   *
   * @param {string} text - Message text (null if gif)
   * @param {string|null} gifUrl - GIF URL (null if text)
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  const handleSendMessage = useCallback(
    async (text, gifUrl = null) => {
      if (!conversationId || !currentUserId) {
        logger.warn('useConversation.handleSendMessage: Missing required fields', {
          conversationId,
          currentUserId,
        });
        return { success: false, error: 'Missing required fields' };
      }

      logger.debug('useConversation.handleSendMessage: Sending', {
        conversationId,
        hasText: !!text,
        hasGif: !!gifUrl,
      });

      const result = await sendMessage(conversationId, currentUserId, text, gifUrl);

      if (result.success) {
        logger.info('useConversation.handleSendMessage: Success', {
          messageId: result.messageId,
        });
      } else {
        logger.error('useConversation.handleSendMessage: Failed', {
          error: result.error,
        });
      }

      return result;
    },
    [conversationId, currentUserId]
  );

  return {
    messages,
    conversationDoc,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    handleSendMessage,
  };
};

export default useConversation;
