/**
 * Message Service (Supabase)
 *
 * Handles all conversation and message operations via Supabase.
 * Conversations use deterministic IDs (sorted participant UIDs joined by underscore).
 * Messages support 5 types: text, reaction, reply, snap, tagged_photo.
 *
 * Error handling: functions throw on error (TanStack catches at hook level).
 * No {success, error} wrapper -- uses the Phase 15 throw-on-error pattern.
 */

import { supabase } from '@/lib/supabase';

import logger from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface ConversationRow {
  id: string;
  participant1_id: string;
  participant2_id: string;
  last_message_text: string | null;
  last_message_at: string | null;
  last_message_type: string | null;
  last_message_sender_id: string | null;
  unread_count_p1: number;
  unread_count_p2: number;
  deleted_at_p1: string | null;
  deleted_at_p2: string | null;
  last_read_at_p1: string | null;
  last_read_at_p2: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: MessageType;
  text: string | null;
  gif_url: string | null;
  reply_to_id: string | null;
  snap_storage_path: string | null;
  snap_viewed_at: string | null;
  tagged_photo_id: string | null;
  unsent_at: string | null;
  emoji: string | null;
  reply_preview: { sender_id: string; type: string; text: string | null } | null;
  created_at: string;
}

export type MessageType = 'text' | 'reaction' | 'reply' | 'snap' | 'tagged_photo';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a deterministic conversation ID from two user IDs.
 * Sorts both IDs lexicographically and joins with underscore.
 * Satisfies CHECK(participant1_id < participant2_id) constraint.
 */
export function generateConversationId(userId1: string, userId2: string): string {
  const [lower, higher] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
  return `${lower}_${higher}`;
}

/**
 * Determine participant position (p1 or p2) given a user ID and conversation row.
 * Returns 1 if user is participant1, 2 if participant2.
 * Throws if user is not a participant.
 */
function getParticipantPosition(
  conversationId: string,
  userId: string,
  conversation: ConversationRow
): 1 | 2 {
  if (conversation.participant1_id === userId) return 1;
  if (conversation.participant2_id === userId) return 2;
  throw new Error(
    `User ${userId} is not a participant in conversation ${conversationId}`
  );
}

// ============================================================================
// Conversation operations
// ============================================================================

/**
 * Get or create a conversation between two users.
 * Uses upsert with deterministic ID to avoid duplicates.
 * participant1_id is always the lexicographically lower ID.
 */
export async function getOrCreateConversation(
  currentUserId: string,
  friendId: string
): Promise<ConversationRow> {
  const [p1, p2] =
    currentUserId < friendId
      ? [currentUserId, friendId]
      : [friendId, currentUserId];

  const conversationId = generateConversationId(currentUserId, friendId);

  const { data, error } = await (supabase as any)
    .from('conversations')
    .upsert(
      {
        id: conversationId,
        participant1_id: p1,
        participant2_id: p2,
      },
      { onConflict: 'participant1_id,participant2_id' }
    )
    .select()
    .single();

  if (error) {
    logger.error('messageService.getOrCreateConversation: Failed', {
      currentUserId,
      friendId,
      error: error.message,
    });
    throw new Error(error.message);
  }

  logger.info('messageService.getOrCreateConversation: Success', {
    conversationId: data.id,
  });
  return data as ConversationRow;
}

/**
 * Get a single conversation by ID.
 */
export async function getConversation(
  conversationId: string
): Promise<ConversationRow> {
  const { data, error } = await (supabase as any)
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (error) {
    logger.error('messageService.getConversation: Failed', {
      conversationId,
      error: error.message,
    });
    throw new Error(error.message);
  }

  return data as ConversationRow;
}

/**
 * Mark a conversation as read for the given user.
 * Updates last_read_at and resets unread_count for the correct participant position.
 */
export async function markConversationRead(
  conversationId: string,
  userId: string
): Promise<void> {
  // Fetch conversation to determine participant position
  const conversation = await getConversation(conversationId);
  const position = getParticipantPosition(conversationId, userId, conversation);

  const now = new Date().toISOString();
  const updateData =
    position === 1
      ? { last_read_at_p1: now, unread_count_p1: 0 }
      : { last_read_at_p2: now, unread_count_p2: 0 };

  const { error } = await (supabase as any)
    .from('conversations')
    .update(updateData)
    .eq('id', conversationId);

  if (error) {
    logger.error('messageService.markConversationRead: Failed', {
      conversationId,
      userId,
      error: error.message,
    });
    throw new Error(error.message);
  }

  logger.info('messageService.markConversationRead: Success', {
    conversationId,
    userId,
    position,
  });
}

/**
 * Soft-delete a conversation for the given user.
 * Sets deleted_at_p1 or deleted_at_p2 based on participant position.
 */
export async function softDeleteConversation(
  conversationId: string,
  userId: string
): Promise<void> {
  const conversation = await getConversation(conversationId);
  const position = getParticipantPosition(conversationId, userId, conversation);

  const now = new Date().toISOString();
  const updateData =
    position === 1 ? { deleted_at_p1: now } : { deleted_at_p2: now };

  const { error } = await (supabase as any)
    .from('conversations')
    .update(updateData)
    .eq('id', conversationId);

  if (error) {
    logger.error('messageService.softDeleteConversation: Failed', {
      conversationId,
      userId,
      error: error.message,
    });
    throw new Error(error.message);
  }

  logger.info('messageService.softDeleteConversation: Success', {
    conversationId,
    userId,
    position,
  });
}

// ============================================================================
// Message operations
// ============================================================================

/**
 * Send a text message (or gif). Default type is 'text'.
 * Returns the inserted message ID.
 */
export async function sendMessage(params: {
  conversationId: string;
  senderId: string;
  text?: string | null;
  gifUrl?: string | null;
  type?: MessageType;
}): Promise<{ messageId: string }> {
  const { conversationId, senderId, text = null, gifUrl = null, type = 'text' } = params;

  const { data, error } = await (supabase as any)
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      type,
      text,
      gif_url: gifUrl,
    })
    .select('id')
    .single();

  if (error) {
    logger.error('messageService.sendMessage: Failed', {
      conversationId,
      senderId,
      error: error.message,
    });
    throw new Error(error.message);
  }

  logger.info('messageService.sendMessage: Success', {
    conversationId,
    messageId: data.id,
    type,
  });
  return { messageId: data.id };
}

/**
 * Send a reaction to a message.
 * Inserts a type='reaction' message with emoji and reply_to_id pointing to target message.
 */
export async function sendReaction(
  conversationId: string,
  senderId: string,
  targetMessageId: string,
  emoji: string
): Promise<{ messageId: string }> {
  const { data, error } = await (supabase as any)
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      type: 'reaction' as MessageType,
      reply_to_id: targetMessageId,
      emoji,
    })
    .select('id')
    .single();

  if (error) {
    logger.error('messageService.sendReaction: Failed', {
      conversationId,
      senderId,
      targetMessageId,
      error: error.message,
    });
    throw new Error(error.message);
  }

  logger.info('messageService.sendReaction: Success', {
    conversationId,
    messageId: data.id,
    emoji,
  });
  return { messageId: data.id };
}

/**
 * Remove a reaction by marking it as unsent.
 * Finds the active reaction message and sets unsent_at.
 */
export async function removeReaction(
  conversationId: string,
  senderId: string,
  targetMessageId: string
): Promise<void> {
  // Find the active (non-unsent) reaction
  const { data: reaction, error: findError } = await (supabase as any)
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('sender_id', senderId)
    .eq('reply_to_id', targetMessageId)
    .eq('type', 'reaction')
    .is('unsent_at', null)
    .single();

  if (findError) {
    logger.error('messageService.removeReaction: Failed to find reaction', {
      conversationId,
      senderId,
      targetMessageId,
      error: findError.message,
    });
    throw new Error(findError.message);
  }

  const { error: updateError } = await (supabase as any)
    .from('messages')
    .update({ unsent_at: new Date().toISOString() })
    .eq('id', reaction.id);

  if (updateError) {
    logger.error('messageService.removeReaction: Failed to unsend', {
      reactionId: reaction.id,
      error: updateError.message,
    });
    throw new Error(updateError.message);
  }

  logger.info('messageService.removeReaction: Success', {
    conversationId,
    reactionId: reaction.id,
  });
}

/**
 * Send a reply to a message.
 * Inserts type='reply' message with reply_to_id and reply_preview JSONB.
 */
export async function sendReply(params: {
  conversationId: string;
  senderId: string;
  text: string;
  replyToId: string;
  replyPreview: { sender_id: string; type: string; text: string | null };
}): Promise<{ messageId: string }> {
  const { conversationId, senderId, text, replyToId, replyPreview } = params;

  const { data, error } = await (supabase as any)
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      type: 'reply' as MessageType,
      text,
      reply_to_id: replyToId,
      reply_preview: replyPreview,
    })
    .select('id')
    .single();

  if (error) {
    logger.error('messageService.sendReply: Failed', {
      conversationId,
      senderId,
      replyToId,
      error: error.message,
    });
    throw new Error(error.message);
  }

  logger.info('messageService.sendReply: Success', {
    conversationId,
    messageId: data.id,
  });
  return { messageId: data.id };
}

/**
 * Send a tagged photo message.
 * Inserts type='tagged_photo' message with tagged_photo_id.
 */
export async function sendTaggedPhotoMessage(
  conversationId: string,
  senderId: string,
  taggedPhotoId: string
): Promise<{ messageId: string }> {
  const { data, error } = await (supabase as any)
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      type: 'tagged_photo' as MessageType,
      tagged_photo_id: taggedPhotoId,
    })
    .select('id')
    .single();

  if (error) {
    logger.error('messageService.sendTaggedPhotoMessage: Failed', {
      conversationId,
      senderId,
      taggedPhotoId,
      error: error.message,
    });
    throw new Error(error.message);
  }

  logger.info('messageService.sendTaggedPhotoMessage: Success', {
    conversationId,
    messageId: data.id,
    taggedPhotoId,
  });
  return { messageId: data.id };
}

/**
 * Get messages for a conversation with cursor-based pagination.
 * Filters out messages the user has deleted-for-me (via message_deletions).
 * Returns messages ordered by created_at DESC.
 */
export async function getMessages(
  conversationId: string,
  userId: string,
  options?: { cursor?: string; limit?: number }
): Promise<MessageRow[]> {
  const pageLimit = options?.limit ?? 25;

  // Build messages query
  let query = (supabase as any)
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(pageLimit);

  if (options?.cursor) {
    query = query.lt('created_at', options.cursor);
  }

  const { data: messages, error: msgError } = await query;

  if (msgError) {
    logger.error('messageService.getMessages: Failed to fetch messages', {
      conversationId,
      error: msgError.message,
    });
    throw new Error(msgError.message);
  }

  if (!messages || messages.length === 0) {
    return [];
  }

  // Fetch user's message_deletions to filter client-side
  const messageIds = messages.map((m: MessageRow) => m.id);
  const { data: deletions, error: delError } = await (supabase as any)
    .from('message_deletions')
    .select('message_id')
    .eq('user_id', userId)
    .in('message_id', messageIds);

  if (delError) {
    logger.error('messageService.getMessages: Failed to fetch deletions', {
      conversationId,
      error: delError.message,
    });
    throw new Error(delError.message);
  }

  // Filter out deleted-for-me messages
  const deletedIds = new Set(
    (deletions || []).map((d: { message_id: string }) => d.message_id)
  );
  const filtered = messages.filter((m: MessageRow) => !deletedIds.has(m.id));

  logger.info('messageService.getMessages: Success', {
    conversationId,
    total: messages.length,
    afterFilter: filtered.length,
  });
  return filtered as MessageRow[];
}

/**
 * Unsend a message by setting unsent_at.
 * RLS ensures only the sender can update their own messages.
 */
export async function unsendMessage(messageId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('messages')
    .update({ unsent_at: new Date().toISOString() })
    .eq('id', messageId);

  if (error) {
    logger.error('messageService.unsendMessage: Failed', {
      messageId,
      error: error.message,
    });
    throw new Error(error.message);
  }

  logger.info('messageService.unsendMessage: Success', { messageId });
}

/**
 * Delete a message for the current user only (hide from their view).
 * Inserts into message_deletions table.
 */
export async function deleteMessageForMe(
  messageId: string,
  userId: string
): Promise<void> {
  const { error } = await (supabase as any)
    .from('message_deletions')
    .insert({ message_id: messageId, user_id: userId });

  if (error) {
    logger.error('messageService.deleteMessageForMe: Failed', {
      messageId,
      userId,
      error: error.message,
    });
    throw new Error(error.message);
  }

  logger.info('messageService.deleteMessageForMe: Success', {
    messageId,
    userId,
  });
}
