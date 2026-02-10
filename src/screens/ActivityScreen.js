import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import PixelIcon from '../components/PixelIcon';
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
  acceptFriendRequest,
  declineFriendRequest,
} from '../services/firebase/friendshipService';
import { getTimeAgo } from '../utils/timeUtils';
import { mediumImpact } from '../utils/haptics';
import { markSingleNotificationAsRead } from '../services/firebase/notificationService';
import { typography } from '../constants/typography';
import logger from '../utils/logger';

const db = getFirestore();

/**
 * ActivityScreen - Friend requests + reaction notifications
 * Accessed via heart icon in feed header
 */
const ActivityScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [friendRequests, setFriendRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Deduplicate reaction notifications: keep only the latest per (senderId, photoId)
  const clumpedNotifications = useMemo(() => {
    const reactionKeys = new Map(); // key -> notification
    const result = [];

    for (const notif of notifications) {
      if (notif.type === 'reaction' && notif.senderId && notif.photoId) {
        const key = `${notif.senderId}-${notif.photoId}`;
        const existing = reactionKeys.get(key);
        if (!existing) {
          reactionKeys.set(key, notif);
          result.push(notif);
        } else {
          // Keep the one with the latest createdAt
          const existingTime = existing.createdAt?.seconds || 0;
          const newTime = notif.createdAt?.seconds || 0;
          if (newTime > existingTime) {
            // Replace existing in result array
            const idx = result.indexOf(existing);
            result[idx] = notif;
            reactionKeys.set(key, notif);
          }
          // else discard the older duplicate
        }
      } else {
        // Non-reaction notifications pass through unchanged
        result.push(notif);
      }
    }

    return result;
  }, [notifications]);

  const handleAccept = async requestId => {
    mediumImpact();
    const result = await acceptFriendRequest(requestId, user.uid);
    if (result.success) {
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
    } else {
      Alert.alert('Error', result.error || 'Failed to accept request');
    }
  };

  const handleDecline = async requestId => {
    mediumImpact();
    const result = await declineFriendRequest(requestId, user.uid);
    if (result.success) {
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
    } else {
      Alert.alert('Error', result.error || 'Failed to decline request');
    }
  };

  // Uses OtherUserProfile in root stack (not tab navigator) for viewing other users
  const handleAvatarPress = (userId, displayName) => {
    logger.debug('ActivityScreen: Avatar pressed', { userId, displayName });
    navigation.navigate('OtherUserProfile', { userId, username: displayName });
  };

  const formatReactionsText = reactions => {
    if (!reactions || typeof reactions !== 'object') return '';
    const parts = Object.entries(reactions)
      .filter(([, count]) => count > 0)
      .map(([emoji, count]) => `${emoji}×${count}`);
    return parts.length > 0 ? parts.join(' ') : '';
  };

  /**
   * Get action text for notification item
   * Strips sender name prefix if present so username can be bolded separately
   */
  const getActionText = item => {
    const senderName = item.senderName || 'Someone';

    if (item.message) {
      // If message starts with sender name, strip the prefix
      if (item.message.startsWith(senderName)) {
        return item.message.slice(senderName.length).trim();
      }
      // Message doesn't start with sender name - return full message
      return item.message;
    }

    if (item.reactions) {
      const reactionsText = formatReactionsText(item.reactions);
      return `reacted ${reactionsText} to your photo`;
    }

    return 'sent you a notification';
  };

  /**
   * Handle notification item press
   * Optimistic local update, then Firestore update, then navigation
   */
  const handleNotificationPress = async item => {
    // Mark as read locally (optimistic update)
    setNotifications(prev => prev.map(n => (n.id === item.id ? { ...n, read: true } : n)));

    // Mark as read in Firestore
    await markSingleNotificationAsRead(item.id);

    // Navigate based on notification type/data
    const { type, photoId, userId: notifUserId } = item;
    if (type === 'reaction' && photoId) {
      navigation.navigate('MainTabs', { screen: 'Feed', params: { photoId } });
    } else if (type === 'story' && notifUserId) {
      navigation.navigate('MainTabs', {
        screen: 'Feed',
        params: { highlightUserId: notifUserId, openStory: true },
      });
    } else if (type === 'tagged' && item.senderId) {
      navigation.navigate('MainTabs', {
        screen: 'Feed',
        params: { highlightUserId: item.senderId, highlightPhotoId: photoId, openStory: true },
      });
    } else if ((type === 'comment' || type === 'mention') && photoId) {
      navigation.navigate('MainTabs', { screen: 'Feed', params: { photoId } });
    } else if (type === 'friend_accepted' || type === 'friend_request') {
      navigation.navigate('FriendsList');
    } else if (item.senderId) {
      // Default: navigate to sender's profile
      handleAvatarPress(item.senderId, item.senderName);
    }
  };

  const renderFriendRequest = ({ item }) => {
    const { otherUser } = item;
    if (!otherUser) return null;

    return (
      <View style={styles.requestItem}>
        <TouchableOpacity
          onPress={() => handleAvatarPress(otherUser.id, otherUser.displayName)}
          activeOpacity={0.7}
        >
          {otherUser.profilePhotoURL ? (
            <Image source={{ uri: otherUser.profilePhotoURL }} style={styles.requestPhoto} />
          ) : (
            <View style={[styles.requestPhoto, styles.requestPhotoPlaceholder]}>
              <Text style={styles.requestPhotoText}>
                {otherUser.displayName?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.requestInfo}>
          <Text style={styles.requestName} numberOfLines={1}>
            {otherUser.displayName || otherUser.username}
          </Text>
          <Text style={styles.requestSubtext}>wants to be friends</Text>
        </View>
        <View style={styles.requestActions}>
          <TouchableOpacity style={styles.acceptButton} onPress={() => handleAccept(item.id)}>
            <PixelIcon name="checkmark" size={18} color={colors.icon.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.declineButton} onPress={() => handleDecline(item.id)}>
            <PixelIcon name="close" size={18} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderNotification = ({ item }) => {
    const actionText = getActionText(item);
    const isUnread = item.read !== true;

    return (
      <TouchableOpacity
        style={styles.notificationItem}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        {isUnread ? <View style={styles.unreadDot} /> : <View style={styles.readSpacer} />}
        <TouchableOpacity
          onPress={() => item.senderId && handleAvatarPress(item.senderId, item.senderName)}
          activeOpacity={0.7}
          disabled={!item.senderId}
        >
          {item.senderProfilePhotoURL ? (
            <Image source={{ uri: item.senderProfilePhotoURL }} style={styles.notifPhoto} />
          ) : (
            <View style={[styles.notifPhoto, styles.notifPhotoPlaceholder]}>
              <PixelIcon name="person" size={20} color={colors.text.tertiary} />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.notifContent}>
          <Text style={styles.notifMessage} numberOfLines={2}>
            <Text style={styles.notifSenderName}>{item.senderName || 'Someone'}</Text> {actionText}
          </Text>
        </View>
        <Text style={styles.notifTime}>
          {item.createdAt ? getTimeAgo(item.createdAt).replace(' ago', '') : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;

    if (friendRequests.length === 0 && clumpedNotifications.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <PixelIcon name="heart-outline" size={64} color={colors.text.tertiary} />
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyText}>Friend requests and reactions will appear here</Text>
        </View>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <PixelIcon name="chevron-back" size={28} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerSpacer} />
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <PixelIcon name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
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
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => navigation.navigate('FriendRequests')}
            >
              <Text style={styles.sectionTitle}>Friend Requests</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{friendRequests.length}</Text>
              </View>
              <PixelIcon name="chevron-forward" size={18} color={colors.text.tertiary} />
            </TouchableOpacity>
            {friendRequests.map(item => (
              <View key={item.id}>{renderFriendRequest({ item })}</View>
            ))}
          </View>
        )}

        {/* Reactions Section */}
        {clumpedNotifications.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { paddingHorizontal: 16, paddingVertical: 12 }]}>
              Reactions
            </Text>
            {clumpedNotifications.map(item => (
              <View key={item.id}>{renderNotification({ item })}</View>
            ))}
          </View>
        )}

        {renderEmpty()}
      </ScrollView>
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
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBadge: {
    backgroundColor: colors.brand.pink,
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
    marginRight: 'auto',
  },
  sectionBadgeText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
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
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
  },
  requestInfo: {
    flex: 1,
    marginRight: 12,
  },
  requestName: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  requestSubtext: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
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
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
    lineHeight: 20,
  },
  notifSenderName: {
    fontWeight: '700',
    color: colors.text.primary,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand.purple,
    marginRight: 6,
  },
  readSpacer: {
    width: 6,
    height: 6,
    marginRight: 6,
  },
  notifTime: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
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
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
    marginTop: 16,
  },
  emptyText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});

export default ActivityScreen;
