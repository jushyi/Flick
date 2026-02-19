/**
 * Message Service
 *
 * Handles all Firestore operations for direct messaging between friends.
 * Conversations use deterministic IDs (sorted participant UIDs joined by underscore).
 * Messages are stored in subcollections under conversation documents.
 *
 * Key features:
 * - Deterministic conversation IDs for 1-on-1 chats
 * - Real-time message and conversation subscriptions
 * - Cursor-based pagination for message history
 * - Soft deletion via per-user timestamp cutoffs
 * - Cloud Function handles metadata updates (unread counts, lastMessage)
 *
 * Data structure:
 * conversations/{lowerUserId_higherUserId}
 * {
 *   participants: [userId1, userId2],
 *   lastMessage: { text, senderId, timestamp, type } | null,
 *   createdAt: Timestamp,
 *   updatedAt: Timestamp,
 *   deletedAt: { [userId]: Timestamp | null },
 *   unreadCount: { [userId]: number },
 * }
 *
 * conversations/{conversationId}/messages/{auto-id}
 * {
 *   senderId: string,
 *   text: string | null,
 *   gifUrl: string | null,
 *   type: 'text' | 'gif',
 *   createdAt: Timestamp,
 * }
 */

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  collection,
  serverTimestamp,
} from '@react-native-firebase/firestore';

import logger from '../../utils/logger';

const db = getFirestore();

/**
 * Generate a deterministic conversation ID from two user IDs.
 * Sorts both IDs alphabetically and joins with underscore.
 * Mirrors friendshipService.generateFriendshipId pattern.
 *
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {string} Conversation ID in format: [lowerUserId]_[higherUserId]
 */
export const generateConversationId = (userId1, userId2) => {
  const [lowerUserId, higherUserId] = [userId1, userId2].sort();
  return `${lowerUserId}_${higherUserId}`;
};

/**
 * Get or create a conversation between two users.
 * Uses deterministic ID so the same conversation is always returned
 * regardless of who initiates it.
 *
 * @param {string} currentUserId - Current user's ID
 * @param {string} friendId - Friend's user ID
 * @returns {Promise<{success: boolean, conversationId?: string, isNew?: boolean, error?: string}>}
 */
export const getOrCreateConversation = async (currentUserId, friendId) => {
  logger.debug('messageService.getOrCreateConversation: Starting', {
    currentUserId,
    friendId,
  });

  try {
    if (!currentUserId || !friendId) {
      logger.warn('messageService.getOrCreateConversation: Missing required fields', {
        currentUserId,
        friendId,
      });
      return { success: false, error: 'Missing required fields' };
    }

    const conversationId = generateConversationId(currentUserId, friendId);
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationSnap = await getDoc(conversationRef);

    if (conversationSnap.exists()) {
      logger.info('messageService.getOrCreateConversation: Existing conversation found', {
        conversationId,
      });
      return { success: true, conversationId, isNew: false };
    }

    // Create new conversation with setDoc (not addDoc — we control the ID)
    const participants = [currentUserId, friendId].sort();

    await setDoc(conversationRef, {
      participants,
      lastMessage: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deletedAt: {
        [currentUserId]: null,
        [friendId]: null,
      },
      unreadCount: {
        [currentUserId]: 0,
        [friendId]: 0,
      },
    });

    logger.info('messageService.getOrCreateConversation: New conversation created', {
      conversationId,
    });

    return { success: true, conversationId, isNew: true };
  } catch (error) {
    logger.error('messageService.getOrCreateConversation: Failed', {
      currentUserId,
      friendId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Send a message in a conversation.
 * Adds the message to the messages subcollection.
 * Does NOT update conversation metadata — Cloud Function handles that atomically.
 *
 * @param {string} conversationId - Conversation document ID
 * @param {string} senderId - Sender's user ID
 * @param {string} text - Message text (null if gif)
 * @param {string|null} gifUrl - GIF URL (null if text)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendMessage = async (conversationId, senderId, text, gifUrl = null) => {
  logger.debug('messageService.sendMessage: Starting', {
    conversationId,
    senderId,
    hasText: !!text,
    hasGif: !!gifUrl,
  });

  try {
    if (!conversationId || !senderId) {
      logger.warn('messageService.sendMessage: Missing required fields', {
        conversationId,
        senderId,
      });
      return { success: false, error: 'Missing required fields' };
    }

    if (!text && !gifUrl) {
      logger.warn('messageService.sendMessage: Message must have text or gif');
      return { success: false, error: 'Message must have text or gif' };
    }

    const type = gifUrl ? 'gif' : 'text';
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');

    const messageData = {
      senderId,
      text: gifUrl ? null : text,
      gifUrl: gifUrl || null,
      type,
      createdAt: serverTimestamp(),
    };

    const messageDoc = await addDoc(messagesRef, messageData);

    logger.info('messageService.sendMessage: Message sent', {
      conversationId,
      messageId: messageDoc.id,
      type,
    });

    return { success: true, messageId: messageDoc.id };
  } catch (error) {
    logger.error('messageService.sendMessage: Failed', {
      conversationId,
      senderId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Mark a conversation as read for a user.
 * Resets the unread count to 0.
 *
 * @param {string} conversationId - Conversation document ID
 * @param {string} userId - User ID marking as read
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const markConversationRead = async (conversationId, userId) => {
  logger.debug('messageService.markConversationRead: Starting', {
    conversationId,
    userId,
  });

  try {
    if (!conversationId || !userId) {
      logger.warn('messageService.markConversationRead: Missing required fields', {
        conversationId,
        userId,
      });
      return { success: false, error: 'Missing required fields' };
    }

    const conversationRef = doc(db, 'conversations', conversationId);

    await updateDoc(conversationRef, {
      [`unreadCount.${userId}`]: 0,
    });

    logger.info('messageService.markConversationRead: Success', {
      conversationId,
      userId,
    });

    return { success: true };
  } catch (error) {
    logger.error('messageService.markConversationRead: Failed', {
      conversationId,
      userId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Soft delete a conversation for a user.
 * Sets the user's deletedAt timestamp and resets unread count.
 * Messages created after this timestamp will still appear if the
 * other user sends new messages.
 *
 * @param {string} conversationId - Conversation document ID
 * @param {string} userId - User ID performing the soft delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const softDeleteConversation = async (conversationId, userId) => {
  logger.debug('messageService.softDeleteConversation: Starting', {
    conversationId,
    userId,
  });

  try {
    if (!conversationId || !userId) {
      logger.warn('messageService.softDeleteConversation: Missing required fields', {
        conversationId,
        userId,
      });
      return { success: false, error: 'Missing required fields' };
    }

    const conversationRef = doc(db, 'conversations', conversationId);

    await updateDoc(conversationRef, {
      [`deletedAt.${userId}`]: serverTimestamp(),
      [`unreadCount.${userId}`]: 0,
    });

    logger.info('messageService.softDeleteConversation: Success', {
      conversationId,
      userId,
    });

    return { success: true };
  } catch (error) {
    logger.error('messageService.softDeleteConversation: Failed', {
      conversationId,
      userId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Fetch a single conversation document.
 *
 * @param {string} conversationId - Conversation document ID
 * @returns {Promise<{success: boolean, conversation?: object, error?: string}>}
 */
export const getConversation = async conversationId => {
  logger.debug('messageService.getConversation: Starting', { conversationId });

  try {
    if (!conversationId) {
      logger.warn('messageService.getConversation: Missing conversationId');
      return { success: false, error: 'Missing conversationId' };
    }

    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationSnap = await getDoc(conversationRef);

    if (!conversationSnap.exists()) {
      logger.warn('messageService.getConversation: Conversation not found', {
        conversationId,
      });
      return { success: false, error: 'Conversation not found' };
    }

    logger.info('messageService.getConversation: Success', { conversationId });

    return {
      success: true,
      conversation: {
        id: conversationSnap.id,
        ...conversationSnap.data(),
      },
    };
  } catch (error) {
    logger.error('messageService.getConversation: Failed', {
      conversationId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};
