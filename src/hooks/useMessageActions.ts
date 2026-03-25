import { useState, useCallback } from 'react';
import { Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';

import { unsendMessage } from '../services/supabase/messageService';
import logger from '../utils/logger';

type MessageLike = {
  id: string;
  [key: string]: unknown;
};

type MenuPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ReactionEntry = {
  senderId: string;
  [key: string]: unknown;
};

type ReactionMap = Map<string, Record<string, ReactionEntry[]>>;

type UseMessageActionsParams = {
  conversationId: string;
  currentUserId: string;
  onSendReaction?: (targetMessageId: string, emoji: string) => void;
  onRemoveReaction?: (targetMessageId: string) => void;
  onSendReply?: (text: string, replyToId: string) => void;
  onDeleteForMe?: (messageId: string) => void;
};

type UseMessageActionsReturn = {
  actionMenuVisible: boolean;
  actionMenuMessage: MessageLike | null;
  actionMenuPosition: MenuPosition | null;
  replyToMessage: MessageLike | null;
  openActionMenu: (message: MessageLike, layout: MenuPosition) => void;
  closeActionMenu: () => void;
  handleReaction: (emoji: string, reactionMap: ReactionMap) => void;
  handleDoubleTapHeart: (messageId: string, reactionMap: ReactionMap) => void;
  startReply: (message: MessageLike) => void;
  cancelReply: () => void;
  handleUnsend: (messageId: string) => Promise<void>;
  handleDeleteForMe: (messageId: string) => void;
};

const useMessageActions = ({
  conversationId,
  currentUserId,
  onSendReaction,
  onRemoveReaction,
  onSendReply: _onSendReply,
  onDeleteForMe,
}: UseMessageActionsParams): UseMessageActionsReturn => {
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [actionMenuMessage, setActionMenuMessage] = useState<MessageLike | null>(null);
  const [actionMenuPosition, setActionMenuPosition] = useState<MenuPosition | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<MessageLike | null>(null);

  const openActionMenu = useCallback((message: MessageLike, layout: MenuPosition) => {
    setActionMenuVisible(true);
    setActionMenuMessage(message);
    setActionMenuPosition(layout);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();
  }, []);

  const closeActionMenu = useCallback(() => {
    setActionMenuVisible(false);
    setActionMenuMessage(null);
    setActionMenuPosition(null);
  }, []);

  const handleReaction = useCallback(
    (emoji: string, reactionMap: ReactionMap) => {
      if (!actionMenuMessage) return;

      const messageReactions = reactionMap?.get(actionMenuMessage.id);
      const emojiReactions = messageReactions?.[emoji] || [];
      const userAlreadyReacted = emojiReactions.some(r => r.senderId === currentUserId);

      if (userAlreadyReacted) {
        onRemoveReaction?.(actionMenuMessage.id);
      } else {
        onSendReaction?.(actionMenuMessage.id, emoji);
      }

      closeActionMenu();
    },
    [actionMenuMessage, currentUserId, onSendReaction, onRemoveReaction, closeActionMenu]
  );

  const handleDoubleTapHeart = useCallback(
    (messageId: string, reactionMap: ReactionMap) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const messageReactions = reactionMap?.get(messageId);
      const heartReactions = messageReactions?.heart || [];
      const userAlreadyReacted = heartReactions.some(r => r.senderId === currentUserId);

      if (userAlreadyReacted) {
        onRemoveReaction?.(messageId);
      } else {
        onSendReaction?.(messageId, 'heart');
      }
    },
    [currentUserId, onSendReaction, onRemoveReaction]
  );

  const startReply = useCallback(
    (message: MessageLike) => {
      setReplyToMessage(message);
      if (actionMenuVisible) {
        closeActionMenu();
      }
    },
    [actionMenuVisible, closeActionMenu]
  );

  const cancelReply = useCallback(() => {
    setReplyToMessage(null);
  }, []);

  const handleUnsend = useCallback(
    async (messageId: string) => {
      closeActionMenu();

      try {
        await unsendMessage(messageId);

        logger.info('useMessageActions.handleUnsend: Message unsent', {
          conversationId,
          messageId,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('useMessageActions.handleUnsend: Failed', {
          conversationId,
          messageId,
          error: message,
        });
      }
    },
    [conversationId, closeActionMenu]
  );

  const handleDeleteForMe = useCallback(
    (messageId: string) => {
      onDeleteForMe?.(messageId);
      closeActionMenu();
    },
    [onDeleteForMe, closeActionMenu]
  );

  return {
    actionMenuVisible,
    actionMenuMessage,
    actionMenuPosition,
    replyToMessage,
    openActionMenu,
    closeActionMenu,
    handleReaction,
    handleDoubleTapHeart,
    startReply,
    cancelReply,
    handleUnsend,
    handleDeleteForMe,
  };
};

export default useMessageActions;
