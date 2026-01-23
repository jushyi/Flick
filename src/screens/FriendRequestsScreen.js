import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import FriendRequestCard from '../components/FriendRequestCard';
import {
  getPendingRequests,
  getSentRequests,
  acceptFriendRequest,
  declineFriendRequest,
  subscribeFriendships,
} from '../services/firebase/friendshipService';
import logger from '../utils/logger';
import { mediumImpact } from '../utils/haptics';

/**
 * FriendRequestsScreen - Manage incoming and outgoing friend requests
 *
 * Features:
 * - Tab navigation: "Received" | "Sent"
 * - Received tab: List of incoming requests with Accept/Decline buttons
 * - Sent tab: List of outgoing requests with Cancel button
 * - Real-time updates using subscribeFriendships
 * - Badge count on Received tab
 * - Pull-to-refresh
 */
const FriendRequestsScreen = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('received');
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch friend requests
   */
  const fetchRequests = async () => {
    try {
      setError(null);

      // Fetch both received and sent requests in parallel
      const [receivedResult, sentResult] = await Promise.all([
        getPendingRequests(user.uid),
        getSentRequests(user.uid),
      ]);

      if (receivedResult.success) {
        setReceivedRequests(receivedResult.requests);
      } else {
        logger.error('Error fetching received requests', { error: receivedResult.error });
      }

      if (sentResult.success) {
        setSentRequests(sentResult.requests);
      } else {
        logger.error('Error fetching sent requests', { error: sentResult.error });
      }
    } catch (err) {
      logger.error('Error fetching requests', err);
      setError('Failed to load friend requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Set up real-time listener
   */
  useEffect(() => {
    fetchRequests();

    // Set up real-time listener for friendship changes
    const unsubscribe = subscribeFriendships(user.uid, friendships => {
      // Filter for pending requests
      const received = friendships.filter(
        f => f.status === 'pending' && f.requestedBy !== user.uid
      );
      const sent = friendships.filter(f => f.status === 'pending' && f.requestedBy === user.uid);

      setReceivedRequests(received);
      setSentRequests(sent);
    });

    return () => unsubscribe();
  }, [user.uid]);

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  /**
   * Handle accepting a friend request
   */
  const handleAccept = async friendshipId => {
    try {
      mediumImpact();

      const result = await acceptFriendRequest(friendshipId, user.uid);

      if (!result.success) {
        logger.error('Failed to accept friend request', { error: result.error });
        alert(result.error || 'Failed to accept friend request');
      }
      // Real-time listener will update the UI
    } catch (err) {
      logger.error('Error accepting friend request', err);
      alert('Failed to accept friend request');
    }
  };

  /**
   * Handle declining a friend request
   */
  const handleDecline = async friendshipId => {
    try {
      mediumImpact();

      const result = await declineFriendRequest(friendshipId, user.uid);

      if (!result.success) {
        logger.error('Failed to decline friend request', { error: result.error });
        alert(result.error || 'Failed to decline friend request');
      }
      // Real-time listener will update the UI
    } catch (err) {
      logger.error('Error declining friend request', err);
      alert('Failed to decline friend request');
    }
  };

  /**
   * Handle canceling a sent request
   */
  const handleCancel = async friendshipId => {
    try {
      mediumImpact();

      const result = await declineFriendRequest(friendshipId, user.uid);

      if (!result.success) {
        logger.error('Failed to cancel friend request', { error: result.error });
        alert(result.error || 'Failed to cancel friend request');
      }
      // Real-time listener will update the UI
    } catch (err) {
      logger.error('Error canceling friend request', err);
      alert('Failed to cancel friend request');
    }
  };

  /**
   * Render single request
   */
  const renderRequest = ({ item }) => (
    <FriendRequestCard
      request={item}
      type={activeTab}
      onAccept={handleAccept}
      onDecline={handleDecline}
      onCancel={handleCancel}
      currentUserId={user.uid}
    />
  );

  /**
   * Render empty state
   */
  const renderEmptyState = () => {
    if (loading) return null;

    const isReceivedTab = activeTab === 'received';

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>{isReceivedTab ? '📬' : '📤'}</Text>
        <Text style={styles.emptyTitle}>
          {isReceivedTab ? 'No friend requests' : 'No sent requests'}
        </Text>
        <Text style={styles.emptyText}>
          {isReceivedTab
            ? 'Friend requests will appear here'
            : 'Requests you send will appear here'}
        </Text>
      </View>
    );
  };

  /**
   * Get current tab data
   */
  const currentData = activeTab === 'received' ? receivedRequests : sentRequests;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friend Requests</Text>
      </View>

      {/* Tab navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'received' && styles.tabActive]}
          onPress={() => setActiveTab('received')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'received' && styles.tabTextActive]}>
            Received
            {receivedRequests.length > 0 && (
              <Text style={styles.badge}> ({receivedRequests.length})</Text>
            )}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'sent' && styles.tabActive]}
          onPress={() => setActiveTab('sent')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'sent' && styles.tabTextActive]}>Sent</Text>
        </TouchableOpacity>
      </View>

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
          <Text style={styles.loadingText}>Loading requests...</Text>
        </View>
      ) : (
        <FlatList
          data={currentData}
          renderItem={renderRequest}
          keyExtractor={item => item.id}
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#000000',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  tabTextActive: {
    color: '#000000',
  },
  badge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9500',
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
  },
});

export default FriendRequestsScreen;
