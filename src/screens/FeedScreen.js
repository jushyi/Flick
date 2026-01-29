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
import AddFriendsPromptCard from '../components/AddFriendsPromptCard';
import TakeFirstPhotoCard from '../components/TakeFirstPhotoCard';
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

  // Track if refresh should be allowed (requires pulling past threshold)
  const canRefresh = useRef(false);
  const REFRESH_THRESHOLD = -70; // Must pull down 70+ pixels to trigger refresh
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
  const [initialShowComments, setInitialShowComments] = useState(false);

  // Stories state
  const [friendStories, setFriendStories] = useState([]);
  const [totalFriendCount, setTotalFriendCount] = useState(0);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [storiesModalVisible, setStoriesModalVisible] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [selectedFriendIndex, setSelectedFriendIndex] = useState(0); // Track position in friendStories for navigation

  // Notifications state - red dot indicator
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  // View tracking state
  const {
    isViewed,
    markAsViewed,
    markPhotosAsViewed,
    getFirstUnviewedIndex,
    hasViewedAllPhotos,
    loading: viewedStoriesLoading,
  } = useViewedStories();

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
      logger.info('FeedScreen: Friend stories loaded', {
        count: result.friendStories.length,
        totalFriendCount: result.totalFriendCount,
      });
      setFriendStories(result.friendStories);
      setTotalFriendCount(result.totalFriendCount || 0);
    } else {
      logger.warn('FeedScreen: Failed to load friend stories', { error: result.error });
      setTotalFriendCount(0);
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
   * Only triggers if user pulled past threshold
   */
  const handleRefresh = async () => {
    if (!canRefresh.current) {
      logger.debug('FeedScreen: Refresh blocked - threshold not met');
      return;
    }
    logger.debug('FeedScreen: Pull-to-refresh triggered');
    canRefresh.current = false;
    // Refresh both in parallel
    await Promise.all([refreshFeed(), loadFriendStories()]);
  };

  /**
   * Track scroll position to enable/disable refresh
   */
  const handleScroll = event => {
    const offsetY = event.nativeEvent.contentOffset.y;
    // Enable refresh only when pulled past threshold (negative = pulling down)
    if (offsetY <= REFRESH_THRESHOLD) {
      canRefresh.current = true;
    }
  };

  /**
   * Handle opening stories for a friend
   * Starts at the first unviewed photo, or beginning if all viewed
   */
  const handleOpenStories = friend => {
    // Calculate starting index based on viewed photos
    const startIndex = getFirstUnviewedIndex(friend.topPhotos || []);

    // Find index in sorted friends array for friend-to-friend navigation
    const sortedFriends = [...friendStories].sort((a, b) => {
      const aViewed = hasViewedAllPhotos(a.topPhotos);
      const bViewed = hasViewedAllPhotos(b.topPhotos);
      if (aViewed === bViewed) return 0;
      return aViewed ? 1 : -1;
    });
    const friendIdx = sortedFriends.findIndex(f => f.userId === friend.userId);

    logger.info('FeedScreen: Opening stories viewer', {
      friendId: friend.userId,
      displayName: friend.displayName,
      startIndex,
      photoCount: friend.topPhotos?.length || 0,
      friendIndex: friendIdx,
      totalFriends: sortedFriends.length,
    });

    setStoriesInitialIndex(startIndex);
    setStoriesCurrentIndex(startIndex);
    setSelectedFriend(friend);
    setSelectedFriendIndex(friendIdx);
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
   * Get sorted friends array for consistent navigation
   */
  const getSortedFriends = () => {
    return [...friendStories].sort((a, b) => {
      const aViewed = hasViewedAllPhotos(a.topPhotos);
      const bViewed = hasViewedAllPhotos(b.topPhotos);
      if (aViewed === bViewed) return 0;
      return aViewed ? 1 : -1;
    });
  };

  /**
   * Handle transitioning to next friend's stories (cube animation)
   * Called when user reaches end of current friend's photos
   */
  const handleRequestNextFriend = () => {
    if (!selectedFriend) return;

    const sortedFriends = getSortedFriends();
    const nextFriendIdx = selectedFriendIndex + 1;

    if (nextFriendIdx >= sortedFriends.length) {
      logger.debug('FeedScreen: No more friends, closing stories');
      handleCloseStories();
      return;
    }

    // Mark current friend's photos as viewed before transitioning
    const currentPhotos = selectedFriend.topPhotos || [];
    const photoIds = currentPhotos.map(p => p.id);
    if (photoIds.length > 0) {
      markPhotosAsViewed(photoIds);
      markAsViewed(selectedFriend.userId);
    }

    // Get next friend
    const nextFriend = sortedFriends[nextFriendIdx];
    const nextStartIndex = getFirstUnviewedIndex(nextFriend.topPhotos || []);

    logger.info('FeedScreen: Transitioning to next friend', {
      fromFriend: selectedFriend.displayName,
      toFriend: nextFriend.displayName,
      nextFriendIndex: nextFriendIdx,
      startIndex: nextStartIndex,
    });

    // Update state for next friend
    setSelectedFriend(nextFriend);
    setSelectedFriendIndex(nextFriendIdx);
    setStoriesInitialIndex(nextStartIndex);
    setStoriesCurrentIndex(nextStartIndex);
  };

  /**
   * Check if there's a next friend available
   */
  const hasNextFriend = () => {
    const sortedFriends = getSortedFriends();
    return selectedFriendIndex < sortedFriends.length - 1;
  };

  /**
   * Handle closing stories viewer
   * Only marks photos up to current position as viewed
   * Only marks friend as viewed (gray ring) when ALL photos are viewed
   */
  const handleCloseStories = () => {
    logger.debug('FeedScreen: Closing stories viewer');
    if (selectedFriend) {
      const allPhotos = selectedFriend.topPhotos || [];
      const isAtEnd = storiesCurrentIndex >= allPhotos.length - 1;

      if (isAtEnd) {
        // User viewed all photos - mark friend as viewed (gray ring) and all photos
        markAsViewed(selectedFriend.userId);
        const photoIds = allPhotos.map(p => p.id);
        if (photoIds.length > 0) {
          markPhotosAsViewed(photoIds);
        }
        logger.info('FeedScreen: All photos viewed - marking all as viewed', {
          friendId: selectedFriend.userId,
          photoCount: photoIds.length,
        });
      } else {
        // User closed mid-story - only mark photos up to current index as viewed
        // Don't mark friend as viewed (ring stays gradient)
        const viewedPhotoIds = allPhotos.slice(0, storiesCurrentIndex + 1).map(p => p.id);
        if (viewedPhotoIds.length > 0) {
          markPhotosAsViewed(viewedPhotoIds);
        }
        logger.info('FeedScreen: Partial view - marking photos up to current index', {
          friendId: selectedFriend.userId,
          currentIndex: storiesCurrentIndex,
          markedCount: viewedPhotoIds.length,
          totalCount: allPhotos.length,
        });
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
    setInitialShowComments(false);
    setShowPhotoModal(true);
  };

  /**
   * Handle comment press on feed card - Opens modal with comments sheet visible (UAT-005 fix)
   */
  const handleCommentPress = photo => {
    setSelectedPhoto(photo);
    setInitialShowComments(true);
    setShowPhotoModal(true);
  };

  /**
   * Close photo modal
   */
  const handleClosePhotoModal = () => {
    setShowPhotoModal(false);
    setSelectedPhoto(null);
    setInitialShowComments(false);
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
    <FeedPhotoCard
      photo={item}
      onPress={() => handlePhotoPress(item)}
      onCommentPress={() => handleCommentPress(item)}
    />
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
   * Render empty state for feed
   * Shows contextual content based on friend count:
   * - No friends: TakeFirstPhotoCard (new user)
   * - Has friends but no posts: Sad emoji with encouraging message
   */
  const renderEmptyState = () => {
    if (loading) return null;

    // New user state: no friends - show prompt to take first photo
    if (totalFriendCount === 0) {
      return (
        <View style={styles.emptyContainer}>
          <TakeFirstPhotoCard onPress={() => navigation.navigate('Camera')} />
        </View>
      );
    }

    // Established user state: has friends but no posts in feed
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="sad-outline" size={64} color={colors.text.secondary} />
        <Text style={styles.emptyTitle}>Nothing yet</Text>
        <Text style={styles.emptyText}>Tell your friends to post!</Text>
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
   * Waits for both stories data AND viewed state to load to prevent race conditions
   * Shows AddFriendsPromptCard when user has no friends
   */
  const renderStoriesRow = () => {
    // Wait for both stories data AND viewed state to load
    // This prevents showing all stories as unviewed while Firestore data is loading
    if (storiesLoading || viewedStoriesLoading) {
      return <View style={styles.storiesContainer}>{renderStoriesLoadingSkeleton()}</View>;
    }

    // Show AddFriendsPromptCard when user has no friends
    if (totalFriendCount === 0) {
      return (
        <View style={styles.storiesContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.storiesScrollContent}
          >
            <AddFriendsPromptCard
              onPress={() => navigation.navigate('FriendsList')}
              isFirst={true}
            />
          </ScrollView>
        </View>
      );
    }

    // Hide stories row if friends exist but none have photos
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

  // Header opacity - fades out faster than it slides up
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT * 0.4],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Status bar mask - hides header as it scrolls up */}
      <View style={[styles.statusBarMask, { height: insets.top }]} />

      {/* Animated Header - hides on scroll with fade */}
      <Animated.View
        style={[
          styles.header,
          {
            top: insets.top,
            transform: [{ translateY: headerTranslateY }],
            opacity: headerOpacity,
          },
        ]}
      >
        {/* Centered title */}
        <Text style={styles.headerTitle}>Rewind</Text>
        {/* Right-aligned notification button */}
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
            listener: handleScroll,
          })}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.text.primary}
              progressViewOffset={40}
            />
          }
          onEndReached={loadMorePhotos}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={renderStoriesRow}
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
          initialShowComments={initialShowComments}
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
          onRequestNextFriend={handleRequestNextFriend}
          hasNextFriend={hasNextFriend()}
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  notificationButton: {
    padding: 8,
    position: 'absolute',
    right: 24,
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
    paddingTop: 20,
    paddingBottom: 12,
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
