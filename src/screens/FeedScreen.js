import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import PixelSpinner from '../components/PixelSpinner';
import {
  getFirestore,
  collection,
  query,
  where,
  limit,
  onSnapshot,
} from '@react-native-firebase/firestore';
import PixelIcon from '../components/PixelIcon';
import useFeedPhotos from '../hooks/useFeedPhotos';
import { useViewedStories } from '../hooks/useViewedStories';
import { usePhotoDetailActions } from '../context/PhotoDetailContext';
import FeedPhotoCard from '../components/FeedPhotoCard';
import FeedLoadingSkeleton from '../components/FeedLoadingSkeleton';
import { FriendStoryCard } from '../components';
import { MeStoryCard } from '../components/MeStoryCard';
import AddFriendsPromptCard from '../components/AddFriendsPromptCard';
import TakeFirstPhotoCard from '../components/TakeFirstPhotoCard';
import {
  toggleReaction,
  getFriendStoriesData,
  getUserStoriesData,
  getRandomFriendPhotos,
} from '../services/firebase/feedService';
import { getFriendUserIds } from '../services/firebase/friendshipService';
import { useAuth } from '../context/AuthContext';
import { useScreenTrace } from '../hooks/useScreenTrace';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';
import logger from '../utils/logger';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SHIMMER_WIDTH = 80;

const db = getFirestore();

// Layout constants
const HEADER_HEIGHT = 68; // paddingVertical: 16 × 2 + title height
const TAB_BAR_HEIGHT = 88; // iOS tab bar with safe area

const FeedScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Photo detail actions only - using usePhotoDetailActions to avoid re-renders
  // when photo detail state changes (e.g. during modal close)
  const { openPhotoDetail, setCallbacks, updatePhotoAtIndex, updateCurrentPhoto } =
    usePhotoDetailActions();

  // Track current feed photo for reaction updates (ref to avoid re-renders)
  const currentFeedPhotoRef = useRef(null);

  // Ref for scrolling FlatList to top
  const flatListRef = useRef(null);
  const scrollOffsetRef = useRef(0);

  // Animated scroll value for header hide/show
  const scrollY = useRef(new Animated.Value(0)).current;

  // Animated value for content fade-in when loading completes
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const wasLoading = useRef(true);

  // Shimmer animation for skeleton
  const shimmerPosition = useRef(new Animated.Value(-SHIMMER_WIDTH)).current;
  const shimmerAnimation = useRef(null);

  // Screen load trace - measures time from mount to data-ready
  const { markLoaded } = useScreenTrace('FeedScreen');
  const screenTraceMarkedRef = useRef(false);

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

  // Stories state
  const [friendStories, setFriendStories] = useState([]);
  const [totalFriendCount, setTotalFriendCount] = useState(0);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const selectedFriendRef = useRef(null);
  const selectedFriendIndexRef = useRef(0);

  // Own stories state
  const [myStories, setMyStories] = useState(null);
  const [myStoriesLoading, setMyStoriesLoading] = useState(true);

  // Archive photos fallback state (when recent feed is empty)
  const [archivePhotos, setArchivePhotos] = useState([]);
  const [archivePhotosLoading, setArchivePhotosLoading] = useState(false);

  // Track whether currently in stories mode (for callbacks)
  const isInStoriesModeRef = useRef(false);
  const isOwnStoriesRef = useRef(false);

  // Notifications state - red dot indicator
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  // View tracking state
  // Note: viewedPhotoCount creates render dependency - FeedScreen re-renders when viewed state changes
  // This ensures MeStoryCard and FriendStoryCard ring indicators update after viewing photos
  const {
    markAsViewed,
    markPhotosAsViewed,
    getFirstUnviewedIndex,
    hasViewedAllPhotos,
    loading: viewedStoriesLoading,
    viewedPhotoCount, // Forces re-render when count changes (updates ring indicators)
  } = useViewedStories();
  // Track current index in stories modal (ref to avoid closure capture issues in callbacks)
  const storiesCurrentIndexRef = useRef(0);

  // Refs to hold latest handlers (avoids stale closures in setCallbacks effect)
  const handleCloseMyStoriesRef = useRef(() => {});
  const handleCloseStoriesRef = useRef(() => {});
  const handleRequestNextFriendRef = useRef(() => {});
  const handleRequestPreviousFriendRef = useRef(() => {});
  const handleCancelFriendTransitionRef = useRef(() => {});

  // Save pre-transition state for cancel (interactive swipe cancel restores without side effects)
  const preTransitionRef = useRef(null);

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

  const loadMyStories = async () => {
    if (!user?.uid) return;

    logger.debug('FeedScreen: Loading own stories data');
    setMyStoriesLoading(true);
    const result = await getUserStoriesData(user.uid);
    if (result.success) {
      logger.info('FeedScreen: Own stories loaded', {
        photoCount: result.userStory?.totalPhotoCount || 0,
      });
      setMyStories(result.userStory);
    } else {
      logger.warn('FeedScreen: Failed to load own stories', { error: result.error });
      setMyStories(null);
    }
    setMyStoriesLoading(false);
  };

  useEffect(() => {
    if (user?.uid) {
      loadFriendStories();
      loadMyStories();
    }
  }, [user?.uid]);

  // Mark screen trace as loaded after initial feed data loads (once only)
  useEffect(() => {
    if (!loading && !screenTraceMarkedRef.current) {
      screenTraceMarkedRef.current = true;
      markLoaded({ photo_count: photos.length });
    }
  }, [loading]);

  /**
   * Fade-in animation when loading completes
   * Detects loading/refreshing -> loaded transition and animates opacity 0 -> 1
   */
  const isLoadingOrRefreshing = loading || refreshing;
  useEffect(() => {
    if (wasLoading.current && !isLoadingOrRefreshing) {
      // Loading/refreshing just finished - animate content fade in
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (isLoadingOrRefreshing && !wasLoading.current) {
      // Starting to load/refresh - reset opacity
      contentOpacity.setValue(0);
    }
    wasLoading.current = isLoadingOrRefreshing;
  }, [isLoadingOrRefreshing, contentOpacity]);

  /**
   * Shimmer animation for skeleton loaders
   * Fast sweep (800ms) left-to-right, loops while loading
   */
  useEffect(() => {
    if (isLoadingOrRefreshing || storiesLoading) {
      // Start shimmer animation
      shimmerPosition.setValue(-SHIMMER_WIDTH);
      shimmerAnimation.current = Animated.loop(
        Animated.timing(shimmerPosition, {
          toValue: SCREEN_WIDTH,
          duration: 800, // Faster than original 1200ms
          useNativeDriver: true,
        })
      );
      shimmerAnimation.current.start();
    } else {
      // Stop shimmer animation
      if (shimmerAnimation.current) {
        shimmerAnimation.current.stop();
        shimmerAnimation.current = null;
      }
    }
    return () => {
      if (shimmerAnimation.current) {
        shimmerAnimation.current.stop();
      }
    };
  }, [isLoadingOrRefreshing, storiesLoading, shimmerPosition]);

  /**
   * Load archive photos as fallback when recent feed is empty
   * Only loads if user has friends but no recent posts
   */
  useEffect(() => {
    const loadArchivePhotosFallback = async () => {
      // Only load if: not loading, no recent photos, user has friends
      if (loading || photos.length > 0 || totalFriendCount === 0 || !user?.uid) {
        // Clear archive photos if we now have recent photos
        if (photos.length > 0 && archivePhotos.length > 0) {
          setArchivePhotos([]);
        }
        return;
      }

      logger.debug('FeedScreen: Loading archive photos fallback');
      setArchivePhotosLoading(true);

      // Get friend user IDs
      const friendsResult = await getFriendUserIds(user.uid);
      if (!friendsResult.success || friendsResult.friendUserIds.length === 0) {
        setArchivePhotosLoading(false);
        return;
      }

      // Load random historical photos from friends (excluding blocked users)
      const result = await getRandomFriendPhotos(friendsResult.friendUserIds, 10, user.uid);
      if (result.success) {
        logger.info('FeedScreen: Archive photos loaded', { count: result.photos.length });
        setArchivePhotos(result.photos);
      }
      setArchivePhotosLoading(false);
    };

    loadArchivePhotosFallback();
  }, [loading, photos.length, totalFriendCount, user?.uid]);

  // Subscribe to unread notifications for red dot indicator
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
   * Set up default callbacks for PhotoDetailContext
   * Callbacks are overridden when opening feed or stories mode
   */
  useEffect(() => {
    // Set up a callback router that checks current mode
    setCallbacks({
      onReactionToggle: (emoji, currentCount) => {
        if (isInStoriesModeRef.current) {
          handleStoriesReactionToggle(emoji, currentCount);
        } else {
          handleFeedReactionToggle(emoji, currentCount);
        }
      },
      onPhotoChange: handleStoriesPhotoChange,
      onRequestNextFriend: () => handleRequestNextFriendRef.current(),
      onRequestPreviousFriend: () => handleRequestPreviousFriendRef.current(),
      onCancelFriendTransition: () => handleCancelFriendTransitionRef.current(),
      onClose: () => {
        if (isInStoriesModeRef.current) {
          if (isOwnStoriesRef.current) {
            // Use ref to get latest handler (avoids stale closure capturing old myStories)
            handleCloseMyStoriesRef.current();
          } else {
            // Use ref to get latest handler (avoids stale closure capturing old selectedFriend)
            handleCloseStoriesRef.current();
          }
        } else {
          // Feed mode close
          currentFeedPhotoRef.current = null;
        }
        isInStoriesModeRef.current = false;
        isOwnStoriesRef.current = false;
      },
      onAvatarPress: (userId, username) => {
        // For own stories: header avatar goes to Profile tab
        if (isOwnStoriesRef.current && userId === user?.uid) {
          navigation.navigate('Profile');
        } else {
          navigation.navigate('ProfileFromPhotoDetail', { userId, username });
        }
      },
      onPhotoStateChanged: () => {
        // Photo was archived/deleted/restored - refresh feed and stories
        refreshFeed();
        loadFriendStories();
        loadMyStories();
      },
      onCommentCountChange: handleCommentCountChange,
    });
  }, [setCallbacks, user?.uid, handleCommentCountChange]);

  const handleRefresh = async () => {
    logger.debug('FeedScreen: Pull-to-refresh triggered');
    // Refresh all data sources in parallel
    await Promise.all([refreshFeed(), loadFriendStories(), loadMyStories()]);
  };

  // Track scroll offset on the JS side for tab-press logic
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      scrollOffsetRef.current = value;
    });
    return () => scrollY.removeListener(id);
  }, [scrollY]);

  // Tap Feed tab: scroll to top if scrolled down, refresh if already at top
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', e => {
      if (navigation.isFocused()) {
        if (scrollOffsetRef.current > 5) {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        } else {
          handleRefresh();
        }
      }
    });
    return unsubscribe;
  }, [navigation]);

  const handleAvatarPress = (userId, username) => {
    logger.debug('FeedScreen: Avatar pressed, navigating to profile', { userId, username });
    navigation.navigate('OtherUserProfile', { userId, username });
  };

  const handleOwnAvatarPress = () => {
    logger.debug('FeedScreen: Own avatar pressed');
    navigation.navigate('Profile');
  };

  /**
   * Handle opening stories for a friend
   * Starts at the first unviewed photo, or beginning if all viewed
   */
  const handleOpenStories = (friend, sourceRect) => {
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

    // Store friend info in refs for callbacks
    selectedFriendRef.current = friend;
    selectedFriendIndexRef.current = friendIdx;
    storiesCurrentIndexRef.current = startIndex;

    // Set mode flags
    isInStoriesModeRef.current = true;
    isOwnStoriesRef.current = false;

    // Open via context and navigate
    openPhotoDetail({
      mode: 'stories',
      photos: friend.topPhotos || [],
      initialIndex: startIndex,
      currentUserId: user?.uid,
      hasNextFriend: friendIdx < sortedFriends.length - 1,
      hasPreviousFriend: friendIdx > 0,
      isOwnStory: false,
      sourceRect: sourceRect || null,
    });
    navigation.navigate('PhotoDetail');
  };

  /**
   * Handle opening own stories
   * Starts at the first unviewed photo, or beginning if all viewed
   */
  const handleOpenMyStories = sourceRect => {
    if (!myStories?.hasPhotos) {
      logger.debug('FeedScreen: No own photos to show');
      return;
    }

    const startIndex = getFirstUnviewedIndex(myStories.topPhotos || []);

    logger.info('FeedScreen: Opening own stories viewer', {
      startIndex,
      photoCount: myStories.topPhotos?.length || 0,
    });

    storiesCurrentIndexRef.current = startIndex;

    // Set mode flags
    isInStoriesModeRef.current = true;
    isOwnStoriesRef.current = true;

    // Open via context and navigate
    openPhotoDetail({
      mode: 'stories',
      photos: myStories.topPhotos || [],
      initialIndex: startIndex,
      currentUserId: user?.uid,
      hasNextFriend: false,
      isOwnStory: true,
      sourceRect: sourceRect || null,
    });
    navigation.navigate('PhotoDetail');
  };

  /**
   * Handle closing own stories viewer
   * Marks photos as viewed (called via context close callback)
   */
  const handleCloseMyStories = () => {
    logger.debug('FeedScreen: Closing own stories viewer');
    if (myStories) {
      const allPhotos = myStories.topPhotos || [];
      const isAtEnd = storiesCurrentIndexRef.current >= allPhotos.length - 1;

      if (isAtEnd) {
        // User viewed all photos - mark all as viewed
        markAsViewed(myStories.userId);
        const photoIds = allPhotos.map(p => p.id);
        if (photoIds.length > 0) {
          markPhotosAsViewed(photoIds);
        }
      } else {
        // User closed mid-story - only mark photos up to current index as viewed
        const viewedPhotoIds = allPhotos
          .slice(0, storiesCurrentIndexRef.current + 1)
          .map(p => p.id);
        if (viewedPhotoIds.length > 0) {
          markPhotosAsViewed(viewedPhotoIds);
        }
      }
    }
    // Mode flags are cleared in the onClose callback
  };

  const handleStoriesPhotoChange = (photo, index) => {
    logger.debug('FeedScreen: Stories photo changed', { photoId: photo?.id, index });
    storiesCurrentIndexRef.current = index;
  };

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
   * Note: PhotoDetailScreen handles cube animation, we just update context state
   */
  const handleRequestNextFriend = () => {
    const selectedFriend = selectedFriendRef.current;
    const selectedFriendIndex = selectedFriendIndexRef.current;
    if (!selectedFriend) return;

    // Save pre-transition state for potential cancel
    preTransitionRef.current = {
      friend: selectedFriend,
      friendIndex: selectedFriendIndex,
      currentIndex: storiesCurrentIndexRef.current,
    };

    const sortedFriends = getSortedFriends();
    const nextFriendIdx = selectedFriendIndex + 1;

    if (nextFriendIdx >= sortedFriends.length) {
      logger.debug('FeedScreen: No more friends, closing stories');
      // Navigation will be handled by PhotoDetailScreen
      return;
    }

    // Mark photos up to current index as viewed (user may be mid-story due to swipe)
    const currentPhotos = selectedFriend.topPhotos || [];
    const viewedPhotoIds = currentPhotos
      .slice(0, storiesCurrentIndexRef.current + 1)
      .map(p => p.id);
    if (viewedPhotoIds.length > 0) {
      markPhotosAsViewed(viewedPhotoIds);
    }
    // Only mark friend as fully viewed if user saw all photos
    if (storiesCurrentIndexRef.current >= currentPhotos.length - 1) {
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

    // Update refs for next friend
    selectedFriendRef.current = nextFriend;
    selectedFriendIndexRef.current = nextFriendIdx;
    storiesCurrentIndexRef.current = nextStartIndex;

    // Update context state so PhotoDetailScreen renders new friend's photos
    openPhotoDetail({
      mode: 'stories',
      photos: nextFriend.topPhotos || [],
      initialIndex: nextStartIndex,
      currentUserId: user?.uid,
      hasNextFriend: nextFriendIdx < sortedFriends.length - 1,
      hasPreviousFriend: nextFriendIdx > 0,
      isOwnStory: false,
    });
  };

  /**
   * Handle transitioning to previous friend's stories (reverse cube animation)
   * Called when user swipes right or taps left at first photo
   * Only marks photos up to current index as viewed (user is leaving mid-story)
   */
  const handleRequestPreviousFriend = () => {
    const selectedFriend = selectedFriendRef.current;
    const selectedFriendIndex = selectedFriendIndexRef.current;
    if (!selectedFriend) return;

    // Save pre-transition state for potential cancel
    preTransitionRef.current = {
      friend: selectedFriend,
      friendIndex: selectedFriendIndex,
      currentIndex: storiesCurrentIndexRef.current,
    };

    const sortedFriends = getSortedFriends();
    const prevFriendIdx = selectedFriendIndex - 1;

    if (prevFriendIdx < 0) {
      logger.debug('FeedScreen: No previous friend, cannot go back');
      return;
    }

    // Mark photos up to current index as viewed (user is leaving mid-story)
    const currentPhotos = selectedFriend.topPhotos || [];
    const viewedPhotoIds = currentPhotos
      .slice(0, storiesCurrentIndexRef.current + 1)
      .map(p => p.id);
    if (viewedPhotoIds.length > 0) {
      markPhotosAsViewed(viewedPhotoIds);
    }
    // Only mark friend as fully viewed if user saw all photos
    if (storiesCurrentIndexRef.current >= currentPhotos.length - 1) {
      markAsViewed(selectedFriend.userId);
    }

    // Get previous friend
    const prevFriend = sortedFriends[prevFriendIdx];
    // When going backward, start at the LAST photo (user expects to see the end of the previous story)
    const prevPhotos = prevFriend.topPhotos || [];
    const prevStartIndex = Math.max(0, prevPhotos.length - 1);

    logger.info('FeedScreen: Transitioning to previous friend', {
      fromFriend: selectedFriend.displayName,
      toFriend: prevFriend.displayName,
      prevFriendIndex: prevFriendIdx,
      startIndex: prevStartIndex,
    });

    // Update refs for previous friend
    selectedFriendRef.current = prevFriend;
    selectedFriendIndexRef.current = prevFriendIdx;
    storiesCurrentIndexRef.current = prevStartIndex;

    // Update context state so PhotoDetailScreen renders previous friend's photos
    openPhotoDetail({
      mode: 'stories',
      photos: prevFriend.topPhotos || [],
      initialIndex: prevStartIndex,
      currentUserId: user?.uid,
      hasNextFriend: prevFriendIdx < sortedFriends.length - 1,
      hasPreviousFriend: prevFriendIdx > 0,
      isOwnStory: false,
    });
  };

  /**
   * Handle closing stories viewer
   * Only marks photos up to current position as viewed
   * Only marks friend as viewed (gray ring) when ALL photos are viewed
   * (called via context close callback)
   */
  const handleCloseStories = () => {
    logger.debug('FeedScreen: Closing stories viewer', {
      currentIndex: storiesCurrentIndexRef.current,
    });
    const selectedFriend = selectedFriendRef.current;
    if (selectedFriend) {
      const allPhotos = selectedFriend.topPhotos || [];
      const isAtEnd = storiesCurrentIndexRef.current >= allPhotos.length - 1;

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
        const viewedPhotoIds = allPhotos
          .slice(0, storiesCurrentIndexRef.current + 1)
          .map(p => p.id);
        if (viewedPhotoIds.length > 0) {
          markPhotosAsViewed(viewedPhotoIds);
        }
        logger.info('FeedScreen: Partial view - marking photos up to current index', {
          friendId: selectedFriend.userId,
          currentIndex: storiesCurrentIndexRef.current,
          markedCount: viewedPhotoIds.length,
          totalCount: allPhotos.length,
        });
      }
    }
    selectedFriendRef.current = null;
    // Mode flags are cleared in the onClose callback
  };

  /**
   * Cancel a friend transition that was prepared but not committed (interactive swipe cancel).
   * Restores refs from preTransitionRef without marking any photos as viewed.
   */
  const handleCancelFriendTransition = () => {
    const saved = preTransitionRef.current;
    if (!saved) return;

    const sortedFriends = getSortedFriends();

    // Restore refs to pre-transition state
    selectedFriendRef.current = saved.friend;
    selectedFriendIndexRef.current = saved.friendIndex;
    storiesCurrentIndexRef.current = saved.currentIndex;

    // Restore context state so PhotoDetailScreen renders original friend's photos
    openPhotoDetail({
      mode: 'stories',
      photos: saved.friend.topPhotos || [],
      initialIndex: saved.currentIndex,
      currentUserId: user?.uid,
      hasNextFriend: saved.friendIndex < sortedFriends.length - 1,
      hasPreviousFriend: saved.friendIndex > 0,
      isOwnStory: false,
    });

    preTransitionRef.current = null;
  };

  // Update handler refs on each render (ensures callbacks get latest handlers)
  handleCloseMyStoriesRef.current = handleCloseMyStories;
  handleCloseStoriesRef.current = handleCloseStories;
  handleRequestNextFriendRef.current = handleRequestNextFriend;
  handleRequestPreviousFriendRef.current = handleRequestPreviousFriend;
  handleCancelFriendTransitionRef.current = handleCancelFriendTransition;

  const handlePhotoPress = (photo, sourceRect) => {
    currentFeedPhotoRef.current = photo;
    openPhotoDetail({
      mode: 'feed',
      photo,
      currentUserId: user?.uid,
      initialShowComments: false,
      sourceRect: sourceRect || null,
    });
    navigation.navigate('PhotoDetail');
  };

  // Navigate to photo detail with comments panel visible
  const handleCommentPress = (photo, sourceRect) => {
    currentFeedPhotoRef.current = photo;
    openPhotoDetail({
      mode: 'feed',
      photo,
      currentUserId: user?.uid,
      initialShowComments: true,
      sourceRect: sourceRect || null,
    });
    navigation.navigate('PhotoDetail');
  };

  /**
   * Handle reaction toggle for feed photos with optimistic UI update
   * Called via context callback from PhotoDetailScreen
   * Increments the count for the selected emoji
   */
  const handleFeedReactionToggle = async (emoji, currentCount) => {
    const photo = currentFeedPhotoRef.current;
    if (!user || !photo) return;

    const photoId = photo.id;
    const userId = user.uid;

    // Optimistic update - increment count immediately
    const updatedReactions = { ...photo.reactions };
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
      ...photo,
      reactions: updatedReactions,
      reactionCount: newTotalCount,
    };

    // Update the ref, feed state, and context photo for modal re-render
    currentFeedPhotoRef.current = updatedPhoto;
    updatePhotoInState(photoId, updatedPhoto);
    updateCurrentPhoto(updatedPhoto);

    // Persist to Firebase
    try {
      const result = await toggleReaction(photoId, userId, emoji, currentCount);
      if (!result.success) {
        logger.error('Failed to toggle reaction', { error: result.error });
        // Revert optimistic update on error
        currentFeedPhotoRef.current = photo;
        updatePhotoInState(photoId, photo);
        updateCurrentPhoto(photo);
      }
    } catch (error) {
      logger.error('Error toggling reaction', error);
      // Revert optimistic update on error
      currentFeedPhotoRef.current = photo;
      updatePhotoInState(photoId, photo);
      updateCurrentPhoto(photo);
    }
  };

  /**
   * Handle optimistic comment count update from PhotoDetailScreen
   * Updates feed list, ref, and context photo immediately
   */
  const handleCommentCountChange = useCallback(
    (photoId, delta) => {
      const photo = currentFeedPhotoRef.current;
      if (!photo || photo.id !== photoId) {
        logger.warn('FeedScreen: Comment count change for different photo', {
          currentPhotoId: photo?.id,
          targetPhotoId: photoId,
        });
        return;
      }

      // Optimistically update comment count (follows reaction pattern)
      const updatedPhoto = {
        ...photo,
        commentCount: (photo.commentCount || 0) + delta,
      };

      // Update all 3 locations (same as reactions)
      currentFeedPhotoRef.current = updatedPhoto;
      updatePhotoInState(photoId, updatedPhoto);
      updateCurrentPhoto(updatedPhoto);

      logger.debug('FeedScreen: Optimistically updated comment count', {
        photoId,
        delta,
        newCount: updatedPhoto.commentCount,
      });

      // NOTE: No explicit revert needed - real-time Firebase subscription
      // will auto-sync correct count within ~100-200ms
    },
    [updatePhotoInState, updateCurrentPhoto]
  );

  /**
   * Handle reaction toggle for stories photos
   * Updates the photo in selectedFriend.topPhotos and persists to Firebase
   */
  const handleStoriesReactionToggle = async (emoji, currentCount) => {
    const selectedFriend = selectedFriendRef.current;
    if (!user || !selectedFriend) return;

    const userId = user.uid;
    const topPhotos = selectedFriend.topPhotos || [];
    const currentPhoto = topPhotos[storiesCurrentIndexRef.current];

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
    updatedPhotos[storiesCurrentIndexRef.current] = {
      ...currentPhoto,
      reactions: updatedReactions,
      reactionCount: newTotalCount,
    };

    // Update ref with new photos
    selectedFriendRef.current = {
      ...selectedFriend,
      topPhotos: updatedPhotos,
    };

    // Update friendStories state so data persists after close/reopen
    setFriendStories(prevStories =>
      prevStories.map(friend =>
        friend.userId === selectedFriend.userId ? { ...friend, topPhotos: updatedPhotos } : friend
      )
    );

    // Update context photos for PhotoDetailScreen re-render
    updatePhotoAtIndex(
      storiesCurrentIndexRef.current,
      updatedPhotos[storiesCurrentIndexRef.current]
    );

    // Persist to Firebase
    try {
      const result = await toggleReaction(photoId, userId, emoji, currentCount);
      if (!result.success) {
        logger.error('Failed to toggle stories reaction', { error: result.error });
        // Revert optimistic update on error
        selectedFriendRef.current = selectedFriend;
      }
    } catch (error) {
      logger.error('Error toggling stories reaction', error);
      // Revert optimistic update on error
      selectedFriendRef.current = selectedFriend;
    }
  };

  const renderFeedItem = useCallback(
    ({ item }) => (
      <FeedPhotoCard
        photo={item}
        onPress={sourceRect => handlePhotoPress(item, sourceRect)}
        onCommentPress={sourceRect => handleCommentPress(item, sourceRect)}
        onAvatarPress={handleAvatarPress}
        currentUserId={user?.uid}
      />
    ),
    [handlePhotoPress, handleCommentPress, handleAvatarPress, user?.uid]
  );

  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <PixelSpinner size="small" color={colors.text.primary} />
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
        <PixelIcon name="sad-outline" size={64} color={colors.text.secondary} />
        <Text style={styles.emptyTitle}>Nothing yet</Text>
        <Text style={styles.emptyText}>Tell your friends to post!</Text>
      </View>
    );
  };

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
   * Uses rectangular cards matching FriendStoryCard shape with name placeholders
   */
  const renderStoriesLoadingSkeleton = () => {
    return (
      <View style={styles.storiesSkeletonContainer}>
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={styles.storySkeletonItem}>
            {/* Rectangular photo placeholder with shimmer */}
            <View style={styles.storySkeletonPhoto}>
              <Animated.View
                style={[styles.shimmerHighlight, { transform: [{ translateX: shimmerPosition }] }]}
              />
            </View>
            {/* Name text placeholder with shimmer */}
            <View style={styles.storySkeletonName}>
              <Animated.View
                style={[styles.shimmerHighlight, { transform: [{ translateX: shimmerPosition }] }]}
              />
            </View>
          </View>
        ))}
      </View>
    );
  };

  /**
   * Render stories row
   * Shows MeStoryCard first, then friend cards sorted by viewed state (unviewed first)
   * Waits for both stories data AND viewed state to load to prevent race conditions
   * Shows AddFriendsPromptCard when user has no friends (after MeStoryCard)
   */
  const renderStoriesRow = () => {
    // Wait for both stories data AND viewed state to load
    // This prevents showing all stories as unviewed while Firestore data is loading
    if (storiesLoading || myStoriesLoading || viewedStoriesLoading) {
      return <View style={styles.storiesContainer}>{renderStoriesLoadingSkeleton()}</View>;
    }

    // Sort friends by viewed state - unviewed first (based on ALL photos viewed)
    const sortedFriends = [...friendStories].sort((a, b) => {
      const aViewed = hasViewedAllPhotos(a.topPhotos);
      const bViewed = hasViewedAllPhotos(b.topPhotos);
      if (aViewed === bViewed) return 0;
      return aViewed ? 1 : -1; // Unviewed first
    });

    // Show AddFriendsPromptCard when user has no friends (but always show MeStoryCard first)
    if (totalFriendCount === 0) {
      return (
        <View style={styles.storiesContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.storiesScrollContent}
          >
            {/* MeStoryCard always first - shows even without friends */}
            {myStories && (
              <MeStoryCard
                friend={myStories}
                onPress={handleOpenMyStories}
                isFirst={true}
                isViewed={hasViewedAllPhotos(myStories.topPhotos)}
              />
            )}
            <AddFriendsPromptCard
              onPress={() => navigation.navigate('FriendsList')}
              isFirst={!myStories}
            />
          </ScrollView>
        </View>
      );
    }

    // Hide stories row if friends exist but none have photos AND user has no photos
    if (friendStories.length === 0 && !myStories?.hasPhotos) {
      // Still show MeStoryCard if user has stories data (even empty)
      if (myStories) {
        return (
          <View style={styles.storiesContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.storiesScrollContent}
            >
              <MeStoryCard
                friend={myStories}
                onPress={handleOpenMyStories}
                isFirst={true}
                isViewed={hasViewedAllPhotos(myStories.topPhotos)}
              />
            </ScrollView>
          </View>
        );
      }
      return null;
    }

    return (
      <View style={styles.storiesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesScrollContent}
        >
          {/* MeStoryCard always first */}
          {myStories && (
            <MeStoryCard
              friend={myStories}
              onPress={handleOpenMyStories}
              onAvatarPress={handleOwnAvatarPress}
              isFirst={true}
              isViewed={hasViewedAllPhotos(myStories.topPhotos)}
            />
          )}
          {/* Friend cards after MeStoryCard */}
          {sortedFriends.map((friend, index) => (
            <FriendStoryCard
              key={friend.userId}
              friend={friend}
              onPress={sourceRect => handleOpenStories(friend, sourceRect)}
              onAvatarPress={handleAvatarPress}
              isFirst={false}
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
        {/* Left-aligned friends button */}
        <TouchableOpacity
          testID="friends-button"
          onPress={() => navigation.navigate('FriendsList')}
          style={styles.friendsButton}
        >
          <PixelIcon name="people-outline" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        {/* Centered title */}
        <Text style={styles.headerTitle}>Rewind</Text>
        {/* Right-aligned notification button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Activity')}
          style={styles.notificationButton}
        >
          <PixelIcon name="heart-outline" size={24} color={colors.text.primary} />
          {hasNewNotifications && <View style={styles.notificationDot} />}
        </TouchableOpacity>
      </Animated.View>

      {/* Content */}
      {loading || refreshing ? (
        <>
          {renderStoriesRow()}
          <FeedLoadingSkeleton count={3} />
        </>
      ) : error ? (
        renderErrorState()
      ) : (
        <Animated.View style={[styles.contentContainer, { opacity: contentOpacity }]}>
          <Animated.FlatList
            testID="feed-list"
            ref={flatListRef}
            data={photos.length > 0 ? photos : archivePhotos}
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
                tintColor={colors.brand.purple}
                colors={[colors.brand.purple]}
                progressBackgroundColor={colors.background.secondary}
                progressViewOffset={40}
              />
            }
            initialNumToRender={4}
            maxToRenderPerBatch={3}
            windowSize={5}
            removeClippedSubviews={true}
            updateCellsBatchingPeriod={50}
            onEndReached={photos.length > 0 ? loadMorePhotos : null}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={renderStoriesRow}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={archivePhotosLoading ? null : renderEmptyState()}
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  contentContainer: {
    flex: 1,
  },
  statusBarMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 11, // Above header (zIndex: 10)
    backgroundColor: colors.background.primary,
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerTitle: {
    fontSize: typography.size.xxl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
  },
  friendsButton: {
    padding: spacing.xs,
    position: 'absolute',
    left: spacing.lg,
  },
  notificationButton: {
    padding: spacing.xs,
    position: 'absolute',
    right: spacing.lg,
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: layout.borderRadius.md,
    backgroundColor: colors.status.danger,
  },
  feedList: {
    // paddingTop set dynamically with insets.top
    paddingBottom: TAB_BAR_HEIGHT + spacing.lg,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    marginLeft: spacing.sm,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: 100,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  errorTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.brand.purple,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: layout.borderRadius.sm,
  },
  retryButtonText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  // Stories row styles
  storiesContainer: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    backgroundColor: colors.background.primary,
  },
  storiesScrollContent: {
    paddingHorizontal: spacing.sm,
  },
  // Stories loading skeleton styles (match FriendStoryCard dimensions)
  storiesSkeletonContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
  },
  storySkeletonItem: {
    width: 94 + 8, // STORY_PHOTO_WIDTH (88) + STORY_BORDER_WIDTH*2 (6) + padding (8)
    alignItems: 'center',
    marginRight: 10,
  },
  storySkeletonPhoto: {
    width: 94, // 88 + 6 border
    height: 136, // 130 + 6 border
    borderRadius: layout.borderRadius.md,
    backgroundColor: colors.background.tertiary,
    marginBottom: spacing.xs,
    overflow: 'hidden', // Contain shimmer
  },
  storySkeletonName: {
    width: 50,
    height: 10,
    borderRadius: layout.borderRadius.sm,
    backgroundColor: colors.background.tertiary,
    overflow: 'hidden', // Contain shimmer
  },
  // Shimmer highlight bar that sweeps across skeleton elements
  shimmerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SHIMMER_WIDTH,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)', // Semi-transparent white highlight
  },
});

export default FeedScreen;
