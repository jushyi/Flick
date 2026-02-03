import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { getTimeAgo } from '../utils/timeUtils';
import logger from '../utils/logger';

const db = getFirestore();

/**
 * NotificationsScreen - Displays list of reaction notifications
 * Instagram-style vertical list with profile photo, message, and timestamp
 */
const NotificationsScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Fetch notifications from Firestore
   */
  const fetchNotifications = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    logger.debug('NotificationsScreen: Fetching notifications', { userId: user.uid });

    try {
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('recipientId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const snapshot = await getDocs(q);
      const notificationsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      logger.info('NotificationsScreen: Loaded notifications', { count: notificationsList.length });
      setNotifications(notificationsList);
    } catch (error) {
      logger.error('NotificationsScreen: Failed to fetch notifications', { error: error.message });
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  /**
   * Load notifications on mount
   */
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  /**
   * Render a single notification item
   */
  const renderNotificationItem = ({ item }) => {
    // Format reactions display (e.g., "reacted 😂×2 ❤️×1")
    const formatReactionsText = reactions => {
      if (!reactions || typeof reactions !== 'object') return '';

      const parts = Object.entries(reactions)
        .filter(([_, count]) => count > 0)
        .map(([emoji, count]) => `${emoji}×${count}`);

      return parts.length > 0 ? parts.join(' ') : '';
    };

    const reactionsText = formatReactionsText(item.reactions);
    const displayMessage =
      item.message || `${item.senderName || 'Someone'} reacted ${reactionsText} to your photo`;

    return (
      <View style={styles.notificationItem}>
        {/* Profile Photo */}
        <View style={styles.profilePhotoContainer}>
          {item.senderProfilePhotoURL ? (
            <Image source={{ uri: item.senderProfilePhotoURL }} style={styles.profilePhoto} />
          ) : (
            <View style={styles.profilePhotoPlaceholder}>
              <Ionicons name="person" size={24} color={colors.text.secondary} />
            </View>
          )}
        </View>

        {/* Message */}
        <View style={styles.messageContainer}>
          <Text style={styles.messageText} numberOfLines={2}>
            {displayMessage}
          </Text>
        </View>

        {/* Timestamp */}
        <Text style={styles.timestamp}>
          {item.createdAt ? getTimeAgo(item.createdAt).replace(' ago', '') : ''}
        </Text>
      </View>
    );
  };

  /**
   * Render empty state
   */
  const renderEmptyState = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="heart-outline" size={64} color={colors.text.tertiary} />
        <Text style={styles.emptyTitle}>No notifications yet</Text>
        <Text style={styles.emptyText}>
          When friends react to your photos, you&apos;ll see it here
        </Text>
      </View>
    );
  };

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.text.primary} />
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      {/* Notifications List */}
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.text.primary}
          />
        }
        ListEmptyComponent={renderEmptyState}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  backButton: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.secondary,
  },
  profilePhotoContainer: {
    marginRight: 12,
  },
  profilePhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  profilePhotoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageContainer: {
    flex: 1,
    marginRight: 12,
  },
  messageText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginLeft: 78, // Profile photo width + margin
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default NotificationsScreen;
