/**
 * ConversationScreen — Chat Thread
 *
 * The core DM experience: displays message history with real-time updates,
 * supports text, GIF, and image sending, handles keyboard interaction, and provides
 * pagination for older messages via an inverted FlatList.
 *
 * Phase 2 additions: reactions (double-tap heart, long-press picker),
 * replies (swipe-to-reply, reply preview above input), deletion (unsend, delete for me),
 * scroll-to-message on reply tap, highlighted message flash.
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';

import ConversationHeader from '../components/ConversationHeader';
import MessageBubble from '../components/MessageBubble';
import ReadReceiptIndicator from '../components/ReadReceiptIndicator';
import TimeDivider from '../components/TimeDivider';
import DMInput from '../components/DMInput';
import PixelSpinner from '../components/PixelSpinner';
import ReactionPicker from '../components/ReactionPicker';
import PixelConfirmDialog from '../components/PixelConfirmDialog';

import { useAuth } from '../context/AuthContext';
import useConversation from '../hooks/useConversation';
import useMessageActions from '../hooks/useMessageActions';

import { colors } from '../constants/colors';
import logger from '../utils/logger';

/**
 * Empty state shown when no messages exist in the conversation.
 * Rendered outside the inverted FlatList to avoid cross-platform transform issues.
 */
const EmptyConversation = ({ displayName }) => (
  <View style={styles.emptyStateWrapper}>
    <Text style={styles.emptyText}>{`Say hi to ${displayName || 'them'}!`}</Text>
  </View>
);

const ConversationScreen = () => {
  const { user, userProfile } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const { conversationId, friendId, friendProfile, deletedAt } = route.params;

  const [liveFriendProfile, setLiveFriendProfile] = useState(friendProfile);

  useEffect(() => {
    if (!friendId) return;
    let cancelled = false;
    const fetchProfile = async () => {
      try {
        const db = getFirestore();
        const snap = await getDoc(doc(db, 'users', friendId));
        if (snap.exists() && !cancelled) {
          const data = snap.data();
          setLiveFriendProfile({
            uid: friendId,
            username: data.username || friendProfile?.username || 'unknown',
            displayName: data.displayName || friendProfile?.displayName || 'Unknown User',
            profilePhotoURL: data.profilePhotoURL || data.photoURL || null,
            nameColor: data.nameColor || null,
            readReceiptsEnabled: data.readReceiptsEnabled,
          });
        }
      } catch (err) {
        // Silently fall back to navigation param profile on error
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

  // --- Data hooks ---
  const {
    messages,
    reactionMap,
    conversationDoc,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    handleSendMessage,
    handleSendReaction,
    handleRemoveReaction,
    handleSendReply,
    handleDeleteForMe,
  } = useConversation(conversationId, user.uid, deletedAt);

  const flatListRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const [visibleTimestamps, setVisibleTimestamps] = useState(new Set());
  const isReadOnly = route.params?.readOnly || false;

  // --- Message actions hook ---
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
    handleUnsend,
    handleDeleteForMe: triggerDeleteForMe,
  } = useMessageActions({
    conversationId,
    currentUserId: user.uid,
    onSendReaction: handleSendReaction,
    onRemoveReaction: handleRemoveReaction,
    onSendReply: handleSendReply,
    onDeleteForMe: handleDeleteForMe,
  });

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
   * Derive read receipt state for the sender's last message.
   * Privacy: both users must have readReceiptsEnabled !== false for "Read" to show.
   */
  const lastSentMessage = useMemo(
    () => messages.find(m => m.senderId === user.uid),
    [messages, user.uid]
  );
  const friendReadAt = conversationDoc?.readReceipts?.[friendId];
  const senderEnabled = userProfile?.readReceiptsEnabled !== false;
  const recipientEnabled = liveFriendProfile?.readReceiptsEnabled !== false;
  const showReadStatus = senderEnabled && recipientEnabled;
  const isRead =
    showReadStatus &&
    !!friendReadAt &&
    !!lastSentMessage?.createdAt &&
    friendReadAt.toMillis?.() >= lastSentMessage.createdAt.toMillis?.();
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
   * Uses flatListRef to scroll the inverted FlatList to the target index
   * and briefly highlights the message with a background flash.
   */
  const scrollToMessage = useCallback(
    messageId => {
      const index = messages.findIndex(m => m.id === messageId);
      if (index !== -1 && flatListRef.current) {
        try {
          flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
        } catch {
          // scrollToIndex can throw on Android when index is outside render window;
          // onScrollToIndexFailed handler will retry via approximate offset.
        }
        // Brief highlight: set highlightedMessageId for 1.5 seconds
        setHighlightedMessageId(messageId);
        setTimeout(() => setHighlightedMessageId(null), 1500);
      }
    },
    [messages]
  );

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
   * messages from different dates. Messages are newest-first
   * (for inverted list), so we process in reverse to group by date,
   * then reverse back.
   */
  const messagesWithDividers = useMemo(() => {
    if (!messages.length) return [];
    const result = [];
    let lastDate = null;

    // Messages are sorted newest-first (for inverted list)
    // Process in reverse to insert dividers correctly
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgDate = msg.createdAt?.toDate?.() ? msg.createdAt.toDate() : new Date();
      const dateKey = `${msgDate.getFullYear()}-${msgDate.getMonth()}-${msgDate.getDate()}`;

      if (dateKey !== lastDate) {
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

    return result.reverse(); // Back to newest-first for inverted list
  }, [messages]);

  /**
   * Handle sending a message with reply support.
   * If replyToMessage is set, sends as a reply; otherwise normal send.
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
   * Used by MessageBubble to resolve original message data for replies
   * (e.g., image/gif URLs that are not stored in the denormalized replyTo).
   */
  const findMessageById = useCallback(
    messageId => messages.find(m => m.id === messageId) || null,
    [messages]
  );

  /**
   * Render a single item — either a TimeDivider or a MessageBubble
   * wrapped with consistent spacing. Includes ReadReceiptIndicator
   * below the current user's most recent sent message.
   */
  const renderItem = useCallback(
    ({ item }) => {
      if (item.itemType === 'divider') {
        return <TimeDivider timestamp={item.timestamp} />;
      }

      const isCurrentUser = item.senderId === user.uid;
      const isLastSent = showIndicator && lastSentMessage && item.id === lastSentMessage.id;
      const messageReactions = reactionMap.get(item.id) || null;

      return (
        <View style={styles.messageWrapper}>
          <MessageBubble
            message={item}
            isCurrentUser={isCurrentUser}
            showTimestamp={visibleTimestamps.has(item.id)}
            onPress={() => toggleTimestamp(item.id)}
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
          />
          {isLastSent && (
            <ReadReceiptIndicator isRead={isRead} readAt={friendReadAt} visible={showIndicator} />
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
      friendReadAt,
      reactionMap,
      handleDoubleTapHeart,
      openActionMenu,
      startReply,
      handleReaction,
      scrollToMessage,
      highlightedMessageId,
      liveFriendProfile,
      findMessageById,
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
    const msgTime = actionMenuMessage.createdAt.toDate
      ? actionMenuMessage.createdAt.toDate()
      : new Date(actionMenuMessage.createdAt);
    return Date.now() - msgTime.getTime() < 15 * 60 * 1000;
  }, [actionMenuMessage, user.uid]);

  /**
   * Handle scrollToIndex failures gracefully (e.g., index out of range in virtualized window).
   * First scrolls to the approximate offset to bring the item into the render window,
   * then retries scrollToIndex after a short delay to land precisely.
   */
  const onScrollToIndexFailed = useCallback(info => {
    logger.warn('ConversationScreen: scrollToIndex failed', { index: info.index });
    // First scroll to approximate offset to bring item into render window
    flatListRef.current?.scrollToOffset({
      offset: info.averageItemLength * info.index,
      animated: true,
    });
    // Retry with longer delay to ensure the target area has rendered
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
            disabled={isReadOnly}
            placeholder="Message..."
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
            removeClippedSubviews={true}
            onScroll={handleScroll}
            scrollEventThrottle={100}
            onScrollToIndexFailed={onScrollToIndexFailed}
          />
        )}
        <DMInput
          onSendMessage={handleSend}
          onSend={scrollToBottom}
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
