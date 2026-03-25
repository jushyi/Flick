import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, useIsFocused } from '@react-navigation/native';
import PixelIcon from '../components/PixelIcon';
import StrokedNameText from '../components/StrokedNameText';
import { ProfilePhotoGridSkeleton } from '../components/skeletons/ProfilePhotoGridSkeleton';
import { EmptyState } from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { profileCacheKey } from '../utils/imageUtils';
import { layout } from '../constants/layout';
import {
  SelectsBanner,
  FullscreenSelectsViewer,
  SelectsEditOverlay,
  ProfileSongCard,
  AlbumBar,
  DropdownMenu,
  MonthlyAlbumsSection,
} from '../components';
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  getFriends as getFriendships,
  getFriendshipStatus as checkFriendshipStatus,
  unfriend as removeFriend,
} from '../services/supabase/friendshipService';
// TODO(20-01): getUserAlbums, getPhotosByIds, deleteAlbum - need supabase equivalents
const getUserAlbums = async (..._args: any[]): Promise<any> => ({ success: false, albums: [] });
const getPhotosByIds = async (..._args: any[]): Promise<any> => ({ success: false, photos: [] });
const deleteAlbum = async (..._args: any[]): Promise<any> => ({ success: true });
import { getUserProfile } from '../services/supabase/profileService';
import { blockUser, unblockUser, isBlocked } from '../services/supabase/blockService';
import { uploadSelectsPhotos } from '../services/supabase/storageService';
// TODO(20-01): generateFriendshipId - not needed with Supabase UUID PKs
import { typography } from '../constants/typography';
import { useScreenTrace } from '../hooks/useScreenTrace';
import logger from '../utils/logger';

const HEADER_HEIGHT = 64;
const PROFILE_PHOTO_SIZE = 120;

const ProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, userProfile, updateUserProfile, updateUserDocument } = useAuth();
  const updateUserDocumentNative = updateUserDocument; // alias for compatibility
  const insets = useSafeAreaInsets();

  // Modal states
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showEditOverlay, setShowEditOverlay] = useState(false);

  // Albums state
  const [albums, setAlbums] = useState<any[]>([]);
  const [coverPhotoUrls, setCoverPhotoUrls] = useState<Record<string, string>>({});

  // Album menu state
  const [albumMenuVisible, setAlbumMenuVisible] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<any>(null);
  const [albumMenuAnchor, setAlbumMenuAnchor] = useState<any>(null);

  // New album animation state
  const [highlightedAlbumId, setHighlightedAlbumId] = useState<string | null>(null);
  const scrollViewRef = useRef<any>(null);
  const albumBarRef = useRef<any>(null);

  // Profile menu state (for other user profiles)
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<any>(null);
  const profileMenuButtonRef = useRef<any>(null);

  // Other user profile state (when viewing someone else's profile)
  const [otherUserProfile, setOtherUserProfile] = useState<any>(null);
  const [otherUserLoading, setOtherUserLoading] = useState(false);
  const [otherUserError, setOtherUserError] = useState<string | null>(null);

  // Friendship state
  const [friendshipStatus, setFriendshipStatus] = useState('none'); // 'none' | 'friends' | 'pending_sent' | 'pending_received'
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [friendshipLoading, setFriendshipLoading] = useState(false);
  const [friendshipStatusLoaded, setFriendshipStatusLoaded] = useState(false);

  // Friend count state
  const [friendCount, setFriendCount] = useState(0);

  // Block status state
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [hasBlockedMe, setHasBlockedMe] = useState(false);

  // Derived friendship state (early declaration for use in effects)
  const isFriend = friendshipStatus === 'friends';

  // Track if initial data fetch is done (to avoid re-fetching on focus for other user profiles)
  const initialFetchDoneRef = useRef(false);
  const albumsFetchedRef = useRef(false);

  // Screen load trace - measures time from mount to data-ready
  const { markLoaded } = useScreenTrace('ProfileScreen');
  const screenTraceMarkedRef = useRef(false);

  // Get route params for viewing other users' profiles
  const { userId, username: routeUsername } = (route.params || {}) as any;

  // Determine if viewing own profile vs another user's profile
  const isOwnProfile = !userId || userId === user?.id;

  // Fetch other user's profile data
  const fetchOtherUserProfile = useCallback(async () => {
    if (isOwnProfile || !userId) return;

    setOtherUserLoading(true);
    setOtherUserError(null);

    try {
      const profile = await getUserProfile(userId);
      setOtherUserProfile(profile);
      logger.info('ProfileScreen: Fetched other user profile', { userId });
    } catch (error) {
      setOtherUserError((error as Error).message);
      logger.error('ProfileScreen: Error fetching other user profile', { error: (error as Error).message });
    } finally {
      setOtherUserLoading(false);
    }
  }, [isOwnProfile, userId]);

  // Fetch friendship and block status between current user and profile user
  const fetchFriendshipStatus = useCallback(async () => {
    if (isOwnProfile || !userId || !user?.id) {
      setFriendshipStatusLoaded(true); // Mark as loaded for own profile
      return;
    }

    try {
      // Check friendship status
      const status = await checkFriendshipStatus(user.id, userId);
      if (status) {
        setFriendshipStatus(status);
        logger.info('ProfileScreen: Fetched friendship status', { status });
      }

      // Check if I blocked this user
      const blockedByMeResult = await isBlocked(user.id, userId);
      setIsBlockedByMe(blockedByMeResult);

      // Check if this user blocked me
      const blockedMeResult = await isBlocked(userId, user.id);
      setHasBlockedMe(blockedMeResult);

      logger.info('ProfileScreen: Fetched block status', {
        isBlockedByMe: blockedByMeResult,
        hasBlockedMe: blockedMeResult,
      });
    } catch (error) {
      logger.error('ProfileScreen: Error fetching friendship/block status', {
        error: (error as Error).message,
      });
    } finally {
      setFriendshipStatusLoaded(true); // Mark as loaded even on error
    }
  }, [isOwnProfile, userId, user?.id]);

  // Fetch friend count for own profile (queries friendships directly for accuracy)
  const fetchFriendCount = useCallback(async () => {
    if (!isOwnProfile || !user?.id) return;

    try {
      const friends = await getFriendships(user.id);
      setFriendCount(friends.length);
    } catch (error) {
      logger.error('ProfileScreen: Error fetching friend count', { error: (error as Error).message });
    }
  }, [isOwnProfile, user?.id]);

  // Reset fetch refs when userId changes
  useEffect(() => {
    initialFetchDoneRef.current = false;
    albumsFetchedRef.current = false;
  }, [userId]);

  // Fetch other user data and friendship status on mount (only once, not on every focus)
  // This preserves scroll position when navigating back from album views
  useFocusEffect(
    useCallback(() => {
      if (!isOwnProfile && !initialFetchDoneRef.current) {
        initialFetchDoneRef.current = true;
        fetchOtherUserProfile();
        fetchFriendshipStatus();
      }
    }, [isOwnProfile, fetchOtherUserProfile, fetchFriendshipStatus])
  );

  // Refresh friend count on every focus (reflects add/remove friend changes)
  useFocusEffect(
    useCallback(() => {
      fetchFriendCount();
    }, [fetchFriendCount])
  );

  // Fetch albums function (reusable for refresh after operations)
  const fetchAlbums = async () => {
    // For own profile, always fetch albums
    // For other profiles, only fetch if friends
    const targetUserId = isOwnProfile ? user?.id : userId;
    const shouldFetchAlbums = isOwnProfile || isFriend;

    if (!shouldFetchAlbums || !targetUserId) {
      setAlbums([]);
      setCoverPhotoUrls({});
      return;
    }

    const result = await getUserAlbums(targetUserId);
    if (result.success) {
      setAlbums(result.albums);
      logger.info('ProfileScreen: Fetched albums', { count: result.albums.length });

      // Fetch cover photo URLs AND stack photo URLs (up to 2 per album for stack effect)
      const allPhotoIds = new Set();

      result.albums.forEach(album => {
        // Add cover photo
        if (album.coverPhotoId) {
          allPhotoIds.add(album.coverPhotoId);
        }
        // Add up to 2 most recent non-cover photos for stack effect
        if (album.photoIds && album.photoIds.length > 0) {
          const nonCoverPhotos = album.photoIds.filter(id => id !== album.coverPhotoId);
          const stackPhotos = nonCoverPhotos.slice(-2);
          stackPhotos.forEach(id => allPhotoIds.add(id));
        }
      });

      if (allPhotoIds.size > 0) {
        const photosResult = await getPhotosByIds([...allPhotoIds]);
        if (photosResult.success) {
          const urlMap = {};
          photosResult.photos.forEach(photo => {
            urlMap[photo.id] = photo.imageURL;
          });
          setCoverPhotoUrls(urlMap);
          logger.info('ProfileScreen: Fetched album photo URLs', {
            count: Object.keys(urlMap).length,
          });
        }
      }
    } else {
      logger.error('ProfileScreen: Failed to fetch albums', { error: result.error });
      setAlbums([]);
      setCoverPhotoUrls({});
    }
  };

  // Fetch albums when screen gains focus (refreshes after editing albums)
  // For own profile: re-fetch on every focus to reflect edits
  // For other profiles: only fetch once when friendship status confirms friend access
  useFocusEffect(
    useCallback(() => {
      if (isOwnProfile) {
        // Own profile: always refresh to reflect any album edits
        fetchAlbums();
      } else if (friendshipStatusLoaded && isFriend && !albumsFetchedRef.current) {
        // Other profile: only fetch once when confirmed as friends
        // Guard on isFriend prevents fetching with empty results if friendshipStatus
        // hasn't resolved to 'friends' yet (race condition with block checks)
        albumsFetchedRef.current = true;
        fetchAlbums();
      }
    }, [isOwnProfile, isFriend, user?.id, userId, friendshipStatusLoaded])
  );

  // Run new album animation sequence
  const runNewAlbumAnimation = useCallback(
    albumId => {
      // Wait for FlatList to render, then animate
      // Timing: scroll (0ms), wait for render (300ms), highlight (300-500ms)

      // Step 1: Scroll main ScrollView to show albums bar
      scrollViewRef.current?.scrollTo({ y: 450, animated: true });

      // Step 2: Scroll the album FlatList to the new album
      albumBarRef.current?.scrollToAlbum(albumId);

      // Step 3: Wait 300ms for card to render, then trigger bounce
      setTimeout(() => {
        setHighlightedAlbumId(albumId);
      }, 300);

      // Step 4: After 800ms total, clear the highlight
      setTimeout(() => {
        setHighlightedAlbumId(null);
      }, 800);
    },
    [scrollViewRef, albumBarRef]
  );

  // Detect newAlbumId from route params and trigger animation
  useEffect(() => {
    const { newAlbumId } = (route.params || {}) as any;
    if (newAlbumId && albums.length > 0) {
      // Clear param to prevent re-trigger on future focus
      navigation.setParams({ newAlbumId: undefined } as any);
      // Run animation sequence
      runNewAlbumAnimation(newAlbumId);
    }
  }, [route.params, albums, navigation, runNewAlbumAnimation]);

  // Callback for SongSearchScreen — receives selected song via goBack()
  const handleSongSelect = useCallback(song => {
    handleSaveSong(song);
  }, []);

  // Scroll to top when profile tab icon is pressed while already on profile
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isOwnProfile) return; // Only for own profile (tab navigation)

    // Get the parent tab navigator
    const tabNavigator = navigation.getParent();
    if (!tabNavigator) return;

    const unsubscribe = (tabNavigator as any).addListener('tabPress', (e: any) => {
      // Only scroll to top if we're already focused on the profile tab
      if (isFocused) {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
    });

    return unsubscribe;
  }, [navigation, isFocused, isOwnProfile]);

  // Resolve profile data based on own vs other user
  const profileData = isOwnProfile ? userProfile : otherUserProfile;

  // Friend count: own profile uses live query, other profiles use denormalized field
  const displayFriendCount = isOwnProfile ? friendCount : profileData?.friend_count || 0;

  // Mark screen trace as loaded after profile data is ready (once only)
  useEffect(() => {
    if (screenTraceMarkedRef.current) return;
    const dataReady = isOwnProfile ? !!userProfile : !otherUserLoading && !!otherUserProfile;
    if (dataReady) {
      screenTraceMarkedRef.current = true;
      markLoaded();
    }
  }, [isOwnProfile, userProfile, otherUserLoading, otherUserProfile]);

  const handleBackPress = () => {
    logger.info('ProfileScreen: Back button pressed');
    navigation.goBack();
  };

  const handleFriendsPress = () => {
    logger.info('ProfileScreen: Friends button pressed');
    navigation.navigate('FriendsList' as any);
  };

  const handleSettingsPress = () => {
    logger.info('ProfileScreen: Settings button pressed');
    navigation.navigate('Settings' as any);
  };

  // Friendship action handlers
  const handleAddFriend = async () => {
    if (!user?.id || !userId) return;

    setFriendshipLoading(true);
    try {
      const result = await sendFriendRequest(user.id, userId);
      setFriendshipStatus('pending_sent');
      setFriendshipId(result.id);
      logger.info('ProfileScreen: Friend request sent', { userId });
    } catch (error) {
      logger.error('ProfileScreen: Error sending friend request', { error: (error as Error).message });
      Alert.alert('Error', 'Could not send friend request');
    } finally {
      setFriendshipLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!friendshipId || !user?.id) return;

    setFriendshipLoading(true);
    try {
      await declineFriendRequest(friendshipId);
      setFriendshipStatus('none');
      setFriendshipId(null);
      logger.info('ProfileScreen: Friend request cancelled', { userId });
    } catch (error) {
      logger.error('ProfileScreen: Error cancelling request', { error: (error as Error).message });
      Alert.alert('Error', 'Could not cancel request');
    } finally {
      setFriendshipLoading(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!friendshipId || !user?.id) return;

    setFriendshipLoading(true);
    try {
      await acceptFriendRequest(friendshipId);
      setFriendshipStatus('friends');
      logger.info('ProfileScreen: Friend request accepted', { userId });
      // Refresh albums now that we're friends
      fetchAlbums();
    } catch (error) {
      logger.error('ProfileScreen: Error accepting request', { error: (error as Error).message });
      Alert.alert('Error', 'Could not accept request');
    } finally {
      setFriendshipLoading(false);
    }
  };

  // Profile menu handlers (for other user profiles)
  const handleProfileMenuPress = () => {
    profileMenuButtonRef.current?.measureInWindow((x, y, width, height) => {
      setProfileMenuAnchor({ x, y, width, height });
      setProfileMenuVisible(true);
    });
  };

  const handleRemoveFriendFromProfile = () => {
    Alert.alert(
      'Remove Friend',
      `Remove ${profileData?.displayName || profileData?.username} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!friendshipId) return;
              await removeFriend(friendshipId);
              setFriendshipStatus('none');
              setFriendshipId(null);
              logger.info('ProfileScreen: Friend removed', { userId });
            } catch (error) {
              logger.error('ProfileScreen: Error removing friend', { error: (error as Error).message });
              Alert.alert('Error', 'Could not remove friend');
            }
          },
        },
      ]
    );
  };

  const handleBlockUserFromProfile = () => {
    Alert.alert(
      'Block User',
      `Block ${profileData?.display_name || profileData?.username}? They won't be able to see your profile or contact you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await blockUser(user!.id, userId) as any;
              if (result.success) {
                logger.info('ProfileScreen: User blocked, navigating back', { userId });
                navigation.goBack();
              } else {
                Alert.alert('Error', result.error || 'Could not block user');
              }
            } catch (error) {
              logger.error('ProfileScreen: Error blocking user', { error: (error as Error).message });
              Alert.alert('Error', 'Could not block user');
            }
          },
        },
      ]
    );
  };

  const handleUnblockUser = () => {
    Alert.alert('Unblock User', `Unblock ${otherUserProfile?.display_name || routeUsername}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          try {
            const result = await unblockUser(user!.id, userId) as any;
            if (result.success) {
              setIsBlockedByMe(false);
              // Re-fetch friendship status (may have been friends before block)
              fetchFriendshipStatus();
              logger.info('ProfileScreen: User unblocked', { userId });
            } else {
              Alert.alert('Error', result.error || 'Could not unblock user');
            }
          } catch (error) {
            logger.error('ProfileScreen: Error unblocking user', { error: (error as Error).message });
            Alert.alert('Error', 'Could not unblock user');
          }
        },
      },
    ]);
  };

  const handleReportUserFromProfile = () => {
    (navigation as any).navigate('ReportUser', {
      userId,
      username: profileData?.username,
      displayName: profileData?.display_name,
      profilePhotoURL: profileData?.photo_url,
    });
  };

  const getProfileMenuOptions = () => {
    const options: { label: string; icon: string; onPress: () => void; destructive?: boolean }[] = [];

    // Show Unblock option if I've blocked this user
    if (isBlockedByMe) {
      options.push({
        label: 'Unblock User',
        icon: 'checkmark-circle-outline',
        onPress: handleUnblockUser,
      });
    }

    // Only show Remove Friend if they are friends and not blocked
    if (friendshipStatus === 'friends' && !isBlockedByMe) {
      options.push({
        label: 'Remove Friend',
        icon: 'person-remove-outline',
        onPress: handleRemoveFriendFromProfile,
      });
    }

    // Block option only if not already blocked
    if (!isBlockedByMe) {
      options.push({
        label: 'Block User',
        icon: 'ban-outline',
        onPress: handleBlockUserFromProfile,
      });
    }

    // Report always available
    options.push({
      label: 'Report User',
      icon: 'flag-outline',
      onPress: handleReportUserFromProfile,
      destructive: true,
    });

    return options;
  };

  const handleSelectsTap = () => {
    logger.info('ProfileScreen: SelectsBanner tapped', { isOwnProfile });
    if (isOwnProfile) {
      // Own profile: open edit overlay
      setShowEditOverlay(true);
    } else {
      // Other profile: open fullscreen viewer (only if they have selects)
      if (profileData?.selects && profileData.selects.length > 0) {
        setShowFullscreen(true);
      }
    }
  };

  // Handle saving selects from edit overlay
  const handleSaveSelects = async newSelects => {
    logger.info('ProfileScreen: Saving selects', { count: newSelects.length });
    try {
      // Upload local images to Firebase Storage first
      let remoteUrls = newSelects;
      if (newSelects.length > 0) {
        const uploadResult = await uploadSelectsPhotos(user!.id, newSelects);
        if (!uploadResult.success) {
          Alert.alert('Upload Failed', 'Could not upload your highlights. Please try again.');
          return;
        }
        remoteUrls = uploadResult.photoURLs || newSelects;
      }

      const result = await updateUserDocumentNative(user!.id, { selects: remoteUrls } as any);
      if (result.success) {
        // Update local profile state
        updateUserProfile({
          ...userProfile!,
          selects: remoteUrls,
        } as any);
        logger.info('ProfileScreen: Selects saved successfully');
        setShowEditOverlay(false);
      } else {
        Alert.alert('Error', 'Could not save your highlights. Please try again.');
      }
    } catch (error) {
      logger.error('ProfileScreen: Failed to save selects', { error: (error as Error).message });
      Alert.alert('Error', (error as Error).message || 'An error occurred');
    }
  };

  // Handle song card press (add song when empty)
  const handleSongPress = () => {
    if (!(profileData as any)?.profileSong) {
      logger.info('ProfileScreen: Add song pressed');
      (navigation as any).navigate('SongSearch', {
        source: 'ProfileMain',
        onSongSelect: handleSongSelect,
      });
    }
    // Play/pause handled internally by ProfileSongCard
  };

  // Handle song card long press (edit menu)
  const handleSongLongPress = () => {
    if (!(profileData as any)?.profileSong) return;

    logger.info('ProfileScreen: Song long press, showing menu');
    Alert.alert((profileData as any).profileSong.title, (profileData as any).profileSong.artist, [
      {
        text: 'Edit Song',
        onPress: () => {
          // Opens clip selection first, cancel goes to search for different song
          (navigation as any).navigate('SongSearch', {
            source: 'ProfileMain',
            editSong: (profileData as any).profileSong,
            onSongSelect: handleSongSelect,
          });
        },
      },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: handleRemoveSong,
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  };

  // Remove song from profile
  const handleRemoveSong = async () => {
    logger.info('ProfileScreen: Removing profile song');
    try {
      const result = await updateUserDocumentNative(user!.id, { profileSong: null } as any);
      if (result.success) {
        updateUserProfile({ ...userProfile!, profileSong: null } as any);
        logger.info('ProfileScreen: Profile song removed');
      } else {
        Alert.alert('Error', 'Could not remove song. Please try again.');
      }
    } catch (error) {
      logger.error('ProfileScreen: Failed to remove song', { error: (error as Error).message });
      Alert.alert('Error', (error as Error).message || 'An error occurred');
    }
  };

  // Save song to Firestore and update local state
  const handleSaveSong = async songData => {
    try {
      const result = await updateUserDocumentNative(user!.id, { profileSong: songData } as any);
      if (result.success) {
        updateUserProfile({ ...userProfile!, profileSong: songData } as any);
        logger.info('ProfileScreen: Profile song saved');
      } else {
        Alert.alert('Error', 'Could not save song. Please try again.');
      }
    } catch (error) {
      logger.error('ProfileScreen: Failed to save song', { error: (error as Error).message });
      Alert.alert('Error', (error as Error).message || 'An error occurred');
    }
  };

  // Album handlers
  const handleAlbumPress = album => {
    logger.info('ProfileScreen: Album pressed', { albumId: album.id, name: album.name });
    (navigation as any).navigate('AlbumGrid', {
      albumId: album.id,
      title: album.name || album.title || '',
    });
  };

  // Confirm and delete album
  const confirmDeleteAlbum = album => {
    Alert.alert('Delete Album?', 'Photos will remain in your library.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          logger.info('ProfileScreen: Deleting album', { albumId: album.id });
          const result = await deleteAlbum(album.id);
          if (result.success) {
            logger.info('ProfileScreen: Album deleted successfully');
            fetchAlbums(); // Refresh albums list
          } else {
            Alert.alert('Error', result.error || 'Could not delete album');
          }
        },
      },
    ]);
  };

  const handleAlbumLongPress = (album, event) => {
    logger.info('ProfileScreen: Album long press', { albumId: album.id, name: album.name });
    setSelectedAlbum(album);

    // Capture touch position for anchored menu
    if (event?.nativeEvent) {
      const { pageX, pageY } = event.nativeEvent;
      setAlbumMenuAnchor({ x: pageX, y: pageY, width: 0, height: 0 });
    }
    setAlbumMenuVisible(true);
  };

  // Album menu options
  const albumMenuOptions = selectedAlbum
    ? [
        {
          label: 'Edit Album',
          icon: 'pencil-outline',
          onPress: () =>
            (navigation as any).navigate('AlbumGrid', {
              albumId: selectedAlbum.id,
              title: selectedAlbum.name || selectedAlbum.title || '',
            }),
        },
        {
          label: 'Delete Album',
          icon: 'trash-outline',
          onPress: () => confirmDeleteAlbum(selectedAlbum),
          destructive: true,
        },
      ]
    : [];

  const handleAddAlbumPress = () => {
    logger.info('ProfileScreen: Add album pressed');
    navigation.navigate('CreateAlbum' as any);
  };

  // Handle monthly album month press
  const handleMonthPress = month => {
    logger.info('ProfileScreen: Monthly album pressed', { month });
    (navigation as any).navigate('MonthlyAlbumGrid', {
      month,
      year: parseInt(month?.split('-')?.[0] || '2026'),
    });
  };

  // Handle loading state for own profile
  if (isOwnProfile && !userProfile) {
    return (
      <View style={styles.container}>
        <ProfilePhotoGridSkeleton />
      </View>
    );
  }

  // Handle loading state for other user's profile
  if (!isOwnProfile && otherUserLoading) {
    return (
      <View style={styles.container}>
        <ProfilePhotoGridSkeleton />
      </View>
    );
  }

  // Handle error state for other user's profile
  if (!isOwnProfile && otherUserError) {
    return (
      <View style={styles.container}>
        <View
          style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 8 : 0) }]}
        >
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <PixelIcon name="chevron-back" size={28} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={[styles.loadingContainer, { paddingTop: insets.top + HEADER_HEIGHT }]}>
          <Text style={styles.loadingText}>{otherUserError}</Text>
        </View>
      </View>
    );
  }

  // Handle blocked state - show "User not found" if they blocked me
  if (!isOwnProfile && hasBlockedMe) {
    return (
      <View style={styles.container}>
        <View
          style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 8 : 0) }]}
        >
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <PixelIcon name="chevron-back" size={28} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={[styles.loadingContainer, { paddingTop: insets.top + HEADER_HEIGHT }]}>
          <Text style={styles.loadingText}>User not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header - 3 column layout with safe area coverage */}
      <View
        style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'android' ? 8 : 0) }]}
      >
        {/* Left: Friends icon (own) or Back arrow (other user) */}
        {isOwnProfile ? (
          <TouchableOpacity onPress={handleFriendsPress} style={styles.headerButton}>
            <PixelIcon name="people-outline" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <PixelIcon name="chevron-back" size={28} color={colors.text.primary} />
          </TouchableOpacity>
        )}

        {/* Center: Username */}
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isOwnProfile ? userProfile?.username || 'Profile' : routeUsername || 'Profile'}
        </Text>

        {/* Right: Settings icon (own) or three-dot menu (other user) */}
        {isOwnProfile ? (
          <TouchableOpacity onPress={handleSettingsPress} style={styles.headerButton}>
            <PixelIcon name="settings-outline" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            ref={profileMenuButtonRef}
            onPress={handleProfileMenuPress}
            style={styles.headerButton}
          >
            <PixelIcon name="ellipsis-vertical" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Scrollable Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Selects Banner */}
        <View
          style={[
            styles.selectsBannerContainer,
            { marginTop: insets.top + HEADER_HEIGHT + (Platform.OS === 'android' ? 8 : 0) + 16 },
          ]}
        >
          <SelectsBanner
            selects={profileData?.selects || []}
            isOwnProfile={isOwnProfile}
            onTap={handleSelectsTap}
          />
        </View>

        {/* 2. Profile Section - Photo overlaps onto Selects, info cards below */}
        <View style={styles.profileSection}>
          {/* Profile Photo (absolutely positioned, overlapping Selects) */}
          <View style={styles.profilePhotoContainer}>
            {profileData?.photoURL ? (
              <Image
                source={{
                  uri: profileData.photoURL,
                  cacheKey: profileCacheKey(
                    `profile-${isOwnProfile ? user?.id : userId}`,
                    profileData?.photoURL
                  ),
                }}
                style={styles.profilePhoto}
                contentFit="cover"
                cachePolicy="memory-disk"
                priority="high"
              />
            ) : (
              <View style={[styles.profilePhoto, styles.profilePhotoPlaceholder]}>
                <PixelIcon name="person" size={60} color={colors.text.secondary} />
              </View>
            )}
          </View>

          {/* Profile Info Card */}
          <View style={styles.profileInfoCard}>
            <StrokedNameText style={styles.displayName} nameColor={profileData?.nameColor}>
              {profileData?.displayName || 'New User'}
            </StrokedNameText>
            <Text style={styles.username}>@{profileData?.username || 'username'}</Text>
            <Text style={[styles.bio, !profileData?.bio && styles.bioPlaceholder]}>
              {profileData?.bio || 'No bio yet'}
            </Text>

            {/* Friend Count Scoreboard */}
            <View style={styles.friendCounter}>
              <Text style={styles.friendCounterLabel}>FRIENDS</Text>
              <Text style={styles.friendCounterValue}>
                {String(Math.min(displayFriendCount, 999)).padStart(3, '0')}
              </Text>
            </View>
          </View>
        </View>

        {/* 4. Profile Song - hide empty state for other users */}
        {(isOwnProfile || profileData?.profileSong) && (
          <View style={styles.songContainer}>
            <ProfileSongCard
              song={profileData?.profileSong || null}
              isOwnProfile={isOwnProfile}
              onPress={handleSongPress}
              onLongPress={handleSongLongPress}
            />
          </View>
        )}

        {/* 5. Albums Section - Friends only for other profiles */}
        {!isOwnProfile && !isFriend ? (
          <View style={styles.addFriendSection}>
            <TouchableOpacity
              style={[
                styles.addFriendButton,
                (friendshipStatus === 'pending_sent' || friendshipLoading) &&
                  styles.addFriendButtonDisabled,
              ]}
              onPress={
                friendshipStatus === 'pending_received' ? handleAcceptRequest : handleAddFriend
              }
              disabled={friendshipStatus === 'pending_sent' || friendshipLoading}
            >
              <PixelIcon
                name={
                  friendshipStatus === 'pending_received'
                    ? 'checkmark-outline'
                    : 'person-add-outline'
                }
                size={24}
                color={colors.text.primary}
              />
              <Text style={styles.addFriendText}>
                {friendshipStatus === 'pending_sent'
                  ? 'Request Sent'
                  : friendshipStatus === 'pending_received'
                    ? 'Accept Request'
                    : 'Add Friend'}
              </Text>
            </TouchableOpacity>
            {friendshipStatus === 'pending_sent' && (
              <TouchableOpacity
                onPress={handleCancelRequest}
                disabled={friendshipLoading}
                style={styles.cancelRequestButton}
              >
                <Text style={styles.cancelText}>Cancel Request</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {/* Albums Bar */}
            {React.createElement(AlbumBar as any, {
              ref: albumBarRef,
              albums,
              photoUrls: coverPhotoUrls,
              isOwnProfile,
              onAlbumPress: handleAlbumPress,
              highlightedAlbumId,
              onAlbumLongPress: isOwnProfile ? handleAlbumLongPress : undefined,
              onAddPress: handleAddAlbumPress,
            })}

            {/* 6. Monthly Albums - Visible for own profile and friends */}
            <MonthlyAlbumsSection
              userId={isOwnProfile ? user?.id : userId}
              onMonthPress={handleMonthPress}
            />
          </>
        )}
      </ScrollView>

      {/* Fullscreen viewer for other users' selects */}
      <FullscreenSelectsViewer
        visible={showFullscreen}
        selects={profileData?.selects || []}
        initialIndex={0}
        onClose={() => setShowFullscreen(false)}
      />

      {/* Edit overlay for own profile selects */}
      {React.createElement(SelectsEditOverlay as any, {
        visible: showEditOverlay,
        selects: userProfile?.selects || [],
        onSave: handleSaveSelects,
        onClose: () => setShowEditOverlay(false),
      })}

      {/* Album long-press dropdown menu */}
      <DropdownMenu
        visible={albumMenuVisible}
        onClose={() => setAlbumMenuVisible(false)}
        options={albumMenuOptions}
        anchorPosition={albumMenuAnchor}
      />

      {/* Profile menu for other users (Remove, Block, Report) */}
      {!isOwnProfile && (
        <DropdownMenu
          visible={profileMenuVisible}
          onClose={() => setProfileMenuVisible(false)}
          options={getProfileMenuOptions()}
          anchorPosition={profileMenuAnchor}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.readable,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    minHeight: HEADER_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: Platform.OS === 'android' ? 6 : spacing.sm,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    textAlign: 'center',
    ...Platform.select({ android: { includeFontPadding: false, lineHeight: 22 } }),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120, // Tab bar clearance
  },
  // Selects Banner Container
  selectsBannerContainer: {
    marginHorizontal: spacing.md,
  },
  // Profile Section
  profileSection: {
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    flexDirection: 'row',
  },
  profilePhotoContainer: {
    position: 'absolute',
    left: '50%',
    marginLeft: -PROFILE_PHOTO_SIZE / 2,
    top: -PROFILE_PHOTO_SIZE / 2 - 8, // Slight overlap onto Selects banner
    zIndex: 5,
  },
  profilePhoto: {
    width: PROFILE_PHOTO_SIZE,
    height: PROFILE_PHOTO_SIZE,
    borderRadius: PROFILE_PHOTO_SIZE / 2,
    borderWidth: 3,
    borderColor: colors.background.primary,
  },
  profilePhotoPlaceholder: {
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Profile Info Card - full width
  profileInfoCard: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderRadius: layout.borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    paddingTop: 70, // Space for profile photo overlay
  },
  displayName: {
    fontSize: typography.size.xxl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    paddingRight: '35%', // Stop text before friend counter
    ...Platform.select({ android: { includeFontPadding: false, lineHeight: 32 } }),
  },
  username: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  bio: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  bioPlaceholder: {
    fontStyle: 'italic',
  },
  // Friend Counter Scoreboard - absolutely positioned in right portion of card
  friendCounter: {
    position: 'absolute',
    top: 52,
    right: '10%',
    alignItems: 'center',
  },
  friendCounterLabel: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xxs,
  },
  friendCounterValue: {
    fontSize: typography.size.xxl,
    fontFamily: typography.fontFamily.display,
    color: colors.brand.purple,
    textAlign: 'center',
    letterSpacing: 3,
    ...Platform.select({ android: { includeFontPadding: false, lineHeight: 32 } }),
  },
  // Profile Song
  songContainer: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  // Add Friend Section (for non-friends)
  addFriendSection: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  addFriendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.purple,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: layout.borderRadius.md,
    width: '100%',
    gap: spacing.xs,
  },
  addFriendButtonDisabled: {
    opacity: 0.6,
  },
  addFriendText: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.bodyBold,
  },
  cancelRequestButton: {
    marginTop: spacing.sm,
    padding: spacing.xs,
  },
  cancelText: {
    color: colors.text.secondary,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
  },
});

export default ProfileScreen;
