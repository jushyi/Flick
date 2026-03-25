import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import PixelIcon from '../components/PixelIcon';
import PixelSpinner from '../components/PixelSpinner';
import { ActivitySkeleton } from '../components/skeletons/ActivitySkeleton';
import { EmptyState } from '../components/EmptyState';
import FriendCard from '../components/FriendCard';
import { supabase } from '../lib/supabase';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';
import { useAuth } from '../context/AuthContext';
import {
  getPendingRequests,
  acceptFriendRequest,
  declineFriendRequest,
} from '../services/supabase/friendshipService';
import { getTimeAgo } from '../utils/timeUtils';
import { profileCacheKey } from '../utils/imageUtils';
import { mediumImpact } from '../utils/haptics';
// TODO(20-01): notificationService mark functions - needs migration
const markSingleNotificationAsRead = async (..._args: any[]): Promise<any> => ({ success: true });
const markNotificationReadFromPushData = async (..._args: any[]): Promise<any> => ({ success: true });
const markNotificationsAsRead = async (..._args: any[]): Promise<any> => ({ success: true });
import { getPhotoByIdWithUser as getPhotoById } from '../services/supabase/feedService';
// TODO(20-01): getUserStoriesData - no supabase equivalent yet
const getUserStoriesData = async (..._args: any[]): Promise<any> => ({ success: false, userStory: null });
import { isBlocked } from '../services/supabase/blockService';
import { usePhotoDetailActions } from '../context/PhotoDetailContext';
import StrokedNameText from '../components/StrokedNameText';

import { typography } from '../constants/typography';
import logger from '../utils/logger';

/**
 * Group notifications into time-based sections: Today, This Week, Earlier.
 * Handles Firestore Timestamps (with .seconds or .toDate()) and plain Dates.
 * Empty sections are omitted. Order within sections is preserved (already desc by createdAt).
 */
const groupNotificationsByTime = (notifs: any[]) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = todayStart - 6 * 24 * 60 * 60 * 1000; // 7 days including today

  const today: any[] = [];
  const thisWeek: any[] = [];
  const earlier: any[] = [];

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

  const sections: any[] = [];
  if (today.length > 0) sections.push({ title: 'Today', data: today });
  if (thisWeek.length > 0) sections.push({ title: 'This Week', data: thisWeek });
  if (earlier.length > 0) sections.push({ title: 'Earlier', data: earlier });

  return sections;
};

const NotificationAvatar = ({ url, senderId, style }: { url: any; senderId: any; style: any }) => {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <View style={[style, styles.notifPhotoPlaceholder]}>
        <PixelIcon name="person" size={20} color={colors.text.tertiary} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: url, cacheKey: profileCacheKey(`notif-avatar-${senderId}`, url) }}
      style={style}
      cachePolicy="memory-disk"
      transition={0}
      onError={() => setFailed(true)}
    />
  );
};

const formatReactionsText = (reactions: any) => {
  if (!reactions || typeof reactions !== 'object') return '';
  const parts = Object.entries(reactions)
    .filter(([, count]) => (count as number) > 0)
    .map(([emoji, count]) => `${emoji}×${count}`);
  return parts.length > 0 ? parts.join(' ') : '';
};

const getActionText = item => {
  const senderName = item.senderName || 'Someone';

  if (item.type === 'story') {
    return 'posted to their story';
  }

  if (item.message) {
    if (item.message.startsWith(senderName)) {
      return item.message.slice(senderName.length).trim();
    }
    return item.message;
  }

  if (item.reactions) {
    const reactionsText = formatReactionsText(item.reactions);
    return `reacted ${reactionsText} to your photo`;
  }

  return 'sent you a notification';
};

/**
 * Individual notification row.
 * Measures its own screen position on press so the caller can pass sourceRect
 * to openPhotoDetail() for the expand/suck-back animation.
 */
const NotificationItem = ({ item, onPress, onAvatarPress }: { item: any; onPress: any; onAvatarPress: any }) => {
  const rowRef = useRef<any>(null);
  const actionText = getActionText(item);
  const isUnread = item.read !== true;

  const handlePress = () => {
    if (rowRef.current) {
      rowRef.current.measureInWindow((x, y, width, height) => {
        onPress(item, { x, y, width, height, borderRadius: 0 });
      });
    } else {
      onPress(item, null);
    }
  };

  return (
    <TouchableOpacity
      ref={rowRef}
      style={styles.notificationItem}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {isUnread ? <View style={styles.unreadDot} /> : <View style={styles.readSpacer} />}
      <TouchableOpacity
        onPress={() => item.senderId && onAvatarPress(item.senderId, item.senderName)}
        activeOpacity={0.7}
        disabled={!item.senderId}
      >
        <NotificationAvatar
          url={item.senderProfilePhotoURL}
          senderId={item.senderId}
          style={styles.notifPhoto}
        />
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

/**
 * ActivityScreen - Friend requests + reaction notifications
 * Accessed via heart icon in feed header
 */
const ActivityScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { openPhotoDetail } = usePhotoDetailActions();
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const fetchFriendRequests = useCallback(async () => {
    if (!user?.id) return [];

    try {
      const requests = await getPendingRequests(user.id);
      {
        // Fetch user data for each request
        const requestsWithUserData = await Promise.all(
          requests.map(async (request: any) => {
            const otherUserId = request.user1Id === user.id ? request.user2Id : request.user1Id;
            try {
              const { data: userData, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', otherUserId)
                .single();
              if (!error && userData) {
                const ud = userData as any;
                return {
                  ...request,
                  otherUser: { id: ud.id, ...ud },
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
      logger.error('Error fetching friend requests', { error: (error as Error).message });
    }
    return [];
  }, [user?.id]);

  /**
   * Handle deep link navigation from notifications
   * Opens PhotoDetail modal when shouldOpenPhoto param is present
   */
  useEffect(() => {
    const handleDeepLinkParams = async () => {
      const params = (route.params || {}) as any;
      const { photoId, commentId, shouldOpenPhoto, notifType } = params;

      if (!shouldOpenPhoto || !photoId) {
        return;
      }

      logger.info('ActivityScreen: Opening photo from notification', { photoId, commentId });

      // Fetch photo
      const photo = await getPhotoById(photoId);
      if (!photo) {
        logger.error('ActivityScreen: Failed to fetch photo', { photoId });
        navigation.setParams({ shouldOpenPhoto: undefined } as any);
        return;
      }

      // Open PhotoDetail modal
      openPhotoDetail({
        mode: 'feed',
        photo,
        currentUserId: user?.id,
        initialShowComments: !!commentId,
        targetCommentId: commentId || null,
      });

      navigation.navigate('PhotoDetail' as any);

      // Mark as read — safety net for cold-start where App.js ran before auth was ready
      if (user?.id) {
        markNotificationReadFromPushData(user.id, { type: notifType, photoId });
      }

      // Clear params to prevent re-opening on back navigation
      navigation.setParams({
        shouldOpenPhoto: undefined,
        photoId: undefined,
        commentId: undefined,
        notifType: undefined,
      } as any);
    };

    handleDeepLinkParams();
  }, [route.params, navigation, openPhotoDetail, user?.id]);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return [];

    try {
      const { data: notifs, error: notifsError } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (notifsError) throw notifsError;

      const normalizedNotifs = ((notifs || []) as any[]).map(n => ({
        ...n,
        // Map snake_case to camelCase for compatibility with existing UI code
        id: n.id,
        recipientId: n.recipient_id,
        senderId: n.sender_id,
        senderName: n.sender_name,
        senderProfilePhotoURL: n.sender_profile_photo_url,
        createdAt: n.created_at ? new Date(n.created_at) : null,
        type: n.type,
        photoId: n.photo_id,
        commentId: n.comment_id,
        message: n.message,
        reactions: n.reactions,
        read: n.read,
      }));

      // Batch-fetch unique sender user docs to get nameColor + current photoURL fallback
      const uniqueSenderIds = [...new Set(normalizedNotifs.map(n => n.senderId).filter(Boolean))];
      const colorMap: Record<string, any> = {};
      const photoMap: Record<string, any> = {};
      if (uniqueSenderIds.length > 0) {
        const { data: senderUsers } = await supabase
          .from('users')
          .select('id, name_color, photo_url, profile_photo_url')
          .in('id', uniqueSenderIds);
        if (senderUsers) {
          for (const u of senderUsers as any[]) {
            colorMap[u.id] = u.name_color || null;
            photoMap[u.id] = u.photo_url || u.profile_photo_url || null;
          }
        }
      }

      return normalizedNotifs.map(n => ({
        ...n,
        senderNameColor: n.senderId ? colorMap[n.senderId] || null : null,
        senderProfilePhotoURL:
          (n.senderId ? photoMap[n.senderId] || null : null) || n.senderProfilePhotoURL || null,
      }));
    } catch (error) {
      logger.error('Error fetching notifications', { error: (error as Error).message });
    }
    return [];
  }, [user?.id]);

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

  // Auto-mark notifications as read in Firestore when data finishes loading.
  // This clears the FeedScreen red dot badge (driven by onSnapshot for read==false)
  // without changing local state — individual unread dots remain until tapped.
  useEffect(() => {
    if (loading || !user?.id || notifications.length === 0) return;

    const hasUnread = notifications.some(n => n.read !== true);
    if (!hasUnread) return;

    logger.debug('ActivityScreen: Auto-marking notifications as read for badge clearance');
    markNotificationsAsRead(user.id);
  }, [loading, user?.id, notifications]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Deduplicate reaction notifications: keep only the latest per (senderId, photoId)
  const clumpedNotifications = useMemo(() => {
    const reactionKeys = new Map<string, any>(); // key -> notification
    const result: any[] = [];

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

  const handleReadAll = useCallback(async () => {
    if (!user?.id) return;
    mediumImpact();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    const result = await markNotificationsAsRead(user.id);
    if (!result.success) {
      logger.error('Failed to mark all notifications as read', { error: result.error });
    }
  }, [user?.id]);

  const handleAccept = async (requestId: string) => {
    mediumImpact();
    setActionLoading(prev => ({ ...prev, [requestId]: true }));
    try {
      await acceptFriendRequest(requestId);
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err) {
      Alert.alert('Error', (err as Error).message || 'Failed to accept request');
    }
    setActionLoading(prev => ({ ...prev, [requestId]: false }));
  };

  const handleDecline = async (requestId: string) => {
    mediumImpact();
    setActionLoading(prev => ({ ...prev, [requestId]: true }));
    try {
      await declineFriendRequest(requestId);
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err) {
      Alert.alert('Error', (err as Error).message || 'Failed to decline request');
    }
    setActionLoading(prev => ({ ...prev, [requestId]: false }));
  };

  // Uses OtherUserProfile in root stack (not tab navigator) for viewing other users
  const handleAvatarPress = (userId, displayName) => {
    logger.debug('ActivityScreen: Avatar pressed', { userId, displayName });
    navigation.navigate('OtherUserProfile', { userId, username: displayName });
  };

  /**
   * Handle notification item press
   * Optimistic local update, then Firestore update, then navigation.
   * sourceRect is the measured screen position of the tapped row, used for
   * the expand/suck-back animation in PhotoDetail.
   */
  const handleNotificationPress = async (item, sourceRect) => {
    // Mark as read locally (optimistic update)
    setNotifications(prev => prev.map(n => (n.id === item.id ? { ...n, read: true } : n)));

    // Mark as read in Firestore
    await markSingleNotificationAsRead(item.id);

    // Navigate based on notification type/data
    const { type, photoId } = item;

    // Check block status before showing content from sender
    if (item.senderId && user?.id) {
      const [blockedBySender, blockedSender] = await Promise.all([
        isBlocked(item.senderId, user.id),
        isBlocked(user.id, item.senderId),
      ]);
      const eitherBlocked = blockedBySender || blockedSender;
      if (eitherBlocked) {
        return; // Silently ignore — content from blocked users not shown
      }
    }

    if (
      (type === 'reaction' || type === 'comment' || type === 'mention' || type === 'reply') &&
      photoId
    ) {
      // Fetch the photo and open PhotoDetail directly
      const photo = await getPhotoById(photoId);
      if (photo) {
        if ((photo as any).photoState === 'deleted') {
          Alert.alert('Photo Deleted', 'This photo has been deleted.');
          return;
        }
        openPhotoDetail({
          mode: 'feed',
          photo,
          currentUserId: user?.id,
          initialShowComments: type === 'comment' || type === 'mention' || type === 'reply',
          targetCommentId: item.commentId || null,
          sourceRect: sourceRect || null,
        });
        navigation.navigate('PhotoDetail' as any);
      }
    } else if (type === 'story' && item.senderId) {
      // Fetch the poster's story photos and open in stories mode
      const result = await getUserStoriesData(item.senderId);
      if (result.success && result.userStory?.hasPhotos) {
        openPhotoDetail({
          mode: 'stories',
          photos: result.userStory.topPhotos,
          initialIndex: 0,
          currentUserId: user?.id,
          isOwnStory: false,
          hasNextFriend: false,
          sourceRect: sourceRect || null,
        });
        navigation.navigate('PhotoDetail' as any);
      }
    } else if (type === 'tagged' && photoId) {
      // Fetch the tagged photo and open PhotoDetail directly
      const taggedPhoto = await getPhotoById(photoId);
      if (taggedPhoto) {
        if ((taggedPhoto as any).photoState === 'deleted') {
          Alert.alert('Photo Deleted', 'This photo has been deleted.');
          return;
        }
        openPhotoDetail({
          mode: 'feed',
          photo: taggedPhoto,
          currentUserId: user?.id,
          initialShowComments: false,
          sourceRect: sourceRect || null,
        });
        navigation.navigate('PhotoDetail' as any);
      }
    } else if (type === 'friend_accepted' && item.senderId) {
      handleAvatarPress(item.senderId, item.senderName);
    } else if (type === 'friend_request') {
      navigation.navigate('FriendsList' as any);
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
      profilePhotoURL: otherUser.photoURL || otherUser.profilePhotoURL,
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

  const renderEmpty = () => {
    if (loading) return null;

    if (friendRequests.length === 0 && clumpedNotifications.length === 0) {
      return (
        <EmptyState
          icon="notifications-outline"
          message="No activity yet"
        />
      );
    }
    return null;
  };

  if (loading && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <PixelIcon name="chevron-back" size={28} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ActivitySkeleton />
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
        <TouchableOpacity onPress={handleReadAll} hitSlop={8}>
          <Text style={styles.readAllText}>Read all</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={
          Platform.OS === 'android' ? { paddingBottom: insets.bottom } : undefined
        }
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
                  <NotificationItem
                    key={item.id}
                    item={item}
                    onPress={handleNotificationPress}
                    onAvatarPress={handleAvatarPress}
                  />
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
    paddingBottom: Platform.OS === 'android' ? 6 : spacing.sm,
    backgroundColor: colors.background.primary,
  },
  backButton: {
    padding: spacing.xxs,
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    ...Platform.select({ android: { includeFontPadding: false, lineHeight: 26 } }),
  },
  headerSpacer: {
    width: 36,
  },
  readAllText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.interactive.primary,
    ...Platform.select({ android: { includeFontPadding: false } }),
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
