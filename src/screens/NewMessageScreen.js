import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { getOrCreateConversation } from '../services/firebase/messageService';
import { getFriendships, batchGetUsers } from '../services/firebase/friendshipService';

import PixelIcon from '../components/PixelIcon';
import PixelSpinner from '../components/PixelSpinner';

import { useAuth } from '../context/AuthContext';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import logger from '../utils/logger';

/**
 * NewMessageScreen - Friend picker for starting new conversations
 *
 * Shows a searchable list of the user's friends.
 * Tapping a friend creates/gets a conversation and navigates to the chat thread.
 * Search matches both username AND displayName (case-insensitive startsWith).
 */
const NewMessageScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedFriendId, setSelectedFriendId] = useState(null);

  const fetchFriends = useCallback(async () => {
    try {
      const result = await getFriendships(user.uid);
      if (!result.success) {
        logger.error('NewMessageScreen: Error fetching friendships', { error: result.error });
        return;
      }

      // Collect all friend userIds for batch fetch
      const friendUserIds = result.friendships.map(friendship =>
        friendship.user1Id === user.uid ? friendship.user2Id : friendship.user1Id
      );

      // Batch fetch all user data at once
      const userMap = await batchGetUsers(friendUserIds);

      // Map friendship docs to friend objects
      const friendsWithUserData = result.friendships
        .map(friendship => {
          const otherUserId =
            friendship.user1Id === user.uid ? friendship.user2Id : friendship.user1Id;
          const userData = userMap.get(otherUserId);
          if (userData) {
            return {
              uid: otherUserId,
              displayName: userData.displayName,
              username: userData.username,
              photoURL: userData.profilePhotoURL || userData.photoURL,
            };
          }
          return null;
        })
        .filter(f => f !== null)
        .sort((a, b) => {
          const nameA = (a.displayName || a.username || '').toLowerCase();
          const nameB = (b.displayName || b.username || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });

      setFriends(friendsWithUserData);
    } catch (err) {
      logger.error('NewMessageScreen: Error in fetchFriends', { error: err.message });
    } finally {
      setLoading(false);
    }
  }, [user.uid]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // Filter friends by search text (case-insensitive startsWith on username AND displayName)
  const filteredFriends = useMemo(() => {
    if (!searchText.trim()) return friends;
    const queryStr = searchText.toLowerCase().trim();
    return friends.filter(friend => {
      const username = (friend.username || '').toLowerCase();
      const displayName = (friend.displayName || '').toLowerCase();
      return username.startsWith(queryStr) || displayName.startsWith(queryStr);
    });
  }, [friends, searchText]);

  const handleSelectFriend = useCallback(
    async friend => {
      if (selectedFriendId) return; // prevent double-tap
      setSelectedFriendId(friend.uid);
      try {
        const result = await getOrCreateConversation(user.uid, friend.uid);
        if (result.success) {
          navigation.replace('Conversation', {
            conversationId: result.conversationId,
            friendId: friend.uid,
            friendProfile: {
              uid: friend.uid,
              displayName: friend.displayName,
              username: friend.username,
              photoURL: friend.photoURL,
            },
          });
        } else {
          logger.error('NewMessageScreen: Failed to get/create conversation', {
            error: result.error,
          });
          Alert.alert('Error', 'Could not start conversation. Please try again.');
        }
      } catch (err) {
        logger.error('NewMessageScreen: Error selecting friend', { error: err.message });
        Alert.alert('Error', 'Could not start conversation. Please try again.');
      } finally {
        setSelectedFriendId(null);
      }
    },
    [selectedFriendId, user.uid, navigation]
  );

  const renderFriendRow = useCallback(
    ({ item }) => {
      const isSelected = selectedFriendId === item.uid;
      return (
        <TouchableOpacity
          style={styles.friendRow}
          onPress={() => handleSelectFriend(item)}
          activeOpacity={0.7}
          disabled={!!selectedFriendId}
        >
          {item.photoURL ? (
            <Image
              source={{ uri: item.photoURL }}
              style={styles.avatar}
              cachePolicy="memory-disk"
              transition={0}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {item.displayName?.[0]?.toUpperCase() || item.username?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={styles.friendInfo}>
            <Text style={styles.displayName} numberOfLines={1}>
              {item.displayName || item.username}
            </Text>
            <Text style={styles.username} numberOfLines={1}>
              @{item.username}
            </Text>
          </View>
          {isSelected && <ActivityIndicator size="small" color={colors.text.secondary} />}
        </TouchableOpacity>
      );
    },
    [selectedFriendId, handleSelectFriend]
  );

  const renderEmptyState = () => {
    if (loading) return null;

    if (friends.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <PixelIcon name="people-outline" size={48} color={colors.text.tertiary} />
          <Text style={styles.emptyText}>Add friends to start messaging</Text>
        </View>
      );
    }

    // Search has no results
    return (
      <View style={styles.emptyContainer}>
        <PixelIcon name="search-outline" size={48} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>No friends match your search</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <PixelIcon name="chevron-back" size={28} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Message</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <PixelSpinner size="large" color={colors.text.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <PixelIcon name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Message</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search friends..."
          placeholderTextColor={colors.text.secondary}
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearButton}>
            <PixelIcon name="close-outline" size={18} color={colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Friends list */}
      <FlatList
        data={filteredFriends}
        renderItem={renderFriendRow}
        keyExtractor={item => item.uid}
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    color: colors.text.primary,
    fontFamily: typography.fontFamily.display,
  },
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.background.tertiary,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 15,
    color: colors.text.primary,
  },
  clearButton: {
    padding: 4,
  },
  listContent: {
    flexGrow: 1,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.tertiary,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  displayName: {
    fontSize: 13,
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bodyBold,
  },
  username: {
    fontSize: 11,
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.body,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 15,
    color: colors.text.tertiary,
    marginTop: 12,
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default NewMessageScreen;
