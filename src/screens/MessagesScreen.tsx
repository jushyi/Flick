import React, { useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, Platform, StyleSheet } from 'react-native';

import { useQueries } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';

import ConversationRow from '../components/ConversationRow';
import PixelIcon from '../components/PixelIcon';
import PixelSpinner from '../components/PixelSpinner';
import { ConversationsSkeleton } from '../components/skeletons/ConversationsSkeleton';
import { EmptyState } from '../components/EmptyState';

import { useAuth } from '../context/AuthContext';
import { useMessages } from '../hooks/useMessages';
import { useStreakMap } from '../hooks/useStreaks';
import { useScreenTrace } from '../hooks/useScreenTrace';

import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 85 : 54;

const MessagesScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { conversations, loading, deleteConversation } = useMessages();

  // Derive friendIds from conversations for streak map and profile fetching
  const friendIds = useMemo(
    () => conversations.map(c => c.otherUserId).filter(Boolean),
    [conversations]
  );

  // Batch streak data for all conversations
  const { streakMap } = useStreakMap(friendIds);

  // Batch fetch friend profiles via TanStack useQueries (Supabase)
  const profileQueries = useQueries({
    queries: friendIds.map(friendId => ({
      queryKey: queryKeys.profile.detail(friendId),
      queryFn: async () => {
        const { data, error } = await supabase
          .from('users')
          .select('id, username, display_name, profile_photo_path')
          .eq('id', friendId)
          .single();
        if (error) throw error;
        return data;
      },
      enabled: !!friendId,
      staleTime: 5 * 60 * 1000, // 5 minutes (matches old CACHE_TTL_MS)
      meta: { persist: true },
    })),
  });

  // Build a profile map from query results
  const profileMap = useMemo(() => {
    const map = new Map();
    friendIds.forEach((fId, idx) => {
      const query = profileQueries[idx];
      if (query?.data) {
        map.set(fId, query.data);
      }
    });
    return map;
  }, [friendIds, profileQueries]);

  // Enrich conversations with friend profiles, streaks, and adapted shape
  // for ConversationRow compatibility
  const enrichedConversations = useMemo(() => {
    return conversations.map(conv => {
      const fId = conv.otherUserId;
      const profile = profileMap.get(fId);
      const streakInfo = streakMap.get(fId);

      return {
        id: conv.id,
        lastMessage:
          conv.last_message_text != null
            ? {
                text: conv.last_message_text,
                type: conv.last_message_type || 'text',
                senderId: conv.last_message_sender_id,
                timestamp: conv.last_message_at ? new Date(conv.last_message_at) : null,
              }
            : null,
        updatedAt: conv.last_message_at ? new Date(conv.last_message_at) : null,
        unreadCount: conv.unreadCount || 0,
        readReceipts: {}, // Read receipts not in PowerSync conversations schema
        participants: [conv.participant1_id, conv.participant2_id],
        friendProfile: profile
          ? {
              uid: fId,
              username: profile.username || 'unknown',
              displayName: profile.display_name || 'Unknown User',
              profilePhotoURL: profile.profile_photo_path || null,
              photoURL: profile.profile_photo_path || null,
              nameColor: null,
              readReceiptsEnabled: true, // Default; full check happens in ConversationScreen
            }
          : {
              uid: fId,
              username: 'unknown',
              displayName: 'Unknown User',
              profilePhotoURL: null,
              photoURL: null,
              nameColor: null,
              readReceiptsEnabled: true,
            },
        streakState: streakInfo?.state || 'default',
        streakDayCount: streakInfo?.dayCount || 0,
        streakColor: streakInfo?.color || null,
      };
    });
  }, [conversations, profileMap, streakMap]);

  // Screen load trace - measures time from mount to data-ready
  const { markLoaded } = useScreenTrace('MessagesScreen');
  const screenTraceMarkedRef = useRef(false);

  // Mark screen trace as loaded after initial data loads (once only)
  React.useEffect(() => {
    if (!loading && !screenTraceMarkedRef.current) {
      screenTraceMarkedRef.current = true;
      markLoaded({ conversation_count: enrichedConversations.length });
    }
  }, [loading, enrichedConversations.length, markLoaded]);

  const tabBarHeight = Platform.OS === 'ios' ? TAB_BAR_HEIGHT : TAB_BAR_HEIGHT + insets.bottom;

  const handleOpenConversation = useCallback(
    conversation => {
      navigation.navigate('Conversation', {
        conversationId: conversation.id,
        friendId: conversation.friendProfile.uid,
        friendProfile: conversation.friendProfile,
        deletedAt: null, // Soft-delete filtering handled by useMessages hook
      });
    },
    [navigation]
  );

  const handleDeletePress = useCallback(
    conversation => {
      Alert.alert(
        'Delete Conversation',
        `Delete your conversation with ${conversation.friendProfile.displayName}? They will still see the conversation on their end.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteConversation(conversation.id),
          },
        ]
      );
    },
    [deleteConversation]
  );

  const handleNewMessage = useCallback(() => {
    navigation.navigate('NewMessage');
  }, [navigation]);

  const handleSnapCamera = useCallback(
    (convId, fId, fDisplayName) => {
      navigation.navigate('SnapCamera', {
        mode: 'snap',
        conversationId: convId,
        friendId: fId,
        friendDisplayName: fDisplayName,
      });
    },
    [navigation]
  );

  const renderConversation = useCallback(
    ({ item }) => (
      <ConversationRow
        conversation={item}
        friendProfile={item.friendProfile}
        currentUserId={user?.uid}
        onPress={() => handleOpenConversation(item)}
        onLongPress={() => handleDeletePress(item)}
        onSnapCamera={handleSnapCamera}
      />
    ),
    [user?.uid, handleOpenConversation, handleDeletePress, handleSnapCamera]
  );

  const renderEmptyState = useCallback(() => {
    if (loading) return null;
    return (
      <EmptyState
        icon="chatbubble-outline"
        message="No conversations yet"
        ctaLabel="Start a chat"
        onCtaPress={() => navigation.navigate('NewMessage')}
      />
    );
  }, [loading, navigation]);

  if (loading && conversations.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Messages
          </Text>
          <TouchableOpacity
            style={styles.newMessageButton}
            onPress={handleNewMessage}
            activeOpacity={0.7}
          >
            <PixelIcon name="add" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
        <ConversationsSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Messages
        </Text>
        <TouchableOpacity
          style={styles.newMessageButton}
          onPress={handleNewMessage}
          activeOpacity={0.7}
        >
          <PixelIcon name="add" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={enrichedConversations}
        keyExtractor={item => item.id}
        renderItem={renderConversation}
        contentContainerStyle={
          enrichedConversations.length === 0
            ? styles.emptyContainer
            : { paddingBottom: tabBarHeight }
        }
        ListEmptyComponent={renderEmptyState}
        removeClippedSubviews={true}
        maxToRenderPerBatch={15}
        windowSize={10}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.size.xxl,
    color: colors.text.primary,
    fontFamily: typography.fontFamily.display,
    ...Platform.select({ android: { includeFontPadding: false } }),
  },
  newMessageButton: {
    padding: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyText: {
    fontSize: typography.size.xl,
    fontWeight: '600',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.display,
    marginTop: spacing.md,
    ...Platform.select({ android: { includeFontPadding: false } }),
  },
  emptySubtext: {
    fontSize: typography.size.md,
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.readable,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
  },
});

export default MessagesScreen;
