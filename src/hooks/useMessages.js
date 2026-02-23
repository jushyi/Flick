/**
 * useMessages Hook
 *
 * Manages conversation list state for the Messages tab including:
 * - Real-time subscription to user's conversations
 * - Friend profile data fetching with caching
 * - Soft-deleted conversation filtering
 * - Total unread count aggregation
 * - Optimistic soft delete with revert on failure
 */
import { useState, useEffect, useRef, useCallback } from 'react';

import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';

import {
  subscribeToConversations,
  softDeleteConversation,
} from '../services/firebase/messageService';

import logger from '../utils/logger';

const db = getFirestore();

/**
 * useMessages Hook
 *
 * @param {string} userId - Current user's UID (from AuthContext)
 * @returns {object} - Conversation list state and actions
 */
const useMessages = userId => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const unsubscribeRef = useRef(null);
  const friendProfileCacheRef = useRef(new Map());

  logger.debug('useMessages: Hook initialized', { userId });

  /**
   * Fetch friend profiles for user IDs not already cached.
   * Returns a Map of userId -> profile data.
   *
   * @param {string[]} friendIds - Array of friend user IDs to fetch
   * @returns {Promise<Map<string, object>>} Map of userId to profile data
   */
  const fetchFriendProfiles = useCallback(async friendIds => {
    const cache = friendProfileCacheRef.current;
    const uncachedIds = friendIds.filter(id => !cache.has(id));

    if (uncachedIds.length > 0) {
      logger.debug('useMessages: Fetching uncached friend profiles', {
        uncachedCount: uncachedIds.length,
        cachedCount: cache.size,
      });

      const profileDocs = await Promise.all(uncachedIds.map(id => getDoc(doc(db, 'users', id))));

      profileDocs.forEach((profileSnap, index) => {
        const id = uncachedIds[index];
        const data = profileSnap.exists() ? profileSnap.data() : {};
        cache.set(id, {
          uid: id,
          username: data.username || 'unknown',
          displayName: data.displayName || 'Unknown User',
          profilePhotoURL: data.profilePhotoURL || data.photoURL || null,
          nameColor: data.nameColor || null,
        });
      });
    }

    return cache;
  }, []);

  /**
   * Subscribe to real-time conversation list updates
   */
  useEffect(() => {
    if (!userId) {
      logger.warn('useMessages: No userId provided');
      setLoading(false);
      return;
    }

    logger.debug('useMessages: Setting up subscription', { userId });
    setLoading(true);

    let recoveryTimer = null;
    let hasReceivedData = false;

    unsubscribeRef.current = subscribeToConversations(userId, async result => {
      logger.debug('useMessages: Subscription callback', {
        success: result.success,
        conversationCount: result.conversations?.length,
      });

      if (result.success) {
        hasReceivedData = true;
        if (recoveryTimer) {
          clearTimeout(recoveryTimer);
          recoveryTimer = null;
        }

        const rawConversations = result.conversations || [];

        // Filter out soft-deleted conversations:
        // Show only if lastMessage?.timestamp > deletedAt[userId] OR deletedAt[userId] is null/undefined
        // If there's no lastMessage and deletedAt[userId] is set, hide it
        const visibleConversations = rawConversations.filter(conv => {
          const deletedAt = conv.deletedAt?.[userId];
          if (!deletedAt) return true;

          const lastMessageTimestamp = conv.lastMessage?.timestamp;
          if (!lastMessageTimestamp) return false;

          // Compare timestamps: lastMessage must be after deletedAt
          const deletedAtMillis = deletedAt.toMillis?.() || 0;
          const lastMessageMillis = lastMessageTimestamp.toMillis?.() || 0;
          return lastMessageMillis > deletedAtMillis;
        });

        // Extract friend user IDs (the participant that is NOT userId)
        const friendIds = visibleConversations
          .map(conv => {
            const participants = conv.participants || [];
            return participants.find(p => p !== userId) || null;
          })
          .filter(Boolean);

        // Batch fetch friend profiles (only uncached ones)
        const profileCache = await fetchFriendProfiles(friendIds);

        // Merge friend profile data with conversation data
        const enrichedConversations = visibleConversations.map(conv => {
          const participants = conv.participants || [];
          const friendId = participants.find(p => p !== userId);
          const friendProfile = friendId ? profileCache.get(friendId) : null;

          return {
            id: conv.id,
            lastMessage: conv.lastMessage,
            updatedAt: conv.updatedAt,
            unreadCount: conv.unreadCount?.[userId] || 0,
            deletedAt: conv.deletedAt,
            participants: conv.participants,
            friendProfile: friendProfile || {
              uid: friendId,
              username: 'unknown',
              displayName: 'Unknown User',
              profilePhotoURL: null,
              nameColor: null,
            },
          };
        });

        // Calculate total unread count across all visible conversations
        const unreadTotal = enrichedConversations.reduce(
          (sum, conv) => sum + (conv.unreadCount || 0),
          0
        );

        setConversations(enrichedConversations);
        setTotalUnreadCount(unreadTotal);
        setLoading(false);
      } else {
        const isPermissionError = result.error?.includes('permission-denied');

        if (isPermissionError && !hasReceivedData) {
          // Transient error: Firestore auth token may not have propagated yet.
          // The onSnapshot listener typically self-recovers within milliseconds.
          // Keep loading=true so the UI shows a loading state instead of empty.
          logger.warn('useMessages: Transient permission error, awaiting recovery', {
            error: result.error,
          });

          // Safety net: if listener doesn't recover within 5s, stop loading
          if (!recoveryTimer) {
            recoveryTimer = setTimeout(() => {
              if (!hasReceivedData) {
                logger.error('useMessages: Permission error did not recover', { userId });
                setLoading(false);
              }
            }, 5000);
          }
        } else {
          logger.error('useMessages: Subscription error', { error: result.error });
          setLoading(false);
        }
      }
    });

    // Cleanup subscription on unmount
    return () => {
      logger.debug('useMessages: Cleaning up subscription', { userId });
      if (recoveryTimer) clearTimeout(recoveryTimer);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [userId, fetchFriendProfiles]);

  /**
   * Optimistic soft delete a conversation.
   * Immediately removes from local state, reverts on service failure.
   *
   * @param {string} conversationId - Conversation ID to delete
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const handleDeleteConversation = useCallback(
    async conversationId => {
      if (!conversationId || !userId) {
        logger.warn('useMessages.handleDeleteConversation: Missing required fields', {
          conversationId,
          userId,
        });
        return { success: false, error: 'Missing required fields' };
      }

      logger.info('useMessages.handleDeleteConversation: Deleting conversation', {
        conversationId,
        userId,
      });

      // Store original conversations for potential revert
      const originalConversations = [...conversations];
      const originalUnreadCount = totalUnreadCount;

      // Optimistic removal: remove conversation from UI
      const deletedConv = conversations.find(c => c.id === conversationId);
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      setTotalUnreadCount(prev => prev - (deletedConv?.unreadCount || 0));

      const result = await softDeleteConversation(conversationId, userId);

      if (result.success) {
        logger.info('useMessages.handleDeleteConversation: Success', { conversationId });
      } else {
        logger.error('useMessages.handleDeleteConversation: Failed, reverting', {
          error: result.error,
        });
        // Revert on failure
        setConversations(originalConversations);
        setTotalUnreadCount(originalUnreadCount);
      }

      return result;
    },
    [userId, conversations, totalUnreadCount]
  );

  return {
    conversations,
    loading,
    totalUnreadCount,
    handleDeleteConversation,
  };
};

export default useMessages;
