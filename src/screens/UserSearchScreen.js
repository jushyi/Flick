import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getFirestore,
  collection,
  query,
  where,
  limit,
  getDocs,
} from '@react-native-firebase/firestore';
import { useAuth } from '../context/AuthContext';
import UserSearchCard from '../components/UserSearchCard';
import { sendFriendRequest, checkFriendshipStatus } from '../services/firebase/friendshipService';
import { mediumImpact } from '../utils/haptics';
import { colors } from '../constants/colors';
import logger from '../utils/logger';

// Initialize Firestore
const db = getFirestore();

/**
 * UserSearchScreen - Search for users by username
 *
 * Features:
 * - Search input with debounce (500ms)
 * - Case-insensitive username search
 * - Display results with friendship status
 * - Send friend requests
 * - Empty states and loading states
 */
const UserSearchScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [friendshipStatuses, setFriendshipStatuses] = useState({});

  /**
   * Debounced search function
   * Waits 500ms after user stops typing before searching
   */
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      searchUsers(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  /**
   * Search users by username (case-insensitive)
   */
  const searchUsers = async term => {
    try {
      setLoading(true);
      setError(null);

      const normalizedTerm = term.toLowerCase().trim();

      // Query Firestore users collection using modular API
      const usersQuery = query(
        collection(db, 'users'),
        where('username', '>=', normalizedTerm),
        where('username', '<=', normalizedTerm + '\uf8ff'),
        limit(20)
      );
      const querySnapshot = await getDocs(usersQuery);

      const results = [];
      querySnapshot.forEach(doc => {
        const userData = doc.data();
        // Exclude current user from results
        if (doc.id !== user.uid) {
          results.push({
            id: doc.id,
            ...userData,
          });
        }
      });

      setSearchResults(results);

      // Fetch friendship status for each result
      if (results.length > 0) {
        fetchFriendshipStatuses(results);
      }
    } catch (err) {
      logger.error('Error searching users', err);
      setError('Failed to search users');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch friendship status for search results
   */
  const fetchFriendshipStatuses = async users => {
    const statuses = {};

    await Promise.all(
      users.map(async searchUser => {
        const result = await checkFriendshipStatus(user.uid, searchUser.id);
        if (result.success) {
          statuses[searchUser.id] = result.status;
        }
      })
    );

    setFriendshipStatuses(statuses);
  };

  /**
   * Handle adding a friend
   */
  const handleAddFriend = async toUserId => {
    try {
      mediumImpact();

      // Optimistic update
      setFriendshipStatuses(prev => ({
        ...prev,
        [toUserId]: 'pending_sent',
      }));

      const result = await sendFriendRequest(user.uid, toUserId);

      if (!result.success) {
        logger.error('Failed to send friend request', { error: result.error });
        // Revert optimistic update
        setFriendshipStatuses(prev => ({
          ...prev,
          [toUserId]: 'none',
        }));
        alert(result.error || 'Failed to send friend request');
      }
    } catch (err) {
      logger.error('Error sending friend request', err);
      // Revert optimistic update
      setFriendshipStatuses(prev => ({
        ...prev,
        [toUserId]: 'none',
      }));
      alert('Failed to send friend request');
    }
  };

  /**
   * Navigate to friend requests screen when "Respond" is pressed
   */
  const handleRespondToRequest = () => {
    navigation.navigate('FriendRequests');
  };

  /**
   * Render single search result
   */
  const renderSearchResult = ({ item }) => {
    const friendshipStatus = friendshipStatuses[item.id] || 'none';
    const onPress =
      friendshipStatus === 'pending_received'
        ? handleRespondToRequest
        : () => handleAddFriend(item.id);

    return <UserSearchCard user={item} friendshipStatus={friendshipStatus} onAddFriend={onPress} />;
  };

  /**
   * Render empty state
   */
  const renderEmptyState = () => {
    if (loading) return null;

    if (!searchTerm.trim()) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>Search for friends</Text>
          <Text style={styles.emptyText}>Enter a username to find friends on Rewind</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>😕</Text>
        <Text style={styles.emptyTitle}>No users found</Text>
        <Text style={styles.emptyText}>Try searching for a different username</Text>
      </View>
    );
  };

  /**
   * Render loading skeleton
   */
  const renderLoading = () => {
    if (!loading) return null;

    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.text.primary} />
        <Text style={styles.loadingText}>Searching...</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search username..."
          placeholderTextColor={colors.text.tertiary}
          value={searchTerm}
          onChangeText={setSearchTerm}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Error message */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Search results */}
      {loading ? (
        renderLoading()
      ) : (
        <FlatList
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.resultsList}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.background.tertiary,
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
    color: colors.text.secondary,
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
  resultsList: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.text.secondary,
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
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default UserSearchScreen;
