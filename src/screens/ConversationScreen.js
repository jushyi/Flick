/**
 * ConversationScreen — Chat Thread
 *
 * The core DM experience: displays message history with real-time updates,
 * supports text and GIF sending, handles keyboard interaction, and provides
 * pagination for older messages via an inverted FlatList.
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

import { useAuth } from '../context/AuthContext';
import useConversation from '../hooks/useConversation';

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

  const { messages, conversationDoc, loading, loadingMore, hasMore, loadMore, handleSendMessage } =
    useConversation(conversationId, user.uid, deletedAt);

  const flatListRef = useRef(null);
  const [visibleTimestamps, setVisibleTimestamps] = useState(new Set());
  const isReadOnly = route.params?.readOnly || false;

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
          type: 'divider',
          id: `divider-${dateKey}`,
          dividerKey: `divider-${dateKey}`,
          timestamp: msgDate,
        });
        lastDate = dateKey;
      }

      result.push({ ...msg, type: 'message' });
    }

    return result.reverse(); // Back to newest-first for inverted list
  }, [messages]);

  /**
   * Render a single item — either a TimeDivider or a MessageBubble
   * wrapped with consistent spacing. Includes ReadReceiptIndicator
   * below the current user's most recent sent message.
   */
  const renderItem = useCallback(
    ({ item }) => {
      if (item.type === 'divider') {
        return <TimeDivider timestamp={item.timestamp} />;
      }

      const isLastSent = showIndicator && lastSentMessage && item.id === lastSentMessage.id;

      return (
        <View style={styles.messageWrapper}>
          <MessageBubble
            message={item}
            isCurrentUser={item.senderId === user.uid}
            showTimestamp={visibleTimestamps.has(item.id)}
            onPress={() => toggleTimestamp(item.id)}
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
          behavior={Platform.select({ ios: 'padding', android: 'height' })}
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
        behavior={Platform.select({ ios: 'padding', android: 'height' })}
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
            maintainVisibleContentPosition={
              Platform.OS === 'ios' ? { minIndexForVisible: 0 } : undefined
            }
          />
        )}
        <DMInput onSendMessage={handleSendMessage} disabled={isReadOnly} placeholder="Message..." />
      </KeyboardAvoidingView>
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
    paddingHorizontal: 12,
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
