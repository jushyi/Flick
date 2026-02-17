import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import PixelIcon from '../components/PixelIcon';
import PixelSpinner from '../components/PixelSpinner';
import FriendCard from '../components/FriendCard';
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
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';
import { useAuth } from '../context/AuthContext';
import {
  getPendingRequests,
  acceptFriendRequest,
  declineFriendRequest,
} from '../services/firebase/friendshipService';
import { getTimeAgo } from '../utils/timeUtils';
import { mediumImpact } from '../utils/haptics';
import { markSingleNotificationAsRead } from '../services/firebase/notificationService';
import { getPhotoById, getUserStoriesData } from '../services/firebase/feedService';
import { isBlocked } from '../services/firebase/blockService';
import { usePhotoDetailActions } from '../context/PhotoDetailContext';
import StrokedNameText from '../components/StrokedNameText';

import { typography } from '../constants/typography';
import logger from '../utils/logger';

const db = getFirestore();

/**
 * Group notifications into time-based sections: Today, This Week, Earlier.
 * Handles Firestore Timestamps (with .seconds or .toDate()) and plain Dates.
 * Empty sections are omitted. Order within sections is preserved (already desc by createdAt).
 */
const groupNotificationsByTime = notifs => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = todayStart - 6 * 24 * 60 * 60 * 1000; // 7 days including today

  const today = [];
  const thisWeek = [];
  const earlier = [];

  for (const notif of notifs) {
    let ts;
    if (notif.createdAt?.seconds != null) {
      ts = notif.createdAt.seconds * 1000;
    } else if (notif.createdAt?.toDate) {
      ts = notif.createdAt.toDate().getTime();
    } else if (notif.createdAt instanceof Date) {
      ts = notif.createdAt.getTime();
    } else {
      ts = 0; // Unknown format -> earliest bucket
    }

    if (ts >= todayStart) {
      today.push(notif);
    } else if (ts >= weekAgo) {
      thisWeek.push(notif);
    } else {
      earlier.push(notif);
    }
  }

  const sections = [];
  if (today.length > 0) sections.push({ title: 'Today', data: today });
  if (thisWeek.length > 0) sections.push({ title: 'This Week', data: thisWeek });
  if (earlier.length > 0) sections.push({ title: 'Earlier', data: earlier });

  return sections;
};

/**
 * ActivityScreen - Friend requests + reaction notifications
 * Accessed via heart icon in feed header
 */
const ActivityScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { openPhotoDetail } = usePhotoDetailActions();
  const [friendRequests, setFriendRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

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
   * Handle deep link navigation from notifications
   * Opens PhotoDetail modal when shouldOpenPhoto param is present
   */
  useEffect(() => {
    const handleDeepLinkParams = async () => {
      const params = route.params || {};
      const { photoId, commentId, shouldOpenPhoto } = params;

      if (!shouldOpenPhoto || !photoId) {
        return;
      }

      logger.info('ActivityScreen: Opening photo from notification', { photoId, commentId });

      // Fetch photo
      const result = await getPhotoById(photoId);
      if (!result.success) {
        logger.error('ActivityScreen: Failed to fetch photo', { photoId, error: result.error });
        navigation.setParams({ shouldOpenPhoto: undefined });
        return;
      }

      // Open PhotoDetail modal
      openPhotoDetail({
        mode: 'feed',
        photo: result.photo,
        currentUserId: user?.uid,
        initialShowComments: !!commentId,
        targetCommentId: commentId || null,
      });

      navigation.navigate('PhotoDetail');

      // Clear params to prevent re-opening on back navigation
      navigation.setParams({
        shouldOpenPhoto: undefined,
        photoId: undefined,
        commentId: undefined,
      });
    };

    handleDeepLinkParams();
  }, [route.params, navigation, openPhotoDetail, user?.uid]);

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
      const notifs = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      // Batch-fetch unique sender user docs to get nameColor
      const uniqueSenderIds = [...new Set(notifs.map(n => n.senderId).filter(Boolean))];
      const colorMap = {};
      await Promise.all(
        uniqueSenderIds.map(async senderId => {
          try {
            const userDoc = await getDoc(doc(db, 'users', senderId));
            if (userDoc.exists()) {
              colorMap[senderId] = userDoc.data().nameColor || null;
            }
          } catch {
            // Ignore — will fall back to default color
          }
        })
      );

      return notifs.map(n => ({
        ...n,
        senderNameColor: n.senderId ? colorMap[n.senderId] || null : null,
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

  // Group clumped notifications into time-based sections
  const groupedSections = useMemo(
    () => groupNotificationsByTime(clumpedNotifications),
    [clumpedNotifications]
  );

  const handleAccept = async requestId => {
    mediumImpact();
    setActionLoading(prev => ({ ...prev, [requestId]: true }));
    const result = await acceptFriendRequest(requestId, user.uid);
    setActionLoading(prev => ({ ...prev, [requestId]: false }));
    if (result.success) {
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
    } else {
      Alert.alert('Error', result.error || 'Failed to accept request');
    }
  };

  const handleDecline = async requestId => {
    mediumImpact();
    setActionLoading(prev => ({ ...prev, [requestId]: true }));
    const result = await declineFriendRequest(requestId, user.uid);
    setActionLoading(prev => ({ ...prev, [requestId]: false }));
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

    // Story notifications use templates that may embed the name mid-sentence
    if (item.type === 'story') {
      return 'posted to their story';
    }

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
    const { type, photoId } = item;

    // Check block status before showing content from sender
    if (item.senderId && user?.uid) {
      const [blockedBySender, blockedSender] = await Promise.all([
        isBlocked(item.senderId, user.uid),
        isBlocked(user.uid, item.senderId),
      ]);
      const eitherBlocked =
        (blockedBySender.success && blockedBySender.isBlocked) ||
        (blockedSender.success && blockedSender.isBlocked);
      if (eitherBlocked) {
        return; // Silently ignore — content from blocked users not shown
      }
    }

    if (
      (type === 'reaction' || type === 'comment' || type === 'mention' || type === 'reply') &&
      photoId
    ) {
      // Fetch the photo and open PhotoDetail directly
      const result = await getPhotoById(photoId);
      if (result.success) {
        if (result.photo.photoState === 'deleted') {
          Alert.alert('Photo Deleted', 'This photo has been deleted.');
          return;
        }
        openPhotoDetail({
          mode: 'feed',
          photo: result.photo,
          currentUserId: user?.uid,
          initialShowComments: type === 'comment' || type === 'mention' || type === 'reply',
          targetCommentId: item.commentId || null,
        });
        navigation.navigate('PhotoDetail');
      }
    } else if (type === 'story' && item.senderId) {
      // Fetch the poster's story photos and open in stories mode
      const result = await getUserStoriesData(item.senderId);
      if (result.success && result.userStory?.hasPhotos) {
        openPhotoDetail({
          mode: 'stories',
          photos: result.userStory.topPhotos,
          initialIndex: 0,
          currentUserId: user?.uid,
          isOwnStory: false,
          hasNextFriend: false,
        });
        navigation.navigate('PhotoDetail');
      }
    } else if (type === 'tagged' && photoId) {
      // Fetch the tagged photo and open PhotoDetail directly
      const result = await getPhotoById(photoId);
      if (result.success) {
        if (result.photo.photoState === 'deleted') {
          Alert.alert('Photo Deleted', 'This photo has been deleted.');
          return;
        }
        openPhotoDetail({
          mode: 'feed',
          photo: result.photo,
          currentUserId: user?.uid,
          initialShowComments: false,
        });
        navigation.navigate('PhotoDetail');
      }
    } else if (type === 'friend_accepted' && item.senderId) {
      handleAvatarPress(item.senderId, item.senderName);
    } else if (type === 'friend_request') {
      navigation.navigate('FriendsList');
    } else if (item.senderId) {
      // Default: navigate to sender's profile
      handleAvatarPress(item.senderId, item.senderName);
    }
  };

  const renderFriendRequest = ({ item }) => {
    const { otherUser } = item;
    if (!otherUser) return null;

    // Transform otherUser to match FriendCard's expected user shape
    const user = {
      userId: otherUser.id,
      displayName: otherUser.displayName,
      username: otherUser.username,
      profilePhotoURL: otherUser.profilePhotoURL,
    };

    return (
      <FriendCard
        user={user}
        relationshipStatus="pending_received"
        friendshipId={item.id}
        onAccept={handleAccept}
        onDeny={handleDecline}
        loading={actionLoading[item.id]}
        onPress={() => handleAvatarPress(otherUser.id, otherUser.displayName)}
      />
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
            <StrokedNameText style={styles.notifSenderName} nameColor={item.senderNameColor}>
              {item.senderName || 'Someone'}
            </StrokedNameText>{' '}
            {actionText}
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
          <Text style={styles.emptyText}>Likes, comments, and other activity will appear here</Text>
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
          <PixelSpinner size="large" color={colors.text.primary} />
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
            tintColor={colors.interactive.primary}
            colors={[colors.interactive.primary]}
            progressBackgroundColor={colors.background.secondary}
          />
        }
      >
        {/* Pinned Friend Requests Section */}
        {friendRequests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Friend Requests</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{friendRequests.length}</Text>
              </View>
            </View>
            {friendRequests.map(item => (
              <View key={item.id}>{renderFriendRequest({ item })}</View>
            ))}
          </View>
        )}

        {/* Time-grouped Notifications */}
        {groupedSections.length > 0 && (
          <View style={styles.section}>
            {groupedSections.map(section => (
              <View key={section.title}>
                <Text style={[styles.sectionTitle, styles.timeSectionHeader]}>{section.title}</Text>
                {section.data.map(item => (
                  <View key={item.id}>{renderNotification({ item })}</View>
                ))}
              </View>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.primary,
  },
  backButton: {
    padding: spacing.xxs,
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
    marginBottom: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.secondary,
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeSectionHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: 20,
    paddingBottom: spacing.xs,
  },
  sectionBadge: {
    backgroundColor: colors.brand.pink,
    borderRadius: layout.borderRadius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    marginLeft: spacing.xs,
    marginRight: 'auto',
  },
  sectionBadgeText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  notifPhoto: {
    width: layout.dimensions.avatarMedium + 4,
    height: layout.dimensions.avatarMedium + 4,
    borderRadius: layout.borderRadius.round,
    marginRight: spacing.sm,
  },
  notifPhotoPlaceholder: {
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  notifMessage: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.primary,
    lineHeight: 20,
  },
  notifSenderName: {
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.interactive.primary,
    marginRight: 6,
  },
  readSpacer: {
    width: 6,
    height: 6,
    marginRight: 6,
  },
  notifTime: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.tertiary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: spacing.xxl,
  },
  emptyTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
  },
});

export default ActivityScreen;
