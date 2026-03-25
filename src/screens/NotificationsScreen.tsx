import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PixelSpinner from '../components/PixelSpinner';
import { NotificationsSkeleton } from '../components/skeletons/NotificationsSkeleton';
import { EmptyState } from '../components/EmptyState';
import { supabase } from '../lib/supabase';
import PixelIcon from '../components/PixelIcon';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';
import { useAuth } from '../context/AuthContext';
import { useScreenTrace } from '../hooks/useScreenTrace';
import { getTimeAgo } from '../utils/timeUtils';
import logger from '../utils/logger';
// TODO(20-01): notificationService - needs migration to standalone service
const requestNotificationPermission = async () => ({ success: true });
const getNotificationToken = async () => ({ success: true, data: null });
const storeNotificationToken = async () => ({ success: true });

/**
 * NotificationsScreen - Displays list of reaction notifications
 * Instagram-style vertical list with profile photo, message, and timestamp
 */
type NotificationItem = {
  id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  senderProfilePhotoURL: string | null;
  createdAt: Date | null;
  type: string;
  photoId: string | null;
  message: string | null;
  reactions: Record<string, number> | null;
  read: boolean;
  [key: string]: any;
};

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const { user, userProfile, refreshUserProfile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);

  // Screen load trace - measures time from mount to data-ready
  const { markLoaded } = useScreenTrace('NotificationsScreen');
  const screenTraceMarkedRef = useRef(false);

  // Check if push notifications are enabled (fcmToken exists)
  const hasPushToken = !!userProfile?.fcm_token;

  /**
   * Handle enabling push notifications
   * Requests permission, gets token, and stores it
   */
  const handleEnablePushNotifications = async () => {
    if (!user?.id) return;

    setEnablingPush(true);
    try {
      // Step 1: Request permission
      const permResult = await requestNotificationPermission();
      if (!permResult.success) {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to receive push notifications.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Step 2: Get push token
      const tokenResult = await getNotificationToken();
      if (!tokenResult.success) {
        Alert.alert('Error', (tokenResult as any).error || 'Failed to get push token');
        return;
      }

      // Step 3: Store token in Firestore
      const storeResult = await storeNotificationToken();
      if (!storeResult.success) {
        Alert.alert('Error', 'Failed to save push token');
        return;
      }

      // Refresh user profile to update hasPushToken state
      await refreshUserProfile();

      logger.info('NotificationsScreen: Push notifications enabled successfully');
    } catch (error) {
      logger.error('NotificationsScreen: Failed to enable push notifications', {
        error: (error as Error).message,
      });
      Alert.alert('Error', 'Failed to enable push notifications');
    } finally {
      setEnablingPush(false);
    }
  };

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    logger.debug('NotificationsScreen: Fetching notifications', { userId: user.id });

    try {
      const { data: rows, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      const notificationsList = ((rows || []) as any[]).map(row => ({
        id: row.id,
        ...row,
        recipientId: row.recipient_id,
        senderId: row.sender_id,
        senderName: row.sender_name,
        senderProfilePhotoURL: row.sender_profile_photo_url,
        createdAt: row.created_at ? new Date(row.created_at) : null,
        type: row.type,
        photoId: row.photo_id,
        message: row.message,
        reactions: row.reactions,
        read: row.read,
      }));

      logger.info('NotificationsScreen: Loaded notifications', { count: notificationsList.length });
      setNotifications(notificationsList);

      // Mark screen trace as loaded after first notification fetch (once only)
      if (!screenTraceMarkedRef.current) {
        screenTraceMarkedRef.current = true;
        markLoaded({ notif_count: notificationsList.length });
      }
    } catch (error) {
      logger.error('NotificationsScreen: Failed to fetch notifications', { error: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const renderNotificationItem = useCallback(({ item }) => {
    // Format reactions display (e.g., "reacted 😂×2 ❤️×1")
    const formatReactionsText = reactions => {
      if (!reactions || typeof reactions !== 'object') return '';

      const parts = Object.entries(reactions)
        .filter(([_, count]) => (count as number) > 0)
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
              <PixelIcon name="person" size={24} color={colors.text.secondary} />
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
  }, []);

  const renderPushBanner = () => {
    if (hasPushToken) return null;

    return (
      <View style={styles.pushBanner}>
        <View style={styles.pushBannerContent}>
          <PixelIcon name="notifications-off-outline" size={24} color={colors.brand.purple} />
          <View style={styles.pushBannerText}>
            <Text style={styles.pushBannerTitle}>Push notifications disabled</Text>
            <Text style={styles.pushBannerSubtitle}>
              Enable to get notified when your photos are ready
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.pushBannerButton}
          onPress={handleEnablePushNotifications}
          disabled={enablingPush}
        >
          {enablingPush ? (
            <PixelSpinner size="small" color={colors.background.primary} />
          ) : (
            <Text style={styles.pushBannerButtonText}>Enable</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (loading) return null;

    return (
      <EmptyState
        icon="notifications-outline"
        message="No notifications yet"
      />
    );
  };

  if (loading && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <PixelIcon name="chevron-back" size={28} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        <NotificationsSkeleton />
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
          <PixelIcon name="chevron-back" size={28} color={colors.text.primary} />
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
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.brand.purple}
            colors={[colors.brand.purple]}
            progressBackgroundColor={colors.background.secondary}
          />
        }
        ListHeaderComponent={renderPushBanner}
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  backButton: {
    marginRight: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.secondary,
  },
  profilePhotoContainer: {
    marginRight: spacing.sm,
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
    marginRight: spacing.sm,
  },
  messageText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.primary,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
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
    paddingHorizontal: spacing.xxl,
  },
  emptyTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  pushBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.tertiary,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: layout.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.brand.purple + '40',
  },
  pushBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pushBannerText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  pushBannerTitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  pushBannerSubtitle: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    marginTop: 2,
  },
  pushBannerButton: {
    backgroundColor: colors.brand.purple,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: layout.borderRadius.sm,
    marginLeft: spacing.sm,
    minWidth: 70,
    alignItems: 'center',
  },
  pushBannerButtonText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
});

export default NotificationsScreen;
