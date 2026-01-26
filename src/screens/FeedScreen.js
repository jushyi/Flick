import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  getFirestore,
  collection,
  query,
  where,
  limit,
  onSnapshot,
} from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import useFeedPhotos from '../hooks/useFeedPhotos';
import { useViewedStories } from '../hooks/useViewedStories';
import FeedPhotoCard from '../components/FeedPhotoCard';
import FeedLoadingSkeleton from '../components/FeedLoadingSkeleton';
import PhotoDetailModal from '../components/PhotoDetailModal';
import { FriendStoryCard } from '../components';
import { toggleReaction, getFriendStoriesData } from '../services/firebase/feedService';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
import logger from '../utils/logger';

const db = getFirestore();

// Layout constants
const HEADER_HEIGHT = 68; // paddingVertical: 16 × 2 + title height
const TAB_BAR_HEIGHT = 88; // iOS tab bar with safe area

const FeedScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Animated scroll value for header hide/show
  const scrollY = useRef(new Animated.Value(0)).current;
  const {
    photos,
    loading,
    refreshing,
    loadingMore,
    error,
    loadMorePhotos,
    refreshFeed,
    updatePhotoInState,
  } = useFeedPhotos(true, true); // realTimeUpdates=true, hotOnly=true

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

  // View tracking state
  const { isViewed, markAsViewed, markPhotosAsViewed, getFirstUnviewedIndex, hasViewedAllPhotos } =
    useViewedStories();

  // Track initial index for stories modal
  const [storiesInitialIndex, setStoriesInitialIndex] = useState(0);
  // Track current index in stories modal (updated via onPhotoChange)
  const [storiesCurrentIndex, setStoriesCurrentIndex] = useState(0);

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

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const hasUnread = !snapshot.empty;
        logger.debug('FeedScreen: Unread notifications check', { hasUnread });
        setHasNewNotifications(hasUnread);
      },
      error => {
        logger.error('FeedScreen: Failed to subscribe to notifications', { error: error.message });
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  /**
   * Handle pull-to-refresh
   * Refreshes both feed and stories
   */
  const handleRefresh = async () => {
    logger.debug('FeedScreen: Pull-to-refresh triggered');
    // Refresh both in parallel
    await Promise.all([refreshFeed(), loadFriendStories()]);
  };

  /**
   * Handle opening stories for a friend
   * Starts at the first unviewed photo, or beginning if all viewed
   */
  const handleOpenStories = friend => {
    // Calculate starting index based on viewed photos
    const startIndex = getFirstUnviewedIndex(friend.topPhotos || []);

    logger.info('FeedScreen: Opening stories viewer', {
      friendId: friend.userId,
      displayName: friend.displayName,
      startIndex,
      photoCount: friend.topPhotos?.length || 0,
    });

    setStoriesInitialIndex(startIndex);
    setStoriesCurrentIndex(startIndex);
    setSelectedFriend(friend);
    setStoriesModalVisible(true);
  };

  /**
   * Handle photo change in stories modal
   * Updates current index for reaction tracking
   */
  const handleStoriesPhotoChange = (photo, index) => {
    logger.debug('FeedScreen: Stories photo changed', { photoId: photo?.id, index });
    setStoriesCurrentIndex(index);
  };

  /**
   * Handle closing stories viewer
   * Marks the friend and all their photos as viewed when closing
   */
  const handleCloseStories = () => {
    logger.debug('FeedScreen: Closing stories viewer');
    if (selectedFriend) {
      // Mark friend as viewed
      markAsViewed(selectedFriend.userId);

      // Mark all photos as viewed so next time we start from beginning
      const photoIds = (selectedFriend.topPhotos || []).map(p => p.id);
      if (photoIds.length > 0) {
        markPhotosAsViewed(photoIds);
      }
    }
    setStoriesModalVisible(false);
    setSelectedFriend(null);
    setStoriesInitialIndex(0);
  };

  /**
   * Handle photo card press - Open detail modal
   */
  const handlePhotoPress = photo => {
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
    Object.values(updatedReactions).forEach(userReactions => {
      if (typeof userReactions === 'object') {
        Object.values(userReactions).forEach(count => {
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
   * Handle reaction toggle for stories photos
   * Updates the photo in selectedFriend.topPhotos and persists to Firebase
   */
  const handleStoriesReactionToggle = async (emoji, currentCount) => {
    if (!user || !selectedFriend) return;

    const userId = user.uid;
    const topPhotos = selectedFriend.topPhotos || [];
    const currentPhoto = topPhotos[storiesCurrentIndex];

    if (!currentPhoto) {
      logger.warn('FeedScreen: No current photo for stories reaction');
      return;
    }

    const photoId = currentPhoto.id;
    logger.debug('FeedScreen: Stories reaction toggle', { photoId, emoji, currentCount });

    // Optimistic update - update the photo in selectedFriend.topPhotos
    const updatedReactions = { ...currentPhoto.reactions };
    if (!updatedReactions[userId]) {
      updatedReactions[userId] = {};
    }
    updatedReactions[userId] = { ...updatedReactions[userId], [emoji]: currentCount + 1 };

    // Calculate new total count
    let newTotalCount = 0;
    Object.values(updatedReactions).forEach(userReactions => {
      if (typeof userReactions === 'object') {
        Object.values(userReactions).forEach(count => {
          newTotalCount += count;
        });
      }
    });

    // Update the photo in the array
    const updatedPhotos = [...topPhotos];
    updatedPhotos[storiesCurrentIndex] = {
      ...currentPhoto,
      reactions: updatedReactions,
      reactionCount: newTotalCount,
    };

    // Update selectedFriend state
    setSelectedFriend(prev => ({
      ...prev,
      topPhotos: updatedPhotos,
    }));

    // Persist to Firebase
    try {
      const result = await toggleReaction(photoId, userId, emoji, currentCount);
      if (!result.success) {
        logger.error('Failed to toggle stories reaction', { error: result.error });
        // Revert optimistic update on error
        setSelectedFriend(prev => ({
          ...prev,
          topPhotos: topPhotos,
        }));
      }
    } catch (error) {
      logger.error('Error toggling stories reaction', error);
      // Revert optimistic update on error
      setSelectedFriend(prev => ({
        ...prev,
        topPhotos: topPhotos,
      }));
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
        <ActivityIndicator size="small" color={colors.text.primary} />
        <Text style={styles.footerText}>Loading more...</Text>
      </View>
    );
  };

  /**
   * Render empty state for hot highlights
   */
  const renderEmptyState = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🔥</Text>
        <Text style={styles.emptyTitle}>No hot photos yet</Text>
        <Text style={styles.emptyText}>
          Popular photos from your friends will appear here.{'\n'}
          Tap the stories above to see all their photos!
        </Text>
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
        {[1, 2, 3, 4, 5].map(i => (
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
   * Sorts friends by viewed state (unviewed first)
   */
  const renderStoriesRow = () => {
    // Don't show stories row if loading or no friends have photos
    if (storiesLoading) {
      return <View style={styles.storiesContainer}>{renderStoriesLoadingSkeleton()}</View>;
    }

    // Hide stories row if no friends have photos
    if (friendStories.length === 0) {
      return null;
    }

    // Sort friends by viewed state - unviewed first (based on ALL photos viewed)
    const sortedFriends = [...friendStories].sort((a, b) => {
      const aViewed = hasViewedAllPhotos(a.topPhotos);
      const bViewed = hasViewedAllPhotos(b.topPhotos);
      if (aViewed === bViewed) return 0;
      return aViewed ? 1 : -1; // Unviewed first
    });

    return (
      <View style={styles.storiesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesScrollContent}
        >
          {sortedFriends.map((friend, index) => (
            <FriendStoryCard
              key={friend.userId}
              friend={friend}
              onPress={() => handleOpenStories(friend)}
              isFirst={index === 0}
              isViewed={hasViewedAllPhotos(friend.topPhotos)}
            />
          ))}
        </ScrollView>
      </View>
    );
  };

  // Header transform based on scroll position
  // Header starts at insets.top, so needs to move up by header height + insets to fully hide
  const totalHeaderHeight = HEADER_HEIGHT + insets.top;
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [0, -totalHeaderHeight],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Status bar mask - hides header as it scrolls up */}
      <View style={[styles.statusBarMask, { height: insets.top }]} />

      {/* Animated Header - hides on scroll */}
      <Animated.View
        style={[
          styles.header,
          {
            top: insets.top,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <Text style={styles.headerTitle}>Rewind</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Activity')}
          style={styles.notificationButton}
        >
          <Ionicons name="heart-outline" size={24} color={colors.text.primary} />
          {hasNewNotifications && <View style={styles.notificationDot} />}
        </TouchableOpacity>
      </Animated.View>

      {/* Content */}
      {loading ? (
        <>
          {renderStoriesRow()}
          <FeedLoadingSkeleton count={3} />
        </>
      ) : error ? (
        renderErrorState()
      ) : (
        <Animated.FlatList
          data={photos}
          renderItem={renderFeedItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.feedList, { paddingTop: HEADER_HEIGHT }]}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: true,
          })}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.text.primary}
            />
          }
          onEndReached={loadMorePhotos}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            <>
              {renderStoriesRow()}
              {photos.length > 0 && (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>🔥 Hot</Text>
                </View>
              )}
            </>
          }
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {/* Photo Detail Modal - Feed Mode */}
      {selectedPhoto && (
        <PhotoDetailModal
          mode="feed"
          visible={showPhotoModal}
          photo={selectedPhoto}
          onClose={handleClosePhotoModal}
          onReactionToggle={handleReactionToggle}
          currentUserId={user?.uid}
        />
      )}

      {/* Photo Detail Modal - Stories Mode */}
      {selectedFriend && (
        <PhotoDetailModal
          mode="stories"
          visible={storiesModalVisible}
          photos={selectedFriend.topPhotos || []}
          initialIndex={storiesInitialIndex}
          onPhotoChange={handleStoriesPhotoChange}
          onClose={handleCloseStories}
          onReactionToggle={handleStoriesReactionToggle}
          currentUserId={user?.uid}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Pure black to match stories section
  },
  statusBarMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 11, // Above header (zIndex: 10)
    backgroundColor: '#000000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#000000',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
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
    // paddingTop set dynamically with insets.top
    paddingBottom: TAB_BAR_HEIGHT + 24,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
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
    color: colors.text.secondary,
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
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
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
    color: colors.text.primary,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: colors.brand.purple,
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
