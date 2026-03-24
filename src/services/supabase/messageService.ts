/**
 * Message Service (Supabase) -- STUB
 *
 * This is a stub file created by Plan 03 to satisfy imports from snapService.
 * The full implementation is created by Plan 02 (messageService).
 * This file will be overwritten when Plan 02 merges.
 */

export type MessageType = 'text' | 'reaction' | 'reply' | 'snap' | 'tagged_photo';

export const sendMessage = async (_params: {
  conversationId: string;
  senderId: string;
  text?: string | null;
  gifUrl?: string | null;
  type?: MessageType;
}): Promise<{ messageId: string }> => {
  throw new Error('messageService stub -- not implemented');
};
