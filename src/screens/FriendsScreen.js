import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getFirestore,
  collection,
  query,
  where,
  limit,
  getDocs,
  doc,
  getDoc,
} from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import FriendCard from '../components/FriendCard';
import {
  getFriendships,
  getPendingRequests,
  getSentRequests,
  subscribeFriendships,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  checkFriendshipStatus,
} from '../services/firebase/friendshipService';
import {
  hasUserSyncedContacts,
  syncContactsAndFindSuggestions,
  getDismissedSuggestionIds,
  filterDismissedSuggestions,
  dismissSuggestion,
  markContactsSyncCompleted,
} from '../services/firebase/contactSyncService';
import { mediumImpact } from '../utils/haptics';
import { colors } from '../constants/colors';
import { styles } from '../styles/FriendsScreen.styles';
import logger from '../utils/logger';

const db = getFirestore();

/**
 * FriendsScreen - Unified friends management with tabbed interface
 *
 * Features:
 * - Requests | Friends tabs
 * - Requests tab: Incoming/Sent sections + user search to add friends
 * - Friends tab: Friend list with filter search + long press to remove
 * - Real-time updates via subscribeFriendships
 */
const FriendsScreen = ({ navigation }) => {
  const { user, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('requests');

  // Friends tab state
  const [friends, setFriends] = useState([]);
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [friendsSearchQuery, setFriendsSearchQuery] = useState('');

  // Requests tab state
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [requestsSearchQuery, setRequestsSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [friendshipStatuses, setFriendshipStatuses] = useState({});

  // General state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  // Suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [hasSyncedContacts, setHasSyncedContacts] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  /**
   * Fetch all friends data
   */
  const fetchFriends = async () => {
    try {
      const result = await getFriendships(user.uid);
      if (!result.success) {
        logger.error('Error fetching friendships', { error: result.error });
        return;
      }

      // Fetch user data for each friend
      const friendsWithUserData = await Promise.all(
        result.friendships.map(async friendship => {
          const otherUserId =
            friendship.user1Id === user.uid ? friendship.user2Id : friendship.user1Id;
          try {
            const userRef = doc(db, 'users', otherUserId);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
              return {
                friendshipId: friendship.id,
                userId: otherUserId,
                acceptedAt: friendship.acceptedAt,
                displayName: userDoc.data().displayName,
                username: userDoc.data().username,
                profilePhotoURL: userDoc.data().profilePhotoURL,
              };
            }
          } catch (err) {
            logger.error('Error fetching friend user data', err);
          }
          return null;
        })
      );

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
      logger.error('Error in fetchFriends', err);
    }
  };

  /**
   * Fetch friend requests (incoming and sent)
   */
  const fetchRequests = async () => {
    try {
      const [incomingResult, sentResult] = await Promise.all([
        getPendingRequests(user.uid),
        getSentRequests(user.uid),
      ]);

      if (incomingResult.success) {
        // Fetch user data for incoming requests
        const incomingWithUserData = await Promise.all(
          incomingResult.requests.map(async request => {
            const otherUserId = request.user1Id === user.uid ? request.user2Id : request.user1Id;
            try {
              const userRef = doc(db, 'users', otherUserId);
              const userDoc = await getDoc(userRef);
              if (userDoc.exists()) {
                return {
                  ...request,
                  userId: otherUserId,
                  displayName: userDoc.data().displayName,
                  username: userDoc.data().username,
                  profilePhotoURL: userDoc.data().profilePhotoURL,
                };
              }
            } catch (err) {
              logger.error('Error fetching request user data', err);
            }
            return null;
          })
        );
        setIncomingRequests(incomingWithUserData.filter(r => r !== null));
      }

      if (sentResult.success) {
        // Fetch user data for sent requests
        const sentWithUserData = await Promise.all(
          sentResult.requests.map(async request => {
            const otherUserId = request.user1Id === user.uid ? request.user2Id : request.user1Id;
            try {
              const userRef = doc(db, 'users', otherUserId);
              const userDoc = await getDoc(userRef);
              if (userDoc.exists()) {
                return {
                  ...request,
                  userId: otherUserId,
                  displayName: userDoc.data().displayName,
                  username: userDoc.data().username,
                  profilePhotoURL: userDoc.data().profilePhotoURL,
                };
              }
            } catch (err) {
              logger.error('Error fetching sent request user data', err);
            }
            return null;
          })
        );
        setSentRequests(sentWithUserData.filter(r => r !== null));
      }
    } catch (err) {
      logger.error('Error in fetchRequests', err);
    }
  };

  /**
   * Fetch contact-based friend suggestions
   */
  const fetchSuggestions = async () => {
    try {
      // Check if user has synced contacts
      const synced = await hasUserSyncedContacts(user.uid);
      setHasSyncedContacts(synced);

      if (!synced) {
        setSuggestions([]);
        return;
      }

      // Get suggestions from contacts
      const result = await syncContactsAndFindSuggestions(user.uid, userProfile?.phoneNumber);

      if (result.success && result.suggestions) {
        // Filter out dismissed suggestions
        const dismissedIds = await getDismissedSuggestionIds(user.uid);
        const filteredSuggestions = filterDismissedSuggestions(result.suggestions, dismissedIds);
        setSuggestions(filteredSuggestions);
      } else {
        setSuggestions([]);
      }
    } catch (err) {
      logger.error('Error fetching suggestions', err);
      setSuggestions([]);
    }
  };

  /**
   * Load all data
   */
  const loadData = async () => {
    setError(null);
    try {
      await Promise.all([fetchFriends(), fetchRequests(), fetchSuggestions()]);
    } catch (err) {
      logger.error('Error loading data', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Set up real-time listener
   */
  useEffect(() => {
    loadData();

    const unsubscribe = subscribeFriendships(user.uid, () => {
      // Re-fetch all data when friendships change
      loadData();
    });

    return () => unsubscribe();
  }, [user.uid]);

  /**
   * Filter friends based on search query
   */
  useEffect(() => {
    if (!friendsSearchQuery.trim()) {
      setFilteredFriends(friends);
      return;
    }

    const query = friendsSearchQuery.toLowerCase();
    const filtered = friends.filter(friend => {
      const displayName = (friend.displayName || '').toLowerCase();
      const username = (friend.username || '').toLowerCase();
      return displayName.includes(query) || username.includes(query);
    });

    setFilteredFriends(filtered);
  }, [friendsSearchQuery, friends]);

  /**
   * Search users by username (debounced)
   */
  useEffect(() => {
    if (!requestsSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      searchUsers(requestsSearchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [requestsSearchQuery]);

  /**
   * Search users by username
   */
  const searchUsers = async term => {
    try {
      setSearchLoading(true);
      const normalizedTerm = term.toLowerCase().trim();

      const usersQuery = query(
        collection(db, 'users'),
        where('username', '>=', normalizedTerm),
        where('username', '<=', normalizedTerm + '\uf8ff'),
        limit(20)
      );
      const querySnapshot = await getDocs(usersQuery);

      const results = [];
      querySnapshot.forEach(docSnap => {
        if (docSnap.id !== user.uid) {
          results.push({
            userId: docSnap.id,
            ...docSnap.data(),
          });
        }
      });

      setSearchResults(results);

      // Fetch friendship status for each result
      if (results.length > 0) {
        const statuses = {};
        await Promise.all(
          results.map(async searchUser => {
            const result = await checkFriendshipStatus(user.uid, searchUser.userId);
            if (result.success) {
              statuses[searchUser.userId] = {
                status: result.status,
                friendshipId: result.friendshipId,
              };
            }
          })
        );
        setFriendshipStatuses(statuses);
      }
    } catch (err) {
      logger.error('Error searching users', err);
    } finally {
      setSearchLoading(false);
    }
  };

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  /**
   * Handle add friend action
   */
  const handleAddFriend = async userId => {
    try {
      setActionLoading(prev => ({ ...prev, [userId]: true }));
      mediumImpact();

      const result = await sendFriendRequest(user.uid, userId);
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to send friend request');
      } else {
        // Remove from suggestions if present
        setSuggestions(prev => prev.filter(s => s.id !== userId));
        // Update local state for search results
        setFriendshipStatuses(prev => ({
          ...prev,
          [userId]: { status: 'pending_sent', friendshipId: result.friendshipId },
        }));
      }
    } catch (err) {
      logger.error('Error sending friend request', err);
      Alert.alert('Error', 'Failed to send friend request');
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  /**
   * Handle dismiss suggestion
   */
  const handleDismissSuggestion = async userId => {
    try {
      mediumImpact();

      // Optimistic update
      setSuggestions(prev => prev.filter(s => s.id !== userId));

      // Persist dismissal
      await dismissSuggestion(user.uid, userId);
    } catch (err) {
      logger.error('Error dismissing suggestion', err);
      // Refresh suggestions on error
      fetchSuggestions();
    }
  };

  /**
   * Handle sync contacts from Requests tab
   */
  const handleSyncContacts = async () => {
    try {
      setSuggestionsLoading(true);
      mediumImpact();

      const result = await syncContactsAndFindSuggestions(user.uid, userProfile?.phoneNumber);

      if (!result.success) {
        if (
          result.error === 'permission_denied' ||
          result.error === 'permission_denied_permanent'
        ) {
          // Permission handling is done in the service
          setSuggestionsLoading(false);
          return;
        }
        Alert.alert('Error', 'Failed to sync contacts. Please try again.');
        setSuggestionsLoading(false);
        return;
      }

      // Mark sync as completed
      await markContactsSyncCompleted(user.uid, true);
      setHasSyncedContacts(true);

      // Update suggestions
      const dismissedIds = await getDismissedSuggestionIds(user.uid);
      const filteredSuggestions = filterDismissedSuggestions(
        result.suggestions || [],
        dismissedIds
      );
      setSuggestions(filteredSuggestions);

      if (filteredSuggestions.length === 0) {
        Alert.alert(
          'No Friends Found',
          'None of your contacts are on REWIND yet. Invite them to join!'
        );
      }
    } catch (err) {
      logger.error('Error syncing contacts', err);
      Alert.alert('Error', 'Failed to sync contacts');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  /**
   * Handle accept request
   */
  const handleAcceptRequest = async friendshipId => {
    try {
      setActionLoading(prev => ({ ...prev, [friendshipId]: true }));
      mediumImpact();

      const result = await acceptFriendRequest(friendshipId, user.uid);
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to accept friend request');
      }
      // Real-time listener will update the UI
    } catch (err) {
      logger.error('Error accepting friend request', err);
      Alert.alert('Error', 'Failed to accept friend request');
    } finally {
      setActionLoading(prev => ({ ...prev, [friendshipId]: false }));
    }
  };

  /**
   * Handle deny/cancel request
   */
  const handleDenyRequest = async friendshipId => {
    try {
      setActionLoading(prev => ({ ...prev, [friendshipId]: true }));
      mediumImpact();

      const result = await declineFriendRequest(friendshipId, user.uid);
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to decline friend request');
      }
      // Real-time listener will update the UI
    } catch (err) {
      logger.error('Error declining friend request', err);
      Alert.alert('Error', 'Failed to decline friend request');
    } finally {
      setActionLoading(prev => ({ ...prev, [friendshipId]: false }));
    }
  };

  /**
   * Handle cancel sent request
   */
  const handleCancelRequest = async (friendshipId, actionType) => {
    if (actionType === 'cancel') {
      try {
        mediumImpact();
        const result = await declineFriendRequest(friendshipId, user.uid);
        if (!result.success) {
          Alert.alert('Error', result.error || 'Failed to cancel friend request');
        }
      } catch (err) {
        logger.error('Error canceling friend request', err);
        Alert.alert('Error', 'Failed to cancel friend request');
      }
    }
  };

  /**
   * Handle remove friend (long press)
   */
  const handleRemoveFriend = friend => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friend.displayName || friend.username} as a friend?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              mediumImpact();
              const result = await removeFriend(user.uid, friend.userId);
              if (!result.success) {
                Alert.alert('Error', result.error || 'Failed to remove friend');
              }
              // Real-time listener will update the UI
            } catch (err) {
              logger.error('Error removing friend', err);
              Alert.alert('Error', 'Failed to remove friend');
            }
          },
        },
      ]
    );
  };

  /**
   * Handle friend card action from search results
   */
  const handleSearchAction = async (userId, actionType) => {
    if (actionType === 'add') {
      await handleAddFriend(userId);
    } else if (actionType === 'cancel') {
      const statusInfo = friendshipStatuses[userId];
      if (statusInfo?.friendshipId) {
        await handleCancelRequest(statusInfo.friendshipId, 'cancel');
        // Update local state
        setFriendshipStatuses(prev => ({
          ...prev,
          [userId]: { status: 'none', friendshipId: statusInfo.friendshipId },
        }));
      }
    }
  };

  /**
   * Render search bar
   */
  const renderSearchBar = (value, setValue, placeholder) => (
    <View style={styles.searchContainer}>
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        value={value}
        onChangeText={setValue}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => setValue('')} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  /**
   * Render section header
   */
  const renderSectionHeader = title => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  /**
   * Render empty state
   */
  const renderEmptyState = (icon, title, text) => (
    <View style={styles.emptyContainer}>
      <Ionicons name={icon} size={48} color={colors.text.tertiary} style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );

  /**
   * Render Friends tab content
   */
  const renderFriendsTab = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.text.primary} />
          <Text style={styles.loadingText}>Loading friends...</Text>
        </View>
      );
    }

    return (
      <>
        {renderSearchBar(friendsSearchQuery, setFriendsSearchQuery, 'Search friends...')}
        <FlatList
          data={filteredFriends}
          renderItem={({ item }) => (
            <TouchableOpacity onLongPress={() => handleRemoveFriend(item)}>
              <FriendCard
                user={item}
                relationshipStatus="friends"
                showFriendsSince={true}
                friendsSince={item.acceptedAt}
                onPress={() => {
                  navigation.navigate('OtherUserProfile', {
                    userId: item.userId,
                    username: item.username,
                  });
                }}
              />
            </TouchableOpacity>
          )}
          keyExtractor={item => item.friendshipId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.text.primary}
            />
          }
          ListEmptyComponent={
            friendsSearchQuery.trim()
              ? renderEmptyState(
                  'search-outline',
                  'No friends found',
                  'Try a different search term'
                )
              : renderEmptyState(
                  'people-outline',
                  'No friends yet',
                  'Search for friends in the Requests tab'
                )
          }
        />
      </>
    );
  };

  /**
   * Render Requests tab content
   */
  const renderRequestsTab = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.text.primary} />
          <Text style={styles.loadingText}>Loading requests...</Text>
        </View>
      );
    }

    // If searching, show search results
    if (requestsSearchQuery.trim()) {
      return (
        <>
          {renderSearchBar(requestsSearchQuery, setRequestsSearchQuery, 'Search users to add...')}
          {searchLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.text.primary} />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              renderItem={({ item }) => {
                const statusInfo = friendshipStatuses[item.userId] || { status: 'none' };
                return (
                  <FriendCard
                    user={item}
                    relationshipStatus={statusInfo.status}
                    friendshipId={statusInfo.friendshipId}
                    onAction={handleSearchAction}
                    onAccept={() => handleAcceptRequest(statusInfo.friendshipId)}
                    onDeny={() => handleDenyRequest(statusInfo.friendshipId)}
                    loading={actionLoading[item.userId]}
                    onPress={() => {
                      navigation.navigate('OtherUserProfile', {
                        userId: item.userId,
                        username: item.username,
                      });
                    }}
                  />
                );
              }}
              keyExtractor={item => item.userId}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={renderEmptyState(
                'search-outline',
                'No users found',
                'Try a different username'
              )}
            />
          )}
        </>
      );
    }

    // Show incoming and sent request sections
    const hasIncoming = incomingRequests.length > 0;
    const hasSent = sentRequests.length > 0;
    const hasRequests = hasIncoming || hasSent;

    // Build sections data
    const sections = [];
    if (hasIncoming) {
      sections.push({ type: 'header', title: 'Incoming' });
      incomingRequests.forEach(request => {
        sections.push({ type: 'incoming', data: request });
      });
    }
    if (hasSent) {
      sections.push({ type: 'header', title: 'Sent' });
      sentRequests.forEach(request => {
        sections.push({ type: 'sent', data: request });
      });
    }

    return (
      <>
        {renderSearchBar(requestsSearchQuery, setRequestsSearchQuery, 'Search users to add...')}
        {hasRequests ? (
          <FlatList
            data={sections}
            renderItem={({ item }) => {
              if (item.type === 'header') {
                return renderSectionHeader(item.title);
              }
              if (item.type === 'incoming') {
                return (
                  <FriendCard
                    user={item.data}
                    relationshipStatus="pending_received"
                    friendshipId={item.data.id}
                    onAccept={handleAcceptRequest}
                    onDeny={handleDenyRequest}
                    loading={actionLoading[item.data.id]}
                    onPress={() => {
                      navigation.navigate('OtherUserProfile', {
                        userId: item.data.userId,
                        username: item.data.username,
                      });
                    }}
                  />
                );
              }
              if (item.type === 'sent') {
                return (
                  <FriendCard
                    user={item.data}
                    relationshipStatus="pending_sent"
                    friendshipId={item.data.id}
                    onAction={handleCancelRequest}
                    loading={actionLoading[item.data.id]}
                    onPress={() => {
                      navigation.navigate('OtherUserProfile', {
                        userId: item.data.userId,
                        username: item.data.username,
                      });
                    }}
                  />
                );
              }
              return null;
            }}
            keyExtractor={(item, index) =>
              item.type === 'header' ? `header-${item.title}` : item.data.id
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.text.primary}
              />
            }
          />
        ) : (
          <View style={{ flex: 1 }}>
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.text.primary}
            />
            {renderEmptyState(
              'mail-outline',
              'No friend requests',
              'Search for users by username to add friends'
            )}
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Friends</Text>
      </View>

      {/* Tab navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
          onPress={() => setActiveTab('requests')}
          activeOpacity={0.7}
        >
          <View style={styles.tabContent}>
            <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
              Requests
            </Text>
            {incomingRequests.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{incomingRequests.length}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
          onPress={() => setActiveTab('friends')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
            Friends
          </Text>
        </TouchableOpacity>
      </View>

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Tab content */}
      {activeTab === 'friends' ? renderFriendsTab() : renderRequestsTab()}
    </SafeAreaView>
  );
};

export default FriendsScreen;
