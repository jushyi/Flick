import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';
import { useAuth } from '../context/AuthContext';
import {
  getFriendships,
  removeFriend,
  subscribeFriendships,
} from '../services/firebase/friendshipService';
import { mediumImpact } from '../utils/haptics';
import logger from '../utils/logger';

// Initialize Firestore
const db = getFirestore();

/**
 * FriendsListScreen - View and manage friends
 *
 * Features:
 * - Display all accepted friends
 * - Search/filter friends by name
 * - Alphabetical sorting
 * - Long-press for options menu (Remove Friend)
 * - Friend count in header
 * - Real-time updates
 * - Pull-to-refresh
 */
const FriendsListScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch friends with user data
   */
  const fetchFriends = async () => {
    try {
      setError(null);

      const result = await getFriendships(user.uid);

      if (!result.success) {
        setError(result.error);
        setFriends([]);
        return;
      }

      // Fetch user data for each friend
      const friendsWithUserData = await Promise.all(
        result.friendships.map(async friendship => {
          // Determine the other user's ID
          const otherUserId =
            friendship.user1Id === user.uid ? friendship.user2Id : friendship.user1Id;

          try {
            const userRef = doc(db, 'users', otherUserId);
            const userDoc = await getDoc(userRef);

            // Modular API uses exists() as a method
            if (userDoc.exists()) {
              return {
                friendshipId: friendship.id,
                userId: otherUserId,
                acceptedAt: friendship.acceptedAt,
                ...userDoc.data(),
              };
            }
          } catch (err) {
            logger.error('Error fetching user data', err);
          }

          return null;
        })
      );

      // Filter out any null entries and sort alphabetically by displayName
      const validFriends = friendsWithUserData
        .filter(f => f !== null)
        .sort((a, b) => {
          const nameA = (a.displayName || a.username || '').toLowerCase();
          const nameB = (b.displayName || b.username || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });

      setFriends(validFriends);
      setFilteredFriends(validFriends);
    } catch (err) {
      logger.error('Error fetching friends', err);
      setError('Failed to load friends');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Set up real-time listener
   */
  useEffect(() => {
    fetchFriends();

    // Set up real-time listener for friendship changes
    const unsubscribe = subscribeFriendships(user.uid, friendships => {
      // Re-fetch friends when friendships change
      fetchFriends();
    });

    return () => unsubscribe();
  }, [user.uid]);

  /**
   * Filter friends based on search query
   */
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFriends(friends);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = friends.filter(friend => {
      const displayName = (friend.displayName || '').toLowerCase();
      const username = (friend.username || '').toLowerCase();
      return displayName.includes(query) || username.includes(query);
    });

    setFilteredFriends(filtered);
  }, [searchQuery, friends]);

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = () => {
    setRefreshing(true);
    fetchFriends();
  };

  /**
   * Handle remove friend
   */
  const handleRemoveFriend = friend => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friend.displayName || friend.username} as a friend?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              mediumImpact();

              const result = await removeFriend(user.uid, friend.userId);

              if (!result.success) {
                logger.error('Failed to remove friend', { error: result.error });
                alert(result.error || 'Failed to remove friend');
              }
              // Real-time listener will update the UI
            } catch (err) {
              logger.error('Error removing friend', err);
              alert('Failed to remove friend');
            }
          },
        },
      ]
    );
  };

  /**
   * Render single friend item
   */
  const renderFriend = ({ item }) => {
    const friendsSince = item.acceptedAt
      ? new Date(item.acceptedAt.toMillis()).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        })
      : 'Unknown';

    return (
      <TouchableOpacity
        style={styles.friendCard}
        onLongPress={() => handleRemoveFriend(item)}
        activeOpacity={0.7}
      >
        {/* Profile photo */}
        <View style={styles.profilePicContainer}>
          {item.profilePhotoURL ? (
            <Image source={{ uri: item.profilePhotoURL }} style={styles.profilePic} />
          ) : (
            <View style={[styles.profilePic, styles.profilePicPlaceholder]}>
              <Text style={styles.profilePicText}>
                {item.displayName?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>

        {/* User info */}
        <View style={styles.userInfo}>
          <Text style={styles.displayName} numberOfLines={1}>
            {item.displayName || 'Unknown User'}
          </Text>
          <Text style={styles.username} numberOfLines={1}>
            @{item.username || 'unknown'}
          </Text>
          <Text style={styles.friendsSince}>Friends since {friendsSince}</Text>
        </View>

        {/* Chevron */}
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  };

  /**
   * Render empty state
   */
  const renderEmptyState = () => {
    if (loading) return null;

    if (searchQuery.trim()) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>No friends found</Text>
          <Text style={styles.emptyText}>Try a different search term</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>👥</Text>
        <Text style={styles.emptyTitle}>No friends yet</Text>
        <Text style={styles.emptyText}>Add friends to see their photos in your feed</Text>
        <TouchableOpacity
          style={styles.addFriendsButton}
          onPress={() => navigation.navigate('UserSearch')}
          activeOpacity={0.7}
        >
          <Text style={styles.addFriendsButtonText}>Find Friends</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends ({friends.length})</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('FriendRequests')}
            style={styles.iconButton}
          >
            <Text style={styles.iconButtonText}>🔔</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('UserSearch')}
            style={styles.iconButton}
          >
            <Text style={styles.iconButtonText}>🔍</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search input */}
      {friends.length > 0 && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Error message */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.loadingText}>Loading friends...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredFriends}
          renderItem={renderFriend}
          keyExtractor={item => item.friendshipId}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#000000" />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 8,
  },
  iconButtonText: {
    fontSize: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearButton: {
    marginLeft: 12,
    padding: 4,
  },
  clearButtonText: {
    fontSize: 18,
    color: '#666666',
  },
  errorBanner: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFCDD2',
  },
  errorText: {
    fontSize: 14,
    color: '#D32F2F',
    textAlign: 'center',
  },
  listContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  profilePicContainer: {
    marginRight: 12,
  },
  profilePic: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  profilePicPlaceholder: {
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666666',
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  friendsSince: {
    fontSize: 12,
    color: '#999999',
  },
  chevron: {
    fontSize: 24,
    color: '#CCCCCC',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  addFriendsButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFriendsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default FriendsListScreen;
