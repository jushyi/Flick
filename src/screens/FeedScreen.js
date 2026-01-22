import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { getFirestore, collection, query, where, limit, onSnapshot } from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import useFeedPhotos from '../hooks/useFeedPhotos';
import FeedPhotoCard from '../components/FeedPhotoCard';
import FeedLoadingSkeleton from '../components/FeedLoadingSkeleton';
import PhotoDetailModal from '../components/PhotoDetailModal';
import { FriendStoryCard, StoriesViewerModal } from '../components';
import { toggleReaction, getFriendStoriesData } from '../services/firebase/feedService';
import { useAuth } from '../context/AuthContext';
import logger from '../utils/logger';

const db = getFirestore();

const FeedScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const {
    photos,
    loading,
    refreshing,
    loadingMore,
    error,
    loadMorePhotos,
    refreshFeed,
    updatePhotoInState,
  } = useFeedPhotos(true); // Enable real-time updates

  // Modal state
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  // Stories state
  const [friendStories, setFriendStories] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [storiesModalVisible, setStoriesModalVisible] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);

  // Notifications state - red dot indicator
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  /**
   * Refresh feed and stories when screen comes into focus
   * This ensures feed reflects current friendship state after adding/removing friends
   */
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      logger.debug('Feed screen focused - refreshing feed and stories');
      refreshFeed();
      loadFriendStories();
    });

    return unsubscribe;
  }, [navigation, refreshFeed]);

  /**
   * Load friend stories data
   * Reusable function for initial load and refresh
   */
  const loadFriendStories = async () => {
    if (!user?.uid) return;

    logger.debug('FeedScreen: Loading friend stories data');
    setStoriesLoading(true);
    const result = await getFriendStoriesData(user.uid);
    if (result.success) {
      logger.info('FeedScreen: Friend stories loaded', { count: result.friendStories.length });
      setFriendStories(result.friendStories);
    } else {
      logger.warn('FeedScreen: Failed to load friend stories', { error: result.error });
    }
    setStoriesLoading(false);
  };

  /**
   * Load friend stories data on mount
   */
  useEffect(() => {
    if (user?.uid) {
      loadFriendStories();
    }
  }, [user?.uid]);

  /**
   * Subscribe to unread notifications for red dot indicator
   */
  useEffect(() => {
    if (!user?.uid) return;

    logger.debug('FeedScreen: Subscribing to unread notifications');

    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.uid),
      where('read', '==', false),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const hasUnread = !snapshot.empty;
      logger.debug('FeedScreen: Unread notifications check', { hasUnread });
      setHasNewNotifications(hasUnread);
    }, (error) => {
      logger.error('FeedScreen: Failed to subscribe to notifications', { error: error.message });
    });

    return () => unsubscribe();
  }, [user?.uid]);

  /**
   * Handle pull-to-refresh
   * Refreshes both feed and stories
   */
  const handleRefresh = async () => {
    logger.debug('FeedScreen: Pull-to-refresh triggered');
    // Refresh both in parallel
    await Promise.all([
      refreshFeed(),
      loadFriendStories(),
    ]);
  };

  /**
   * Handle opening stories for a friend
   */
  const handleOpenStories = (friend) => {
    logger.info('FeedScreen: Opening stories viewer', { friendId: friend.userId, displayName: friend.displayName });
    setSelectedFriend(friend);
    setStoriesModalVisible(true);
  };

  /**
   * Handle closing stories viewer
   */
  const handleCloseStories = () => {
    logger.debug('FeedScreen: Closing stories viewer');
    setStoriesModalVisible(false);
    setSelectedFriend(null);
  };

  /**
   * Handle photo card press - Open detail modal
   */
  const handlePhotoPress = (photo) => {
    setSelectedPhoto(photo);
    setShowPhotoModal(true);
  };

  /**
   * Close photo modal
   */
  const handleClosePhotoModal = () => {
    setShowPhotoModal(false);
    setSelectedPhoto(null);
  };

  /**
   * Handle reaction toggle with optimistic UI update
   * Increments the count for the selected emoji
   */
  const handleReactionToggle = async (emoji, currentCount) => {
    if (!user || !selectedPhoto) return;

    const photoId = selectedPhoto.id;
    const userId = user.uid;

    // Optimistic update - increment count immediately
    const updatedReactions = { ...selectedPhoto.reactions };
    if (!updatedReactions[userId]) {
      updatedReactions[userId] = {};
    }
    updatedReactions[userId] = { ...updatedReactions[userId], [emoji]: currentCount + 1 };

    // Calculate new total count
    let newTotalCount = 0;
    Object.values(updatedReactions).forEach((userReactions) => {
      if (typeof userReactions === 'object') {
        Object.values(userReactions).forEach((count) => {
          newTotalCount += count;
        });
      }
    });

    const updatedPhoto = {
      ...selectedPhoto,
      reactions: updatedReactions,
      reactionCount: newTotalCount,
    };

    setSelectedPhoto(updatedPhoto);
    updatePhotoInState(photoId, updatedPhoto);

    // Persist to Firebase
    try {
      const result = await toggleReaction(photoId, userId, emoji, currentCount);
      if (!result.success) {
        logger.error('Failed to toggle reaction', { error: result.error });
        // Revert optimistic update on error
        setSelectedPhoto(selectedPhoto);
        updatePhotoInState(photoId, selectedPhoto);
      }
    } catch (error) {
      logger.error('Error toggling reaction', error);
      // Revert optimistic update on error
      setSelectedPhoto(selectedPhoto);
      updatePhotoInState(photoId, selectedPhoto);
    }
  };

  /**
   * Render single feed item
   */
  const renderFeedItem = ({ item }) => (
    <FeedPhotoCard photo={item} onPress={() => handlePhotoPress(item)} />
  );

  /**
   * Render footer (loading more indicator)
   */
  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#000000" />
        <Text style={styles.footerText}>Loading more...</Text>
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
        <Text style={styles.emptyIcon}>📸</Text>
        <Text style={styles.emptyTitle}>No photos yet</Text>
        <Text style={styles.emptyText}>
          Start taking photos or add friends to see their photos here
        </Text>
        <TouchableOpacity style={styles.emptyButton}>
          <Text style={styles.emptyButtonText}>Take a Photo</Text>
        </TouchableOpacity>
      </View>
    );
  };

  /**
   * Render error state
   */
  const renderErrorState = () => {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refreshFeed}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  };

  /**
   * Render stories loading skeleton
   */
  const renderStoriesLoadingSkeleton = () => {
    return (
      <View style={styles.storiesSkeletonContainer}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.storySkeletonItem}>
            <View style={styles.storySkeletonCircle} />
            <View style={styles.storySkeletonText} />
          </View>
        ))}
      </View>
    );
  };

  /**
   * Render stories row
   */
  const renderStoriesRow = () => {
    // Don't show stories row if loading or no friends have photos
    if (storiesLoading) {
      return (
        <View style={styles.storiesContainer}>
          {renderStoriesLoadingSkeleton()}
        </View>
      );
    }

    // Hide stories row if no friends have photos
    if (friendStories.length === 0) {
      return null;
    }

    return (
      <View style={styles.storiesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesScrollContent}
        >
          {friendStories.map((friend, index) => (
            <FriendStoryCard
              key={friend.userId}
              friend={friend}
              onPress={() => handleOpenStories(friend)}
              isFirst={index === 0}
            />
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Lapse</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          style={styles.notificationButton}
        >
          <Ionicons name="heart-outline" size={24} color="#000000" />
          {hasNewNotifications && (
            <View style={styles.notificationDot} />
          )}
        </TouchableOpacity>
      </View>

      {/* Stories Row */}
      {renderStoriesRow()}

      {/* Content */}
      {loading ? (
        <FeedLoadingSkeleton count={3} />
      ) : error ? (
        renderErrorState()
      ) : (
        <FlatList
          data={photos}
          renderItem={renderFeedItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.feedList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#000000"
            />
          }
          onEndReached={loadMorePhotos}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {/* Photo Detail Modal with Inline Reactions */}
      {selectedPhoto && (
        <PhotoDetailModal
          visible={showPhotoModal}
          photo={selectedPhoto}
          onClose={handleClosePhotoModal}
          onReactionToggle={handleReactionToggle}
          currentUserId={user?.uid}
        />
      )}

      {/* Stories Viewer Modal */}
      <StoriesViewerModal
        visible={storiesModalVisible}
        onClose={handleCloseStories}
        friend={selectedFriend}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  notificationButton: {
    padding: 8,
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30', // iOS red
  },
  feedList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    marginLeft: 12,
    fontSize: 14,
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
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Stories row styles
  storiesContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    backgroundColor: '#000000',
  },
  storiesScrollContent: {
    paddingHorizontal: 12,
  },
  // Stories loading skeleton styles
  storiesSkeletonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  storySkeletonItem: {
    width: 75,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  storySkeletonCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2A2A2A',
    marginBottom: 6,
  },
  storySkeletonText: {
    width: 50,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2A2A2A',
  },
});

export default FeedScreen;
