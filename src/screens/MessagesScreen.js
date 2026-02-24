import React, { useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, Platform, StyleSheet } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import ConversationRow from '../components/ConversationRow';
import PixelIcon from '../components/PixelIcon';
import PixelSpinner from '../components/PixelSpinner';

import { useAuth } from '../context/AuthContext';
import useMessages from '../hooks/useMessages';
import { useScreenTrace } from '../hooks/useScreenTrace';

import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 85 : 54;

const MessagesScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { conversations, loading, handleDeleteConversation } = useMessages(user?.uid);

  // Screen load trace - measures time from mount to data-ready
  const { markLoaded } = useScreenTrace('MessagesScreen');
  const screenTraceMarkedRef = useRef(false);

  // Mark screen trace as loaded after initial data loads (once only)
  React.useEffect(() => {
    if (!loading && !screenTraceMarkedRef.current) {
      screenTraceMarkedRef.current = true;
      markLoaded({ conversation_count: conversations.length });
    }
  }, [loading, conversations.length, markLoaded]);

  const tabBarHeight = Platform.OS === 'ios' ? TAB_BAR_HEIGHT : TAB_BAR_HEIGHT + insets.bottom;

  const handleOpenConversation = useCallback(
    conversation => {
      navigation.navigate('Conversation', {
        conversationId: conversation.id,
        friendId: conversation.friendProfile.uid,
        friendProfile: conversation.friendProfile,
        deletedAt: conversation.deletedAt?.[user?.uid] || null,
      });
    },
    [navigation, user?.uid]
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
            onPress: () => handleDeleteConversation(conversation.id),
          },
        ]
      );
    },
    [handleDeleteConversation]
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
      <View style={styles.emptyContent}>
        <PixelIcon name="tab-messages" size={48} color={colors.text.secondary} />
        <Text style={styles.emptyText}>No messages yet</Text>
        <Text style={styles.emptySubtext}>Tap the button above to start a conversation</Text>
      </View>
    );
  }, [loading]);

  if (loading) {
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
        <View style={styles.loadingContainer}>
          <PixelSpinner />
        </View>
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
        data={conversations}
        keyExtractor={item => item.id}
        renderItem={renderConversation}
        contentContainerStyle={
          conversations.length === 0 ? styles.emptyContainer : { paddingBottom: tabBarHeight }
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
