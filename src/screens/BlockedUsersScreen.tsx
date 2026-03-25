import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import PixelIcon from '../components/PixelIcon';
import PixelSpinner from '../components/PixelSpinner';
import { useAuth } from '../context/AuthContext';
import { getBlockedUsers, unblockUser, BlockedUser } from '../services/supabase/blockService';
import FriendCard from '../components/FriendCard';
import { colors } from '../constants/colors';
import { styles } from '../styles/BlockedUsersScreen.styles';
import logger from '../utils/logger';

/**
 * BlockedUsersScreen
 *
 * Displays list of users the current user has blocked.
 * Accessible from Settings. Uses FriendCard component for consistent UI.
 * Provides ability to unblock users and view their profiles.
 */
const BlockedUsersScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // Track which user is being unblocked

  const loadBlockedUsers = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const result = await getBlockedUsers(user.id);
      setBlockedUsers(result);
    } catch (error) {
      logger.error('BlockedUsersScreen: Error loading blocked users', { error: (error as Error).message });
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadBlockedUsers();
  }, [loadBlockedUsers]);

  /**
   * Handle unblock user action
   * Shows confirmation, then calls unblockUser service
   */
  const handleUnblock = async (blockedUserId: string) => {
    const blockedUser = blockedUsers.find(u => u.blockedId === blockedUserId);
    const displayName = blockedUser?.user?.displayName || blockedUser?.user?.username || 'this user';

    const cancelAction = { text: 'Cancel', style: 'cancel' as const };
    const unblockAction = {
      text: 'Unblock',
      onPress: async () => {
        try {
          setActionLoading(blockedUserId);

          // Optimistic update - remove from list immediately
          setBlockedUsers(prev => prev.filter(u => u.blockedId !== blockedUserId));

          await unblockUser(user!.id, blockedUserId);
          logger.info('BlockedUsersScreen: User unblocked', { blockedUserId });
        } catch (error) {
          // Revert optimistic update on error
          if (blockedUser) {
            setBlockedUsers(prev => [...prev, blockedUser]);
          }
          logger.error('BlockedUsersScreen: Error unblocking user', { error: (error as Error).message });
          Alert.alert('Error', 'An unexpected error occurred');
        } finally {
          setActionLoading(null);
        }
      },
    };
    // Android reverses button visual order — swap so Cancel stays left, Unblock right
    Alert.alert(
      'Unblock User',
      `Unblock ${displayName}?`,
      Platform.OS === 'android' ? [unblockAction, cancelAction] : [cancelAction, unblockAction]
    );
  };

  const handleViewProfile = (blockedUser: BlockedUser) => {
    (navigation as any).navigate('OtherUserProfile', {
      userId: blockedUser.blockedId,
      displayName: blockedUser.user?.displayName,
      username: blockedUser.user?.username,
    });
  };

  const renderItem = ({ item }: { item: BlockedUser }) => (
    <FriendCard
      user={{
        userId: item.blockedId,
        username: item.user?.username,
      }}
      relationshipStatus="none" // No Add button, just display
      onPress={() => handleViewProfile(item)}
      onUnblock={handleUnblock}
      isBlocked={true} // Shows "Unblock User" in menu
      loading={actionLoading === item.blockedId}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No blocked users</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <PixelIcon name="chevron-back" size={28} color={colors.icon.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Blocked Users</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <PixelSpinner size="large" color={colors.text.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            logger.debug('BlockedUsersScreen: Back button pressed');
            navigation.goBack();
          }}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <PixelIcon name="chevron-back" size={28} color={colors.icon.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked Users</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Blocked Users List */}
      <FlatList
        data={blockedUsers}
        keyExtractor={item => item.blockedId}
        renderItem={renderItem}
        contentContainerStyle={blockedUsers.length === 0 ? { flex: 1 } : { paddingBottom: 100 }}
        ListEmptyComponent={renderEmptyState}
        style={styles.listContainer}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </SafeAreaView>
  );
};

export default BlockedUsersScreen;
