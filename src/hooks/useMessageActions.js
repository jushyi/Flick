/**
 * useMessageActions Hook
 *
 * Manages interaction state for message actions including:
 * - Long-press action menu visibility and positioning
 * - Reply mode (which message is being replied to)
 * - Reaction dispatch (send/toggle reactions)
 * - Unsend via Cloud Function
 * - Delete for me
 *
 * This hook bridges the service layer with the UI components,
 * providing state management for overlays and interaction flows.
 */
import { useState, useCallback } from 'react';
import { Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';

import { getFunctions, httpsCallable } from '@react-native-firebase/functions';

import logger from '../utils/logger';

/**
 * useMessageActions Hook
 *
 * @param {object} params
 * @param {string} params.conversationId - Conversation document ID
 * @param {string} params.currentUserId - Current user's UID
 * @param {function} params.onSendReaction - Callback to send a reaction (targetMessageId, emoji)
 * @param {function} params.onRemoveReaction - Callback to remove a reaction (targetMessageId)
 * @param {function} params.onSendReply - Callback to send a reply
 * @param {function} params.onDeleteForMe - Callback to delete a message for the current user
 * @returns {object} - Action menu state and interaction handlers
 */
const useMessageActions = ({
  conversationId,
  currentUserId,
  onSendReaction,
  onRemoveReaction,
  onSendReply,
  onDeleteForMe,
}) => {
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [actionMenuMessage, setActionMenuMessage] = useState(null);
  const [actionMenuPosition, setActionMenuPosition] = useState(null);
  const [replyToMessage, setReplyToMessage] = useState(null);

  /**
   * Open the action menu for a long-pressed message.
   * Triggers medium haptic feedback and dismisses the keyboard.
   *
   * @param {object} message - The message that was long-pressed (full message object)
   * @param {object} layout - Position of the message bubble: { x, y, width, height }
   */
  const openActionMenu = useCallback((message, layout) => {
    setActionMenuVisible(true);
    setActionMenuMessage(message);
    setActionMenuPosition(layout);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();
  }, []);

  /**
   * Close the action menu and reset all menu-related state.
   */
  const closeActionMenu = useCallback(() => {
    setActionMenuVisible(false);
    setActionMenuMessage(null);
    setActionMenuPosition(null);
  }, []);

  /**
   * Handle a reaction selection from the reaction picker.
   * If the user already reacted with the same emoji on this message,
   * toggles the reaction off (removes it). Otherwise sends the reaction.
   * Closes the action menu after dispatching.
   *
   * @param {string} emoji - Reaction emoji key ('heart', 'laugh', etc.)
   * @param {Map} reactionMap - Reaction aggregation map from useConversation
   */
  const handleReaction = useCallback(
    (emoji, reactionMap) => {
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

  /**
   * Handle a double-tap heart reaction shortcut.
   * Toggles the heart reaction: sends if not present, removes if already reacted.
   * Triggers light haptic feedback.
   *
   * @param {string} messageId - ID of the message to react to
   * @param {Map} reactionMap - Reaction aggregation map from useConversation
   */
  const handleDoubleTapHeart = useCallback(
    (messageId, reactionMap) => {
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

  /**
   * Start replying to a message.
   * Sets the reply target and closes the action menu if open.
   * The caller is responsible for focusing the input via ref.
   *
   * @param {object} message - The message being replied to
   */
  const startReply = useCallback(
    message => {
      setReplyToMessage(message);
      if (actionMenuVisible) {
        closeActionMenu();
      }
    },
    [actionMenuVisible, closeActionMenu]
  );

  /**
   * Cancel the current reply mode.
   */
  const cancelReply = useCallback(() => {
    setReplyToMessage(null);
  }, []);

  /**
   * Unsend a message via the unsendMessage Cloud Function.
   * Closes the action menu. Handles errors gracefully (logs, does not crash).
   *
   * @param {string} messageId - ID of the message to unsend
   */
  const handleUnsend = useCallback(
    async messageId => {
      closeActionMenu();

      try {
        const functions = getFunctions();
        const unsendMessage = httpsCallable(functions, 'unsendMessage');
        await unsendMessage({ conversationId, messageId });

        logger.info('useMessageActions.handleUnsend: Message unsent', {
          conversationId,
          messageId,
        });
      } catch (error) {
        logger.error('useMessageActions.handleUnsend: Failed', {
          conversationId,
          messageId,
          error: error.message,
        });
      }
    },
    [conversationId, closeActionMenu]
  );

  /**
   * Delete a message for the current user only.
   * Closes the action menu.
   *
   * @param {string} messageId - ID of the message to delete
   */
  const handleDeleteForMe = useCallback(
    messageId => {
      onDeleteForMe?.(messageId);
      closeActionMenu();
    },
    [onDeleteForMe, closeActionMenu]
  );

  return {
    // State
    actionMenuVisible,
    actionMenuMessage,
    actionMenuPosition,
    replyToMessage,

    // Actions
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
