/**
 * ConversationScreen -- Chat Thread
 *
 * The core DM experience: displays message history with real-time updates,
 * supports text, GIF, and image sending, handles keyboard interaction, and provides
 * pagination for older messages via an inverted FlatList.
 *
 * Phase 2 additions: reactions (double-tap heart, long-press picker),
 * replies (swipe-to-reply, reply preview above input), deletion (unsend, delete for me),
 * scroll-to-message on reply tap, highlighted message flash.
 *
 * Phase 3 additions: snap message support (SnapBubble delegation via MessageBubble,
 * SnapViewer overlay, camera button in DMInput, autoOpenSnapId from notifications).
 *
 * Phase 17 migration: Firebase data sources replaced with Supabase hooks.
 * useConversation (TanStack + Realtime), useStreak (PowerSync), screenshot
 * notifications via Supabase insert.
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery as usePowerSyncQuery } from '@powersync/react';

import { supabase } from '@/lib/supabase';

import ConversationHeader from '../components/ConversationHeader';
import MessageBubble from '../components/MessageBubble';
import ReadReceiptIndicator from '../components/ReadReceiptIndicator';
import TimeDivider from '../components/TimeDivider';
import DMInput from '../components/DMInput';
import PixelSpinner from '../components/PixelSpinner';
import ReactionPicker from '../components/ReactionPicker';
import PixelConfirmDialog from '../components/PixelConfirmDialog';
import SnapViewer from '../components/SnapViewer';
import SystemMessage from '../components/SystemMessage';

import { useAuth } from '../context/AuthContext';
import { usePhotoDetailActions } from '../context/PhotoDetailContext';
import { useConversation } from '../hooks/useConversation';
import useMessageActions from '../hooks/useMessageActions';
import useScreenshotDetection from '../hooks/useScreenshotDetection';
import { useStreak } from '../hooks/useStreaks';

import { colors } from '../constants/colors';
import logger from '../utils/logger';

// ============================================================================
// Helpers: Adapt Supabase snake_case messages to camelCase for components
// ============================================================================

/**
 * Map a Supabase MessageRow (snake_case) to the camelCase shape expected
 * by MessageBubble, SnapBubble, TaggedPhotoBubble, and ConversationScreen.
 */
function adaptMessage(msg) {
  if (!msg) return null;

  const adapted = {
    id: msg.id,
    senderId: msg.sender_id,
    type: msg.type,
    text: msg.text,
    gifUrl: msg.gif_url,
    imageUrl: null, // Images stored as gif_url in new schema
    createdAt: msg.created_at ? new Date(msg.created_at) : null,
    emoji: msg.emoji,
    // Snap fields
    viewedAt: msg.snap_viewed_at ? new Date(msg.snap_viewed_at) : null,
    snapStoragePath: msg.snap_storage_path,
    screenshottedAt: null, // Will be populated by separate query if needed
    pinned: false,
    // Tagged photo fields
    photoId: msg.tagged_photo_id,
    photoURL: null, // Will be resolved from tagged_photo_id
    photoOwnerId: null,
    addedToFeedBy: {},
    // Reply fields
    replyTo: null,
    // Unsent state
    _isUnsent: !!msg.unsent_at,
    _isDeletedForMe: false,
  };

  // Build replyTo from reply_preview + reply_to_id
  if (msg.reply_to_id && msg.reply_preview) {
    adapted.replyTo = {
      messageId: msg.reply_to_id,
      senderId: msg.reply_preview.sender_id,
      text: msg.reply_preview.text,
      type: msg.reply_preview.type,
      deleted: false,
    };
  }

  // Unsent messages: clear content
  if (msg.unsent_at) {
    adapted.text = null;
    adapted.gifUrl = null;
    adapted.imageUrl = null;
  }

  return adapted;
}

/**
 * Build a reactionMap from reaction-type messages.
 * Shape: Map<targetMessageId, { [emoji]: [{ senderId, messageId }] }>
 */
function buildReactionMap(rawMessages) {
  const map = new Map();

  const reactionMsgs = rawMessages
    .filter(msg => msg.type === 'reaction' && msg.reply_to_id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Track latest reaction per user per target
  const latestByUserTarget = new Map();

  reactionMsgs.forEach(msg => {
    const targetId = msg.reply_to_id; // Reactions store target in reply_to_id
    const key = `${targetId}_${msg.sender_id}`;
    latestByUserTarget.set(key, {
      emoji: msg.emoji,
      messageId: msg.id,
      senderId: msg.sender_id,
    });
  });

  // Build aggregated map from latest reactions only
  latestByUserTarget.forEach(({ emoji, messageId, senderId }, key) => {
    const targetId = key.split('_')[0];
    if (!emoji) return; // null emoji = removed reaction
    if (!map.has(targetId)) map.set(targetId, {});
    const targetReactions = map.get(targetId);
    if (!targetReactions[emoji]) targetReactions[emoji] = [];
    targetReactions[emoji].push({ senderId, messageId });
  });

  return map;
}

// ============================================================================
// Empty state component
// ============================================================================

/**
 * Empty state shown when no messages exist in the conversation.
 * Rendered outside the inverted FlatList to avoid cross-platform transform issues.
 */
const EmptyConversation = ({ displayName }) => (
  <View style={styles.emptyStateWrapper}>
    <Text style={styles.emptyText}>{`Say hi to ${displayName || 'them'}!`}</Text>
  </View>
);

// ============================================================================
// Main screen component
// ============================================================================

const ConversationScreen = () => {
  const { user, userProfile } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const { conversationId, friendProfile } = route.params;

  // Derive friendId from conversationId when not passed (e.g., deep link navigation).
  // Conversation IDs are formatted as [lowerUserId]_[higherUserId].
  const paramFriendId = route.params?.friendId;
  const derivedFriendId = React.useMemo(() => {
    if (paramFriendId) return paramFriendId;
    if (!conversationId || !user?.uid) return null;
    const parts = conversationId.split('_');
    if (parts.length !== 2) return null;
    return parts[0] === user.uid ? parts[1] : parts[0];
  }, [paramFriendId, conversationId, user?.uid]);
  const friendId = derivedFriendId;

  // Friend profile: use passed nav param and fetch fresh from Supabase
  const [liveFriendProfile, setLiveFriendProfile] = useState(friendProfile);

  useEffect(() => {
    if (!friendId) return;
    let cancelled = false;
    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, username, display_name, profile_photo_path, read_receipts_enabled')
          .eq('id', friendId)
          .single();
        if (error) throw error;
        if (data && !cancelled) {
          setLiveFriendProfile({
            uid: friendId,
            username: data.username || friendProfile?.username || 'unknown',
            displayName: data.display_name || friendProfile?.displayName || 'Unknown User',
            profilePhotoURL: data.profile_photo_path || null,
            nameColor: null,
            readReceiptsEnabled: data.read_receipts_enabled !== false,
          });
        }
      } catch (err) {
        logger.warn('ConversationScreen: Failed to fetch fresh friend profile', {
          friendId,
          error: err.message,
        });
      }
    };
    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [friendId, friendProfile?.username, friendProfile?.displayName]);

  // --- PhotoDetail actions for tagged photo navigation ---
  const { openPhotoDetail } = usePhotoDetailActions();

  // --- Screenshot detection via ref (handler defined later via useCallback) ---
  const screenshotHandlerRef = useRef(null);
  useScreenshotDetection({ active: true, onScreenshot: () => screenshotHandlerRef.current?.() });

  // --- Conversation metadata from PowerSync (for read receipts) ---
  const { data: conversationRows } = usePowerSyncQuery('SELECT * FROM conversations WHERE id = ?', [
    conversationId,
  ]);
  const conversation = conversationRows?.[0] ?? null;

  // --- Streak data for header and DMInput ---
  const { state: streakState, dayCount: streakDayCount } = useStreak(friendId);

  // --- Data hooks (Supabase via TanStack + Realtime) ---
  const {
    messages: rawMessages,
    isLoading: loading,
    hasNextPage: hasMore,
    fetchNextPage: loadMore,
    isFetchingNextPage: loadingMore,
    sendMessage: hookSendMessage,
    sendReaction: hookSendReaction,
    removeReaction: hookRemoveReaction,
    sendReply: hookSendReply,
    unsendMessage: hookUnsendMessage,
    deleteMessage: hookDeleteMessage,
    getSnapUrl: _getSnapUrl, // Available for SnapViewer URL resolution
    sendTaggedPhoto: _sendTaggedPhoto, // Available for tagged photo message sending
  } = useConversation(conversationId);

  // --- Build reactionMap from raw messages (includes reaction-type messages) ---
  const reactionMap = useMemo(() => buildReactionMap(rawMessages), [rawMessages]);

  // --- Adapt messages: filter reactions, map snake_case -> camelCase ---
  const messages = useMemo(() => {
    return rawMessages
      .filter(msg => msg.type !== 'reaction')
      .map(adaptMessage)
      .filter(Boolean);
  }, [rawMessages]);

  // --- Adapter functions: bridge old callback signatures to new hook ---
  const handleSendMessage = useCallback(
    async (text, gifUrl, imageUrl) => {
      await hookSendMessage(text, gifUrl || undefined);
    },
    [hookSendMessage]
  );

  const handleSendReaction = useCallback(
    async (targetMessageId, emoji) => {
      await hookSendReaction(targetMessageId, emoji);
    },
    [hookSendReaction]
  );

  const handleRemoveReaction = useCallback(
    async targetMessageId => {
      await hookRemoveReaction(targetMessageId);
    },
    [hookRemoveReaction]
  );

  const handleSendReply = useCallback(
    async (text, gifUrl, imageUrl, replyToMessage) => {
      const replyPreview = {
        sender_id: replyToMessage.senderId,
        type: replyToMessage.type || 'text',
        text: replyToMessage.text || null,
      };
      await hookSendReply(text, replyToMessage.id, replyPreview);
    },
    [hookSendReply]
  );

  const handleDeleteForMe = useCallback(
    async messageId => {
      await hookDeleteMessage(messageId);
    },
    [hookDeleteMessage]
  );

  const flatListRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const messagesWithDividersRef = useRef([]);
  const [visibleTimestamps, setVisibleTimestamps] = useState(new Set());
  const isReadOnly = route.params?.readOnly || false;

  // --- SnapViewer state ---
  const [snapViewerMessage, setSnapViewerMessage] = useState(null);
  const [snapSourceRect, setSnapSourceRect] = useState(null);
  const autoOpenSnapHandled = useRef(false);

  // --- Message actions hook ---
  // Wire unsend to new Supabase hook instead of Firebase Cloud Function
  const {
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
    handleUnsend: _handleUnsendFromActions,
    handleDeleteForMe: triggerDeleteForMe,
  } = useMessageActions({
    conversationId,
    currentUserId: user.uid,
    onSendReaction: handleSendReaction,
    onRemoveReaction: handleRemoveReaction,
    onSendReply: handleSendReply,
    onDeleteForMe: handleDeleteForMe,
  });

  // Override unsend to use Supabase directly instead of Firebase Cloud Function
  const handleUnsend = useCallback(
    async messageId => {
      closeActionMenu();
      try {
        await hookUnsendMessage(messageId);
        logger.info('ConversationScreen: Message unsent via Supabase', {
          conversationId,
          messageId,
        });
      } catch (error) {
        logger.error('ConversationScreen: Unsend failed', {
          conversationId,
          messageId,
          error: error.message,
        });
      }
    },
    [conversationId, closeActionMenu, hookUnsendMessage]
  );

  // --- Delete confirmation dialog state ---
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [pendingDeleteMessageId, setPendingDeleteMessageId] = useState(null);

  // --- Scroll-to-message highlight state ---
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  /**
   * Scroll the inverted FlatList to offset 0 (newest messages).
   * Small delay allows FlatList to process the new item before scrolling.
   */
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 100);
  }, []);

  /**
   * Track scroll position to determine if user is near the bottom.
   * In an inverted list, contentOffset.y near 0 = viewing newest messages.
   * Threshold of 150 (~3-4 message bubbles) provides a comfortable buffer.
   */
  const handleScroll = useCallback(event => {
    const offsetY = event.nativeEvent.contentOffset.y;
    isNearBottomRef.current = offsetY < 150;
  }, []);

  /**
   * Auto-scroll to bottom when new messages arrive and user is near bottom.
   * Does NOT force-scroll when user has scrolled up to read older messages.
   */
  useEffect(() => {
    const currentCount = messages.length;
    if (currentCount > prevMessageCountRef.current && isNearBottomRef.current) {
      scrollToBottom();
    }
    prevMessageCountRef.current = currentCount;
  }, [messages.length, scrollToBottom]);

  /**
   * Auto-open SnapViewer from notification deep link.
   * When route.params.autoOpenSnapId is set, find the snap message in the
   * messages list and auto-open the SnapViewer once found.
   */
  useEffect(() => {
    const autoOpenSnapId = route.params?.autoOpenSnapId;
    if (!autoOpenSnapId || autoOpenSnapHandled.current === autoOpenSnapId) return;

    const tryOpen = () => {
      if (autoOpenSnapHandled.current === autoOpenSnapId) return true;
      const snapMsg = messages.find(m => m.id === autoOpenSnapId && m.type === 'snap');
      if (snapMsg) {
        autoOpenSnapHandled.current = autoOpenSnapId;
        setTimeout(() => {
          setSnapViewerMessage(snapMsg);
        }, 300);
        return true;
      }
      return false;
    };

    if (messages.length && tryOpen()) return;

    // Polling fallback: retry every 500ms for up to 5 seconds
    let elapsed = 0;
    const POLL_INTERVAL = 500;
    const MAX_WAIT = 5000;

    const intervalId = setInterval(async () => {
      elapsed += POLL_INTERVAL;

      if (tryOpen()) {
        clearInterval(intervalId);
        return;
      }

      // After max wait, attempt direct Supabase fetch as last resort
      if (elapsed >= MAX_WAIT) {
        clearInterval(intervalId);
        if (autoOpenSnapHandled.current === autoOpenSnapId) return;

        logger.info(
          'ConversationScreen: Snap not found in messages after polling, fetching directly',
          { autoOpenSnapId, conversationId }
        );

        try {
          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('id', autoOpenSnapId)
            .eq('conversation_id', conversationId)
            .single();

          if (error) throw error;

          if (data && autoOpenSnapHandled.current !== autoOpenSnapId) {
            if (data.type === 'snap') {
              autoOpenSnapHandled.current = autoOpenSnapId;
              setSnapViewerMessage(adaptMessage(data));
            } else {
              logger.warn('ConversationScreen: autoOpenSnapId message is not a snap', {
                autoOpenSnapId,
                type: data.type,
              });
            }
          }
        } catch (err) {
          logger.error('ConversationScreen: Failed to fetch snap message directly', {
            autoOpenSnapId,
            error: err.message,
          });
        }
      }
    }, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [messages, route.params?.autoOpenSnapId, conversationId]);

  /**
   * Derive read receipt state for the sender's last message.
   * Privacy: both users must have readReceiptsEnabled !== false for "Read" to show.
   *
   * Note: In Supabase, read receipts are tracked via last_read_at_p1/p2 on conversations
   * table, but these are not in PowerSync. Read status is best-effort until conversation
   * metadata is queried from Supabase.
   */
  const lastSentMessage = useMemo(
    () => messages.find(m => m.senderId === user.uid && m.type !== 'system_screenshot'),
    [messages, user.uid]
  );
  // Read receipts: derive actual read state from PowerSync conversation metadata.
  // Privacy: both users must have readReceiptsEnabled !== false for "Read" to show.
  const _senderEnabled = userProfile?.readReceiptsEnabled !== false;
  const _recipientEnabled = liveFriendProfile?.readReceiptsEnabled !== false;
  const isRead = useMemo(() => {
    if (!lastSentMessage || !conversation) return false;
    if (!_senderEnabled || !_recipientEnabled) return false;

    // Current user is p1 if their uid matches participant1_id
    const isP1 = user.uid === conversation.participant1_id;
    // The OTHER user's last_read_at tells us if they read our message
    const recipientLastRead = isP1 ? conversation.last_read_at_p2 : conversation.last_read_at_p1;

    if (!recipientLastRead || !lastSentMessage.createdAt) return false;
    return new Date(recipientLastRead) >= new Date(lastSentMessage.createdAt);
  }, [lastSentMessage, conversation, _senderEnabled, _recipientEnabled, user.uid]);
  const showIndicator = !!lastSentMessage;

  /**
   * Toggle tap-to-reveal timestamp for a specific message.
   */
  const toggleTimestamp = useCallback(messageId => {
    setVisibleTimestamps(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  /**
   * Scroll to the original message when a reply mini bubble is tapped.
   */
  const scrollToMessage = useCallback(messageId => {
    const items = messagesWithDividersRef.current;
    const index = items.findIndex(m => m.id === messageId);
    if (index !== -1 && flatListRef.current) {
      try {
        flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      } catch {
        // scrollToIndex can throw on Android when index is outside render window
      }
      setTimeout(() => {
        setHighlightedMessageId(messageId);
        setTimeout(() => setHighlightedMessageId(null), 1800);
      }, 600);
    }
  }, []);

  /**
   * Edge case: if replyToMessage gets unsent while composing,
   * clear reply mode but keep typed text.
   */
  useEffect(() => {
    if (!replyToMessage) return;
    const replyMsg = messages.find(m => m.id === replyToMessage.id);
    if (replyMsg?._isUnsent) {
      cancelReply();
    }
  }, [messages, replyToMessage, cancelReply]);

  /**
   * Edge case: if actionMenuMessage gets unsent while picker is open,
   * auto-close the action menu.
   */
  useEffect(() => {
    if (!actionMenuMessage || !actionMenuVisible) return;
    const targetMsg = messages.find(m => m.id === actionMenuMessage.id);
    if (targetMsg?._isUnsent) {
      closeActionMenu();
    }
  }, [messages, actionMenuMessage, actionMenuVisible, closeActionMenu]);

  /**
   * Process messages array to insert TimeDivider items between
   * messages from different dates.
   */
  const messagesWithDividers = useMemo(() => {
    if (!messages.length) return [];
    const result = [];
    let lastDate = null;
    const seenDates = new Set();

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgDate = msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt || 0);
      const dateKey = `${msgDate.getFullYear()}-${msgDate.getMonth()}-${msgDate.getDate()}`;

      if (dateKey !== lastDate && !seenDates.has(dateKey)) {
        seenDates.add(dateKey);
        result.push({
          itemType: 'divider',
          id: `divider-${dateKey}`,
          dividerKey: `divider-${dateKey}`,
          timestamp: msgDate,
        });
        lastDate = dateKey;
      }

      result.push({ ...msg, itemType: 'message' });
    }

    return result.reverse();
  }, [messages]);

  messagesWithDividersRef.current = messagesWithDividers;

  /**
   * Handle sending a message with reply support.
   */
  const handleSend = useCallback(
    async (text, gifUrl, imageUrl) => {
      if (replyToMessage) {
        await handleSendReply(text, gifUrl, imageUrl, replyToMessage);
        cancelReply();
      } else {
        await handleSendMessage(text, gifUrl, imageUrl);
      }
    },
    [replyToMessage, handleSendReply, cancelReply, handleSendMessage]
  );

  /**
   * Compute the reply-to sender name for DMInput's ReplyPreview.
   */
  const replyToSenderName = useMemo(() => {
    if (!replyToMessage) return '';
    if (replyToMessage.senderId === user.uid) return 'You';
    return liveFriendProfile?.displayName || liveFriendProfile?.username || 'Friend';
  }, [replyToMessage, user.uid, liveFriendProfile]);

  /**
   * Look up a message by ID from the loaded messages array.
   */
  const findMessageById = useCallback(
    messageId => messages.find(m => m.id === messageId) || null,
    [messages]
  );

  /**
   * Handle snap camera button press from DMInput.
   */
  const handleOpenSnapCamera = useCallback(() => {
    navigation.navigate('SnapCamera', {
      mode: 'snap',
      conversationId,
      friendId,
      friendDisplayName: liveFriendProfile?.displayName || 'Friend',
    });
  }, [navigation, conversationId, friendId, liveFriendProfile?.displayName]);

  /**
   * Handle snap bubble press -- opens SnapViewer for unopened snaps from friend.
   */
  const handleSnapPress = useCallback(
    (message, sourceRect) => {
      const isCurrentUser = message.senderId === user.uid;
      const isViewed = message.viewedAt !== null && message.viewedAt !== undefined;

      if (!isCurrentUser && !isViewed) {
        setSnapSourceRect(sourceRect || null);
        setSnapViewerMessage(message);
      }
    },
    [user.uid]
  );

  /**
   * Screenshot detection: insert notification record into Supabase notifications table.
   * Push notification delivery happens in Phase 18 -- just insert the record.
   */
  // Note: Screenshot detection via expo-screen-capture is handled elsewhere;
  // when detected, it calls this function to record in Supabase.
  const handleScreenshotDetected = useCallback(async () => {
    if (!friendId || !user?.uid) return;
    try {
      await supabase.from('notifications').insert({
        user_id: friendId,
        type: 'screenshot',
        from_user_id: user.uid,
        data: { conversation_id: conversationId },
      });
      logger.info('ConversationScreen: Screenshot notification inserted', {
        conversationId,
        friendId,
      });
    } catch (err) {
      logger.error('ConversationScreen: Failed to insert screenshot notification', {
        error: err.message,
      });
    }
  }, [friendId, user?.uid, conversationId]);

  // Wire screenshot handler ref to the useCallback above
  screenshotHandlerRef.current = handleScreenshotDetected;

  /**
   * Render a single item -- either a TimeDivider or a MessageBubble.
   */
  const renderItem = useCallback(
    ({ item }) => {
      if (item.itemType === 'divider') {
        return <TimeDivider timestamp={item.timestamp} />;
      }

      if (item.type === 'system_screenshot') {
        return (
          <View style={styles.messageWrapper}>
            <SystemMessage text={item.text} />
          </View>
        );
      }

      const isCurrentUser = item.senderId === user.uid;
      const isLastSent = showIndicator && lastSentMessage && item.id === lastSentMessage.id;
      const messageReactions = reactionMap.get(item.id) || null;

      const isSnapMessage = item.type === 'snap';
      const isSnapUnopened = isSnapMessage && !isCurrentUser && !item.viewedAt;

      const isTaggedPhotoMessage = item.type === 'tagged_photo';

      const pressHandler = isTaggedPhotoMessage
        ? msg => {
            openPhotoDetail({
              photo: {
                id: msg.photoId,
                imageURL: msg.photoURL,
                photoURL: msg.photoURL,
                userId: msg.photoOwnerId,
              },
              photos: [
                {
                  id: msg.photoId,
                  imageURL: msg.photoURL,
                  photoURL: msg.photoURL,
                  userId: msg.photoOwnerId,
                },
              ],
              initialIndex: 0,
              mode: 'feed',
              currentUserId: user.uid,
            });
            navigation.navigate('PhotoDetail', {
              taggedPhotoContext: {
                messageId: msg.id,
                conversationId: conversationId,
                photoId: msg.photoId,
                addedToFeedBy: msg.addedToFeedBy || {},
              },
            });
          }
        : isSnapUnopened
          ? sourceRect => handleSnapPress(item, sourceRect)
          : () => toggleTimestamp(item.id);

      return (
        <View style={styles.messageWrapper}>
          <MessageBubble
            message={item}
            isCurrentUser={isCurrentUser}
            showTimestamp={visibleTimestamps.has(item.id)}
            onPress={pressHandler}
            reactions={messageReactions}
            onDoubleTap={msg => handleDoubleTapHeart(msg.id, reactionMap)}
            onLongPress={(message, layout) => openActionMenu(message, layout)}
            onSwipeReply={msg => startReply(msg)}
            onReactionPress={emoji => handleReaction(emoji, reactionMap)}
            onScrollToMessage={scrollToMessage}
            replyTo={item.replyTo}
            currentUserId={user.uid}
            senderName={liveFriendProfile?.displayName || liveFriendProfile?.username || 'Friend'}
            highlighted={highlightedMessageId === item.id}
            findMessageById={findMessageById}
            conversationId={conversationId}
          />
          {isLastSent && (
            <ReadReceiptIndicator isRead={isRead} readAt={null} visible={showIndicator} />
          )}
        </View>
      );
    },
    [
      user.uid,
      visibleTimestamps,
      toggleTimestamp,
      showIndicator,
      lastSentMessage,
      isRead,
      reactionMap,
      handleDoubleTapHeart,
      openActionMenu,
      startReply,
      handleReaction,
      scrollToMessage,
      highlightedMessageId,
      liveFriendProfile,
      findMessageById,
      handleSnapPress,
      conversationId,
      navigation,
      openPhotoDetail,
    ]
  );

  /**
   * Guard loadMore: only trigger if not already loading and more pages exist.
   */
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadMore();
    }
  }, [loadingMore, hasMore, loadMore]);

  const keyExtractor = useCallback(item => item.id || item.dividerKey, []);

  /**
   * Compute canUnsend for the currently-focused action menu message.
   */
  const actionMenuCanUnsend = useMemo(() => {
    if (!actionMenuMessage || actionMenuMessage.senderId !== user.uid) return false;
    if (!actionMenuMessage.createdAt) return false;
    const msgTime =
      actionMenuMessage.createdAt instanceof Date
        ? actionMenuMessage.createdAt
        : new Date(actionMenuMessage.createdAt);
    return Date.now() - msgTime.getTime() < 15 * 60 * 1000;
  }, [actionMenuMessage, user.uid]);

  /**
   * Handle scrollToIndex failures gracefully.
   */
  const onScrollToIndexFailed = useCallback(info => {
    logger.warn('ConversationScreen: scrollToIndex failed', { index: info.index });
    flatListRef.current?.scrollToOffset({
      offset: info.averageItemLength * info.index,
      animated: true,
    });
    setTimeout(() => {
      try {
        flatListRef.current?.scrollToIndex({
          index: info.index,
          animated: true,
          viewPosition: 0.5,
        });
      } catch {
        // Silently fail if still outside render window after retry
      }
    }, 500);
  }, []);

  // Show loading spinner while initial data loads
  if (loading) {
    return (
      <View style={styles.container}>
        <ConversationHeader
          friendProfile={liveFriendProfile}
          onBackPress={() => navigation.goBack()}
          onProfilePress={() =>
            navigation.navigate('OtherUserProfile', {
              userId: friendId,
              username: liveFriendProfile?.username,
            })
          }
          onReportPress={() =>
            navigation.navigate('ReportUser', {
              userId: friendId,
              username: liveFriendProfile?.username,
            })
          }
          streakState={streakState}
          streakDayCount={streakDayCount}
        />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior="padding"
          keyboardVerticalOffset={Platform.select({ ios: 0, android: 0 })}
        >
          <View style={styles.loadingContainer}>
            <PixelSpinner size="large" />
          </View>
          <DMInput
            onSendMessage={handleSendMessage}
            onOpenSnapCamera={handleOpenSnapCamera}
            disabled={isReadOnly}
            placeholder="Message..."
            streakState={streakState}
            streakDayCount={streakDayCount}
          />
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ConversationHeader
        friendProfile={liveFriendProfile}
        onBackPress={() => navigation.goBack()}
        onProfilePress={() =>
          navigation.navigate('OtherUserProfile', {
            userId: friendId,
            username: liveFriendProfile?.username,
          })
        }
        onReportPress={() =>
          navigation.navigate('ReportUser', {
            userId: friendId,
            username: liveFriendProfile?.username,
          })
        }
        streakState={streakState}
        streakDayCount={streakDayCount}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={Platform.select({ ios: 0, android: 0 })}
      >
        {messages.length === 0 && !loading ? (
          <EmptyConversation
            displayName={liveFriendProfile?.displayName || liveFriendProfile?.username || 'them'}
          />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messagesWithDividers}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            inverted
            contentContainerStyle={styles.listContent}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={loadingMore ? <PixelSpinner size="small" /> : null}
            keyboardDismissMode="interactive"
            removeClippedSubviews={false}
            onScroll={handleScroll}
            scrollEventThrottle={100}
            onScrollToIndexFailed={onScrollToIndexFailed}
          />
        )}
        <DMInput
          onSendMessage={handleSend}
          onSend={scrollToBottom}
          onOpenSnapCamera={handleOpenSnapCamera}
          disabled={isReadOnly}
          placeholder="Message..."
          replyToMessage={replyToMessage}
          replyToSenderName={replyToSenderName}
          onCancelReply={cancelReply}
        />
      </KeyboardAvoidingView>

      {/* Reaction picker / action menu overlay */}
      <ReactionPicker
        visible={actionMenuVisible}
        message={actionMenuMessage}
        position={actionMenuPosition}
        isCurrentUser={actionMenuMessage?.senderId === user.uid}
        canUnsend={actionMenuCanUnsend}
        onReaction={emoji => {
          handleReaction(emoji, reactionMap);
        }}
        onReply={() => {
          startReply(actionMenuMessage);
          closeActionMenu();
        }}
        onUnsend={() => {
          handleUnsend(actionMenuMessage.id);
        }}
        onDeleteForMe={() => {
          setPendingDeleteMessageId(actionMenuMessage.id);
          closeActionMenu();
          setDeleteConfirmVisible(true);
        }}
        onClose={closeActionMenu}
      />

      {/* Delete for me confirmation dialog */}
      <PixelConfirmDialog
        visible={deleteConfirmVisible}
        title="Delete Message"
        message="This will only remove it from your view. The other person can still see it."
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        onConfirm={() => {
          triggerDeleteForMe(pendingDeleteMessageId);
          setDeleteConfirmVisible(false);
          setPendingDeleteMessageId(null);
        }}
        onCancel={() => {
          setDeleteConfirmVisible(false);
          setPendingDeleteMessageId(null);
        }}
      />

      {/* SnapViewer overlay -- shown when user taps an unopened snap */}
      <SnapViewer
        visible={!!snapViewerMessage}
        snapMessage={snapViewerMessage}
        conversationId={conversationId}
        senderName={liveFriendProfile?.displayName || liveFriendProfile?.username || 'Friend'}
        viewerDisplayName={userProfile?.displayName || userProfile?.username || 'Someone'}
        onClose={() => {
          setSnapViewerMessage(null);
          setSnapSourceRect(null);
        }}
        currentUserId={user.uid}
        sourceRect={snapSourceRect}
        onReaction={async emojiKey => {
          try {
            await hookSendReaction(snapViewerMessage.id, emojiKey);
          } catch (err) {
            logger.error('ConversationScreen: Snap reaction failed', {
              conversationId,
              messageId: snapViewerMessage.id,
              emojiKey,
              error: err.message,
            });
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  flex: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  emptyStateWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  messageWrapper: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  listContent: {
    paddingTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
});

export default ConversationScreen;
