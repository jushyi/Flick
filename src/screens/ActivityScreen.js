import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Image,
  ActivityIndicator,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from '@react-native-firebase/firestore';
import { colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import {
  getPendingRequests,
  getSentRequests,
  getFriendships,
  acceptFriendRequest,
  declineFriendRequest,
  sendFriendRequest,
  removeFriend,
  checkFriendshipStatus,
  subscribeFriendships,
} from '../services/firebase/friendshipService';
import { getTimeAgo } from '../utils/timeUtils';
import { mediumImpact } from '../utils/haptics';
import { markNotificationsAsRead } from '../services/firebase/notificationService';
import logger from '../utils/logger';

const db = getFirestore();
const Tab = createMaterialTopTabNavigator();

/**
 * Notifications Tab - Pinned friend requests + reaction notifications
 */
const NotificationsTab = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [friendRequests, setFriendRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Fetch friend requests (incoming only)
   */
  const fetchFriendRequests = useCallback(async () => {
    if (!user?.uid) return [];

    try {
      const result = await getPendingRequests(user.uid);
      if (result.success) {
        // Fetch user data for each request
        const requestsWithUserData = await Promise.all(
          result.requests.map(async request => {
            const otherUserId = request.user1Id === user.uid ? request.user2Id : request.user1Id;
            try {
              const userDoc = await getDoc(doc(db, 'users', otherUserId));
              if (userDoc.exists()) {
                return {
                  ...request,
                  otherUser: { id: userDoc.id, ...userDoc.data() },
                };
              }
            } catch {
              logger.error('Failed to fetch user for friend request');
            }
            return { ...request, otherUser: null };
          })
        );
        return requestsWithUserData.filter(r => r.otherUser);
      }
    } catch (error) {
      logger.error('Error fetching friend requests', { error: error.message });
    }
    return [];
  }, [user?.uid]);

  /**
   * Fetch notifications (reactions)
   */
  const fetchNotifications = useCallback(async () => {
    if (!user?.uid) return [];

    try {
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('recipientId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
    } catch (error) {
      logger.error('Error fetching notifications', { error: error.message });
    }
    return [];
  }, [user?.uid]);

  /**
   * Load all data
   */
  const loadData = useCallback(async () => {
    const [requests, notifs] = await Promise.all([fetchFriendRequests(), fetchNotifications()]);
    setFriendRequests(requests);
    setNotifications(notifs);
    setLoading(false);
    setRefreshing(false);
  }, [fetchFriendRequests, fetchNotifications]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Mark notifications as read when tab is focused
   */
  useFocusEffect(
    useCallback(() => {
      // Only mark as read if data is loaded
      if (!loading && user?.uid) {
        markNotificationsAsRead(user.uid);
      }
    }, [loading, user?.uid])
  );

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  /**
   * Handle accept friend request
   */
  const handleAccept = async requestId => {
    mediumImpact();
    const result = await acceptFriendRequest(requestId, user.uid);
    if (result.success) {
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
    } else {
      Alert.alert('Error', result.error || 'Failed to accept request');
    }
  };

  /**
   * Handle decline friend request
   */
  const handleDecline = async requestId => {
    mediumImpact();
    const result = await declineFriendRequest(requestId, user.uid);
    if (result.success) {
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
    } else {
      Alert.alert('Error', result.error || 'Failed to decline request');
    }
  };

  /**
   * Format reactions text
   */
  const formatReactionsText = reactions => {
    if (!reactions || typeof reactions !== 'object') return '';
    const parts = Object.entries(reactions)
      .filter(([, count]) => count > 0)
      .map(([emoji, count]) => `${emoji}×${count}`);
    return parts.length > 0 ? parts.join(' ') : '';
  };

  /**
   * Render friend request item (compact)
   */
  const renderFriendRequest = ({ item }) => {
    const { otherUser } = item;
    if (!otherUser) return null;

    return (
      <View style={notifStyles.requestItem}>
        {otherUser.profilePhotoURL ? (
          <Image source={{ uri: otherUser.profilePhotoURL }} style={notifStyles.requestPhoto} />
        ) : (
          <View style={[notifStyles.requestPhoto, notifStyles.requestPhotoPlaceholder]}>
            <Text style={notifStyles.requestPhotoText}>
              {otherUser.displayName?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <View style={notifStyles.requestInfo}>
          <Text style={notifStyles.requestName} numberOfLines={1}>
            {otherUser.displayName || otherUser.username}
          </Text>
          <Text style={notifStyles.requestSubtext}>wants to be friends</Text>
        </View>
        <View style={notifStyles.requestActions}>
          <TouchableOpacity style={notifStyles.acceptButton} onPress={() => handleAccept(item.id)}>
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={notifStyles.declineButton}
            onPress={() => handleDecline(item.id)}
          >
            <Ionicons name="close" size={18} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  /**
   * Render notification item
   */
  const renderNotification = ({ item }) => {
    const reactionsText = formatReactionsText(item.reactions);
    const displayMessage =
      item.message || `${item.senderName || 'Someone'} reacted ${reactionsText} to your photo`;

    return (
      <View style={notifStyles.notificationItem}>
        {item.senderProfilePhotoURL ? (
          <Image source={{ uri: item.senderProfilePhotoURL }} style={notifStyles.notifPhoto} />
        ) : (
          <View style={[notifStyles.notifPhoto, notifStyles.notifPhotoPlaceholder]}>
            <Ionicons name="person" size={20} color={colors.text.tertiary} />
          </View>
        )}
        <View style={notifStyles.notifContent}>
          <Text style={notifStyles.notifMessage} numberOfLines={2}>
            {displayMessage}
          </Text>
        </View>
        <Text style={notifStyles.notifTime}>
          {item.createdAt ? getTimeAgo(item.createdAt).replace(' ago', '') : ''}
        </Text>
      </View>
    );
  };

  /**
   * Render empty state
   */
  const renderEmpty = () => {
    if (loading) return null;

    if (friendRequests.length === 0 && notifications.length === 0) {
      return (
        <View style={notifStyles.emptyContainer}>
          <Ionicons name="heart-outline" size={64} color={colors.text.tertiary} />
          <Text style={notifStyles.emptyTitle}>No activity yet</Text>
          <Text style={notifStyles.emptyText}>Friend requests and reactions will appear here</Text>
        </View>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <View style={notifStyles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.text.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={notifStyles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.text.primary}
        />
      }
    >
      {/* Pinned Friend Requests Section */}
      {friendRequests.length > 0 && (
        <View style={notifStyles.section}>
          <TouchableOpacity
            style={notifStyles.sectionHeader}
            onPress={() => navigation.navigate('FriendRequests')}
          >
            <Text style={notifStyles.sectionTitle}>Friend Requests</Text>
            <View style={notifStyles.sectionBadge}>
              <Text style={notifStyles.sectionBadgeText}>{friendRequests.length}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
          </TouchableOpacity>
          {friendRequests.map(item => (
            <View key={item.id}>{renderFriendRequest({ item })}</View>
          ))}
        </View>
      )}

      {/* Reactions Section */}
      {notifications.length > 0 && (
        <View style={notifStyles.section}>
          <Text style={[notifStyles.sectionTitle, { paddingHorizontal: 16, paddingVertical: 12 }]}>
            Reactions
          </Text>
          {notifications.map(item => (
            <View key={item.id}>{renderNotification({ item })}</View>
          ))}
        </View>
      )}

      {renderEmpty()}
    </ScrollView>
  );
};

/**
 * Friends Tab - Consolidated friend management
 */
const FriendsTab = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friends, setFriends] = useState([]);
  const [pendingIncoming, setPendingIncoming] = useState(0);
  const [pendingOutgoing, setPendingOutgoing] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [friendshipStatuses, setFriendshipStatuses] = useState({});

  /**
   * Fetch friends list with user data
   */
  const fetchFriends = useCallback(async () => {
    if (!user?.uid) return [];

    try {
      const result = await getFriendships(user.uid);
      if (!result.success) return [];

      const friendsWithData = await Promise.all(
        result.friendships.map(async friendship => {
          const otherUserId =
            friendship.user1Id === user.uid ? friendship.user2Id : friendship.user1Id;
          try {
            const userDoc = await getDoc(doc(db, 'users', otherUserId));
            if (userDoc.exists()) {
              return {
                friendshipId: friendship.id,
                acceptedAt: friendship.acceptedAt,
                userId: otherUserId,
                ...userDoc.data(),
              };
            }
          } catch {
            logger.error('Failed to fetch friend user data');
          }
          return null;
        })
      );

      return friendsWithData
        .filter(f => f !== null)
        .sort((a, b) => {
          const nameA = (a.displayName || a.username || '').toLowerCase();
          const nameB = (b.displayName || b.username || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
    } catch (error) {
      logger.error('Error fetching friends', { error: error.message });
    }
    return [];
  }, [user?.uid]);

  /**
   * Fetch pending request counts
   */
  const fetchPendingCounts = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const [incomingResult, outgoingResult] = await Promise.all([
        getPendingRequests(user.uid),
        getSentRequests(user.uid),
      ]);

      setPendingIncoming(incomingResult.success ? incomingResult.requests.length : 0);
      setPendingOutgoing(outgoingResult.success ? outgoingResult.requests.length : 0);
    } catch (error) {
      logger.error('Error fetching pending counts', { error: error.message });
    }
  }, [user?.uid]);

  /**
   * Load all data
   */
  const loadData = useCallback(async () => {
    const friendsList = await fetchFriends();
    setFriends(friendsList);
    await fetchPendingCounts();
    setLoading(false);
    setRefreshing(false);
  }, [fetchFriends, fetchPendingCounts]);

  useEffect(() => {
    loadData();

    // Set up real-time listener
    const unsubscribe = subscribeFriendships(user?.uid, () => {
      loadData();
    });

    return () => unsubscribe();
  }, [loadData, user?.uid]);

  /**
   * Debounced search
   */
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setFriendshipStatuses({});
      return;
    }

    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  /**
   * Search users by username
   */
  const searchUsers = async term => {
    setSearching(true);
    try {
      const normalizedTerm = term.toLowerCase().trim();
      const usersQuery = query(
        collection(db, 'users'),
        where('username', '>=', normalizedTerm),
        where('username', '<=', normalizedTerm + '\uf8ff'),
        limit(20)
      );

      const snapshot = await getDocs(usersQuery);
      const results = [];
      snapshot.forEach(docSnap => {
        if (docSnap.id !== user.uid) {
          results.push({ id: docSnap.id, ...docSnap.data() });
        }
      });

      setSearchResults(results);

      // Fetch friendship statuses
      if (results.length > 0) {
        const statuses = {};
        await Promise.all(
          results.map(async searchUser => {
            const statusResult = await checkFriendshipStatus(user.uid, searchUser.id);
            if (statusResult.success) {
              statuses[searchUser.id] = statusResult.status;
            }
          })
        );
        setFriendshipStatuses(statuses);
      }
    } catch (error) {
      logger.error('Error searching users', { error: error.message });
    } finally {
      setSearching(false);
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
   * Handle send friend request
   */
  const handleSendRequest = async toUserId => {
    mediumImpact();
    setFriendshipStatuses(prev => ({ ...prev, [toUserId]: 'pending_sent' }));

    const result = await sendFriendRequest(user.uid, toUserId);
    if (!result.success) {
      setFriendshipStatuses(prev => ({ ...prev, [toUserId]: 'none' }));
      Alert.alert('Error', result.error || 'Failed to send request');
    }
  };

  /**
   * Handle remove friend
   */
  const handleRemoveFriend = friend => {
    Alert.alert('Remove Friend', `Remove ${friend.displayName || friend.username} as a friend?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          mediumImpact();
          const result = await removeFriend(user.uid, friend.userId);
          if (!result.success) {
            Alert.alert('Error', result.error || 'Failed to remove friend');
          }
        },
      },
    ]);
  };

  /**
   * Get button config for search results
   */
  const getButtonConfig = status => {
    switch (status) {
      case 'friends':
        return { label: 'Friends', disabled: true, style: 'disabled' };
      case 'pending_sent':
        return { label: 'Pending', disabled: true, style: 'pending' };
      case 'pending_received':
        return { label: 'Respond', disabled: false, style: 'active' };
      default:
        return { label: 'Add', disabled: false, style: 'active' };
    }
  };

  /**
   * Render search result
   */
  const renderSearchResult = item => {
    const status = friendshipStatuses[item.id] || 'none';
    const config = getButtonConfig(status);

    return (
      <View key={item.id} style={friendStyles.searchResultItem}>
        {item.profilePhotoURL ? (
          <Image source={{ uri: item.profilePhotoURL }} style={friendStyles.searchResultPhoto} />
        ) : (
          <View style={[friendStyles.searchResultPhoto, friendStyles.photoPlaceholder]}>
            <Text style={friendStyles.photoPlaceholderText}>
              {item.displayName?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <View style={friendStyles.searchResultInfo}>
          <Text style={friendStyles.searchResultName} numberOfLines={1}>
            {item.displayName || 'Unknown'}
          </Text>
          <Text style={friendStyles.searchResultUsername} numberOfLines={1}>
            @{item.username || 'unknown'}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            friendStyles.addButton,
            config.style === 'disabled' && friendStyles.addButtonDisabled,
            config.style === 'pending' && friendStyles.addButtonPending,
          ]}
          onPress={() =>
            status === 'pending_received'
              ? navigation.navigate('FriendRequests')
              : handleSendRequest(item.id)
          }
          disabled={config.disabled}
        >
          <Text
            style={[
              friendStyles.addButtonText,
              config.style === 'disabled' && friendStyles.addButtonTextDisabled,
              config.style === 'pending' && friendStyles.addButtonTextPending,
            ]}
          >
            {config.label}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  /**
   * Render friend item
   */
  const renderFriend = item => (
    <TouchableOpacity
      key={item.friendshipId}
      style={friendStyles.friendItem}
      onLongPress={() => handleRemoveFriend(item)}
      activeOpacity={0.7}
    >
      {item.profilePhotoURL ? (
        <Image source={{ uri: item.profilePhotoURL }} style={friendStyles.friendPhoto} />
      ) : (
        <View style={[friendStyles.friendPhoto, friendStyles.photoPlaceholder]}>
          <Text style={friendStyles.photoPlaceholderText}>
            {item.displayName?.[0]?.toUpperCase() || '?'}
          </Text>
        </View>
      )}
      <View style={friendStyles.friendInfo}>
        <Text style={friendStyles.friendName} numberOfLines={1}>
          {item.displayName || 'Unknown'}
        </Text>
        <Text style={friendStyles.friendUsername} numberOfLines={1}>
          @{item.username || 'unknown'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={friendStyles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.text.primary} />
      </View>
    );
  }

  const totalPending = pendingIncoming + pendingOutgoing;

  return (
    <ScrollView
      style={friendStyles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.text.primary}
        />
      }
    >
      {/* Search Bar */}
      <View style={friendStyles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color={colors.text.tertiary}
          style={friendStyles.searchIcon}
        />
        <TextInput
          style={friendStyles.searchInput}
          placeholder="Search for friends..."
          placeholderTextColor={colors.text.tertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Search Results */}
      {searchQuery.trim() && (
        <View style={friendStyles.section}>
          <Text style={friendStyles.sectionTitle}>Search Results</Text>
          {searching ? (
            <ActivityIndicator size="small" color={colors.text.primary} style={{ padding: 20 }} />
          ) : searchResults.length > 0 ? (
            searchResults.map(renderSearchResult)
          ) : (
            <Text style={friendStyles.emptyText}>No users found</Text>
          )}
        </View>
      )}

      {/* Pending Requests */}
      {!searchQuery.trim() && totalPending > 0 && (
        <TouchableOpacity
          style={friendStyles.pendingSection}
          onPress={() => navigation.navigate('FriendRequests')}
        >
          <View style={friendStyles.pendingIcon}>
            <Ionicons name="people" size={24} color={colors.brand.purple} />
          </View>
          <View style={friendStyles.pendingInfo}>
            <Text style={friendStyles.pendingTitle}>Pending Requests</Text>
            <Text style={friendStyles.pendingSubtext}>
              {pendingIncoming > 0 && `${pendingIncoming} incoming`}
              {pendingIncoming > 0 && pendingOutgoing > 0 && ' · '}
              {pendingOutgoing > 0 && `${pendingOutgoing} sent`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
        </TouchableOpacity>
      )}

      {/* Friends List */}
      {!searchQuery.trim() && (
        <View style={friendStyles.section}>
          <Text style={friendStyles.sectionTitle}>
            Friends {friends.length > 0 && `(${friends.length})`}
          </Text>
          {friends.length > 0 ? (
            friends.map(renderFriend)
          ) : (
            <View style={friendStyles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={colors.text.tertiary} />
              <Text style={friendStyles.emptyTitle}>No friends yet</Text>
              <Text style={friendStyles.emptySubtext}>Search above to find and add friends</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

/**
 * Activity Screen - Two-tab structure for Notifications and Friends
 * Accessed via heart icon in feed header (Instagram-style Activity page)
 */
const ActivityScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Top Tab Navigator */}
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: styles.tabBar,
          tabBarIndicatorStyle: styles.tabIndicator,
          tabBarActiveTintColor: colors.text.primary,
          tabBarInactiveTintColor: colors.text.secondary,
          tabBarLabelStyle: styles.tabLabel,
          tabBarPressColor: 'transparent',
        }}
      >
        <Tab.Screen name="Notifications" component={NotificationsTab} />
        <Tab.Screen name="Friends" component={FriendsTab} />
      </Tab.Navigator>
    </SafeAreaView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.primary,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 36,
  },
  tabBar: {
    backgroundColor: colors.background.primary,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  tabIndicator: {
    backgroundColor: colors.brand.purple,
    height: 2,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'none',
  },
});

// Notifications Tab Styles
const notifStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.secondary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBadge: {
    backgroundColor: colors.brand.pink,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
    marginRight: 'auto',
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  requestPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  requestPhotoPlaceholder: {
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestPhotoText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  requestInfo: {
    flex: 1,
    marginRight: 12,
  },
  requestName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  requestSubtext: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: colors.brand.purple,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: colors.background.tertiary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  notifPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  notifPhotoPlaceholder: {
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifContent: {
    flex: 1,
    marginRight: 12,
  },
  notifMessage: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  notifTime: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});

// Friends Tab Styles
const friendStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
    paddingVertical: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pendingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  pendingIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand.purple + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  pendingSubtext: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  searchResultPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  searchResultInfo: {
    flex: 1,
    marginRight: 12,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  searchResultUsername: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: colors.brand.purple,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addButtonDisabled: {
    backgroundColor: colors.background.tertiary,
  },
  addButtonTextDisabled: {
    color: colors.text.tertiary,
  },
  addButtonPending: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.text.tertiary,
  },
  addButtonTextPending: {
    color: colors.text.secondary,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  friendPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  photoPlaceholder: {
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  friendUsername: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    padding: 20,
  },
});

export default ActivityScreen;
