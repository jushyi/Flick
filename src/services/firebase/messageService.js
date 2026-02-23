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
 *   imageUrl: string | null,
 *   type: 'text' | 'gif' | 'image' | 'reaction',
 *   emoji: string | null,              // For reaction messages: 'heart', 'laugh', etc.
 *   targetMessageId: string | null,    // For reaction messages: ID of the reacted-to message
 *   replyTo: object | null,            // For reply messages: { messageId, senderId, type, text, deleted }
 *   createdAt: Timestamp,
 * }
 */

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
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
 * @param {string} text - Message text (null if gif/image)
 * @param {string|null} gifUrl - GIF URL (null if text/image)
 * @param {string|null} imageUrl - Image URL (null if text/gif)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendMessage = async (
  conversationId,
  senderId,
  text,
  gifUrl = null,
  imageUrl = null
) => {
  logger.debug('messageService.sendMessage: Starting', {
    conversationId,
    senderId,
    hasText: !!text,
    hasGif: !!gifUrl,
    hasImage: !!imageUrl,
  });

  try {
    if (!conversationId || !senderId) {
      logger.warn('messageService.sendMessage: Missing required fields', {
        conversationId,
        senderId,
      });
      return { success: false, error: 'Missing required fields' };
    }

    if (!text && !gifUrl && !imageUrl) {
      logger.warn('messageService.sendMessage: Message must have text, gif, or image');
      return { success: false, error: 'Message must have text, gif, or image' };
    }

    const type = imageUrl ? 'image' : gifUrl ? 'gif' : 'text';
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');

    const messageData = {
      senderId,
      text: gifUrl || imageUrl ? null : text,
      gifUrl: gifUrl || null,
      imageUrl: imageUrl || null,
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
 * Atomically resets the unread count to 0 and writes a readReceipts timestamp.
 * The readReceipts timestamp is used for real-time read receipt indicators.
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
      [`readReceipts.${userId}`]: serverTimestamp(),
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

/**
 * Subscribe to real-time conversation list updates for a user.
 * Returns conversations where the user is a participant, ordered by most recent activity.
 *
 * @param {string} userId - User ID to get conversations for
 * @param {function} callback - Callback receiving { success, conversations } or { success: false, error }
 * @returns {function} Unsubscribe function
 */
export const subscribeToConversations = (userId, callback) => {
  logger.debug('messageService.subscribeToConversations: Starting', { userId });

  if (!userId) {
    logger.error('messageService.subscribeToConversations: Missing userId');
    callback({ success: false, error: 'Missing userId' });
    return () => {};
  }

  try {
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const conversations = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        logger.debug('messageService.subscribeToConversations: Snapshot received', {
          userId,
          conversationCount: conversations.length,
        });

        callback({ success: true, conversations });
      },
      error => {
        logger.error('messageService.subscribeToConversations: Error', {
          userId,
          error: error.message,
        });
        callback({ success: false, error: error.message });
      }
    );

    logger.info('messageService.subscribeToConversations: Subscription active', { userId });

    return unsubscribe;
  } catch (error) {
    logger.error('messageService.subscribeToConversations: Failed to setup', {
      userId,
      error: error.message,
    });
    callback({ success: false, error: error.message });
    return () => {};
  }
};

/**
 * Subscribe to real-time message updates in a conversation.
 * Supports soft-deletion filtering via deletedAtCutoff.
 * Passes lastDoc cursor for pagination handoff to loadMoreMessages.
 *
 * @param {string} conversationId - Conversation document ID
 * @param {function} callback - Callback receiving { success, messages, lastDoc } or { success: false, error }
 * @param {object|null} deletedAtCutoff - Firestore Timestamp cutoff for soft-deletion filtering
 * @param {number} messageLimit - Maximum messages to subscribe to (default: 25)
 * @returns {function} Unsubscribe function
 */
export const subscribeToMessages = (
  conversationId,
  callback,
  deletedAtCutoff = null,
  messageLimit = 25
) => {
  logger.debug('messageService.subscribeToMessages: Starting', {
    conversationId,
    hasDeletedAtCutoff: !!deletedAtCutoff,
    messageLimit,
  });

  if (!conversationId) {
    logger.error('messageService.subscribeToMessages: Missing conversationId');
    callback({ success: false, error: 'Missing conversationId', messages: [] });
    return () => {};
  }

  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');

    const constraints = [];

    if (deletedAtCutoff) {
      constraints.push(where('createdAt', '>', deletedAtCutoff));
    }

    constraints.push(orderBy('createdAt', 'desc'));
    constraints.push(limit(messageLimit));

    const q = query(messagesRef, ...constraints);

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const messages = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

        logger.debug('messageService.subscribeToMessages: Snapshot received', {
          conversationId,
          messageCount: messages.length,
        });

        callback({ success: true, messages, lastDoc });
      },
      error => {
        logger.error('messageService.subscribeToMessages: Error', {
          conversationId,
          error: error.message,
        });
        callback({ success: false, error: error.message, messages: [] });
      }
    );

    logger.info('messageService.subscribeToMessages: Subscription active', {
      conversationId,
    });

    return unsubscribe;
  } catch (error) {
    logger.error('messageService.subscribeToMessages: Failed to setup', {
      conversationId,
      error: error.message,
    });
    callback({ success: false, error: error.message, messages: [] });
    return () => {};
  }
};

/**
 * Load older messages for pagination (cursor-based).
 * Uses getDocs (not onSnapshot) for one-time fetches.
 *
 * @param {string} conversationId - Conversation document ID
 * @param {object} lastDoc - Last DocumentSnapshot from previous page (cursor)
 * @param {object|null} deletedAtCutoff - Firestore Timestamp cutoff for soft-deletion filtering
 * @param {number} messageLimit - Number of messages to load (default: 25)
 * @returns {Promise<{success: boolean, messages?: Array, lastDoc?: object, hasMore?: boolean, error?: string}>}
 */
export const loadMoreMessages = async (
  conversationId,
  lastDoc,
  deletedAtCutoff = null,
  messageLimit = 25
) => {
  logger.debug('messageService.loadMoreMessages: Starting', {
    conversationId,
    hasLastDoc: !!lastDoc,
    hasDeletedAtCutoff: !!deletedAtCutoff,
    messageLimit,
  });

  try {
    if (!conversationId) {
      logger.warn('messageService.loadMoreMessages: Missing conversationId');
      return { success: false, error: 'Missing conversationId' };
    }

    if (!lastDoc) {
      logger.warn('messageService.loadMoreMessages: Missing lastDoc cursor');
      return { success: false, error: 'Missing pagination cursor' };
    }

    const messagesRef = collection(db, 'conversations', conversationId, 'messages');

    const constraints = [];

    if (deletedAtCutoff) {
      constraints.push(where('createdAt', '>', deletedAtCutoff));
    }

    constraints.push(orderBy('createdAt', 'desc'));
    constraints.push(startAfter(lastDoc));
    constraints.push(limit(messageLimit));

    const q = query(messagesRef, ...constraints);
    const snapshot = await getDocs(q);

    const messages = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    const newLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

    logger.info('messageService.loadMoreMessages: Success', {
      conversationId,
      messageCount: messages.length,
      hasMore: messages.length === messageLimit,
    });

    return {
      success: true,
      messages,
      lastDoc: newLastDoc,
      hasMore: messages.length === messageLimit,
    };
  } catch (error) {
    logger.error('messageService.loadMoreMessages: Failed', {
      conversationId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Send a reaction to a message.
 * Creates a separate message document of type 'reaction' linking back to the target message.
 * Does NOT modify the original message document (preserves immutability).
 *
 * @param {string} conversationId - Conversation document ID
 * @param {string} senderId - Sender's user ID
 * @param {string} targetMessageId - ID of the message being reacted to
 * @param {string} emoji - Reaction emoji key: 'heart', 'laugh', 'surprise', 'sad', 'angry', 'thumbs_up'
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendReaction = async (conversationId, senderId, targetMessageId, emoji) => {
  logger.debug('messageService.sendReaction: Starting', {
    conversationId,
    senderId,
    targetMessageId,
    emoji,
  });

  try {
    if (!conversationId || !senderId || !targetMessageId || !emoji) {
      logger.warn('messageService.sendReaction: Missing required fields', {
        conversationId,
        senderId,
        targetMessageId,
        emoji,
      });
      return { success: false, error: 'Missing required fields' };
    }

    const messagesRef = collection(db, 'conversations', conversationId, 'messages');

    const reactionData = {
      senderId,
      type: 'reaction',
      emoji,
      targetMessageId,
      text: null,
      gifUrl: null,
      imageUrl: null,
      createdAt: serverTimestamp(),
    };

    const reactionDoc = await addDoc(messagesRef, reactionData);

    logger.info('messageService.sendReaction: Reaction sent', {
      conversationId,
      messageId: reactionDoc.id,
      emoji,
      targetMessageId,
    });

    return { success: true, messageId: reactionDoc.id };
  } catch (error) {
    logger.error('messageService.sendReaction: Failed', {
      conversationId,
      senderId,
      targetMessageId,
      emoji,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Remove a reaction from a message.
 * Creates a reaction message with emoji: null as a removal sentinel.
 * Client-side aggregation interprets null emoji as "reaction removed".
 * Avoids needing a Cloud Function to delete reaction documents.
 *
 * @param {string} conversationId - Conversation document ID
 * @param {string} senderId - Sender's user ID
 * @param {string} targetMessageId - ID of the message to remove the reaction from
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const removeReaction = async (conversationId, senderId, targetMessageId) => {
  logger.debug('messageService.removeReaction: Starting', {
    conversationId,
    senderId,
    targetMessageId,
  });

  try {
    if (!conversationId || !senderId || !targetMessageId) {
      logger.warn('messageService.removeReaction: Missing required fields', {
        conversationId,
        senderId,
        targetMessageId,
      });
      return { success: false, error: 'Missing required fields' };
    }

    const messagesRef = collection(db, 'conversations', conversationId, 'messages');

    const removalData = {
      senderId,
      type: 'reaction',
      emoji: null,
      targetMessageId,
      text: null,
      gifUrl: null,
      imageUrl: null,
      createdAt: serverTimestamp(),
    };

    await addDoc(messagesRef, removalData);

    logger.info('messageService.removeReaction: Reaction removed', {
      conversationId,
      senderId,
      targetMessageId,
    });

    return { success: true };
  } catch (error) {
    logger.error('messageService.removeReaction: Failed', {
      conversationId,
      senderId,
      targetMessageId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Send a reply message in a conversation.
 * Creates a message with a denormalized replyTo object containing the original
 * message preview. Does NOT store image URLs in replyTo to avoid signed URL expiry.
 *
 * @param {string} conversationId - Conversation document ID
 * @param {string} senderId - Sender's user ID
 * @param {string|null} text - Reply text (null if gif/image)
 * @param {string|null} gifUrl - GIF URL (null if text/image)
 * @param {string|null} imageUrl - Image URL (null if text/gif)
 * @param {object} replyToMessage - Original message being replied to (must have id, senderId, type)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendReply = async (
  conversationId,
  senderId,
  text,
  gifUrl,
  imageUrl,
  replyToMessage
) => {
  logger.debug('messageService.sendReply: Starting', {
    conversationId,
    senderId,
    hasText: !!text,
    hasGif: !!gifUrl,
    hasImage: !!imageUrl,
    replyToMessageId: replyToMessage?.id,
  });

  try {
    if (!conversationId || !senderId) {
      logger.warn('messageService.sendReply: Missing required fields', {
        conversationId,
        senderId,
      });
      return { success: false, error: 'Missing required fields' };
    }

    if (!replyToMessage || !replyToMessage.id || !replyToMessage.senderId || !replyToMessage.type) {
      logger.warn('messageService.sendReply: Invalid replyToMessage', {
        replyToMessage,
      });
      return { success: false, error: 'Invalid replyToMessage: must have id, senderId, and type' };
    }

    const type = imageUrl ? 'image' : gifUrl ? 'gif' : 'text';
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');

    const messageData = {
      senderId,
      text: gifUrl || imageUrl ? null : text,
      gifUrl: gifUrl || null,
      imageUrl: imageUrl || null,
      type,
      replyTo: {
        messageId: replyToMessage.id,
        senderId: replyToMessage.senderId,
        type: replyToMessage.type,
        text: replyToMessage.type === 'text' ? (replyToMessage.text || '').substring(0, 100) : null,
        deleted: false,
      },
      createdAt: serverTimestamp(),
    };

    const messageDoc = await addDoc(messagesRef, messageData);

    logger.info('messageService.sendReply: Reply sent', {
      conversationId,
      messageId: messageDoc.id,
      type,
      replyToMessageId: replyToMessage.id,
    });

    return { success: true, messageId: messageDoc.id };
  } catch (error) {
    logger.error('messageService.sendReply: Failed', {
      conversationId,
      senderId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Delete a message for the current user only.
 * Adds the message ID to the conversation's deletedMessages array for the user.
 * The message remains visible to the other participant.
 *
 * @param {string} conversationId - Conversation document ID
 * @param {string} userId - User ID performing the delete
 * @param {string} messageId - ID of the message to hide
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteMessageForMe = async (conversationId, userId, messageId) => {
  logger.debug('messageService.deleteMessageForMe: Starting', {
    conversationId,
    userId,
    messageId,
  });

  try {
    if (!conversationId || !userId || !messageId) {
      logger.warn('messageService.deleteMessageForMe: Missing required fields', {
        conversationId,
        userId,
        messageId,
      });
      return { success: false, error: 'Missing required fields' };
    }

    const conversationRef = doc(db, 'conversations', conversationId);

    await updateDoc(conversationRef, {
      [`deletedMessages.${userId}`]: arrayUnion(messageId),
    });

    logger.info('messageService.deleteMessageForMe: Message deleted for user', {
      conversationId,
      userId,
      messageId,
    });

    return { success: true };
  } catch (error) {
    logger.error('messageService.deleteMessageForMe: Failed', {
      conversationId,
      userId,
      messageId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};
