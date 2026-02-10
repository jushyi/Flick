import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, useIsFocused } from '@react-navigation/native';
import PixelIcon from '../components/PixelIcon';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
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
  getUserAlbums,
  getPhotosByIds,
  deleteAlbum,
  getUserProfile,
  checkFriendshipStatus,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  generateFriendshipId,
  removeFriend,
  blockUser,
  unblockUser,
  isBlocked,
} from '../services/firebase';
import { typography } from '../constants/typography';
import logger from '../utils/logger';

const HEADER_HEIGHT = 64;
const PROFILE_PHOTO_SIZE = 120;

const ProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, userProfile, updateUserProfile, updateUserDocumentNative } = useAuth();
  const insets = useSafeAreaInsets();

  // Modal states
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showEditOverlay, setShowEditOverlay] = useState(false);

  // Albums state
  const [albums, setAlbums] = useState([]);
  const [coverPhotoUrls, setCoverPhotoUrls] = useState({});

  // Album menu state
  const [albumMenuVisible, setAlbumMenuVisible] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [albumMenuAnchor, setAlbumMenuAnchor] = useState(null);

  // New album animation state
  const [highlightedAlbumId, setHighlightedAlbumId] = useState(null);
  const scrollViewRef = useRef(null);
  const albumBarRef = useRef(null);

  // Profile menu state (for other user profiles)
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState(null);
  const profileMenuButtonRef = useRef(null);

  // Other user profile state (when viewing someone else's profile)
  const [otherUserProfile, setOtherUserProfile] = useState(null);
  const [otherUserLoading, setOtherUserLoading] = useState(false);
  const [otherUserError, setOtherUserError] = useState(null);

  // Friendship state
  const [friendshipStatus, setFriendshipStatus] = useState('none'); // 'none' | 'friends' | 'pending_sent' | 'pending_received'
  const [friendshipId, setFriendshipId] = useState(null);
  const [friendshipLoading, setFriendshipLoading] = useState(false);
  const [friendshipStatusLoaded, setFriendshipStatusLoaded] = useState(false);

  // Block status state
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [hasBlockedMe, setHasBlockedMe] = useState(false);

  // Track if initial data fetch is done (to avoid re-fetching on focus for other user profiles)
  const initialFetchDoneRef = useRef(false);
  const albumsFetchedRef = useRef(false);

  // Get route params for viewing other users' profiles
  const { userId, username: routeUsername } = route.params || {};

  // Determine if viewing own profile vs another user's profile
  const isOwnProfile = !userId || userId === user?.uid;

  // Fetch other user's profile data
  const fetchOtherUserProfile = useCallback(async () => {
    if (isOwnProfile || !userId) return;

    setOtherUserLoading(true);
    setOtherUserError(null);

    try {
      const result = await getUserProfile(userId);
      if (result.success) {
        setOtherUserProfile(result.profile);
        logger.info('ProfileScreen: Fetched other user profile', { userId });
      } else {
        setOtherUserError(result.error || 'Failed to load profile');
        logger.error('ProfileScreen: Failed to fetch other user profile', { error: result.error });
      }
    } catch (error) {
      setOtherUserError(error.message);
      logger.error('ProfileScreen: Error fetching other user profile', { error: error.message });
    } finally {
      setOtherUserLoading(false);
    }
  }, [isOwnProfile, userId]);

  // Fetch friendship and block status between current user and profile user
  const fetchFriendshipStatus = useCallback(async () => {
    if (isOwnProfile || !userId || !user?.uid) {
      setFriendshipStatusLoaded(true); // Mark as loaded for own profile
      return;
    }

    try {
      // Check friendship status
      const result = await checkFriendshipStatus(user.uid, userId);
      if (result.success) {
        setFriendshipStatus(result.status);
        setFriendshipId(result.friendshipId);
        logger.info('ProfileScreen: Fetched friendship status', { status: result.status });
      }

      // Check if I blocked this user
      const blockedByMeResult = await isBlocked(user.uid, userId);
      setIsBlockedByMe(blockedByMeResult.success && blockedByMeResult.isBlocked);

      // Check if this user blocked me
      const blockedMeResult = await isBlocked(userId, user.uid);
      setHasBlockedMe(blockedMeResult.success && blockedMeResult.isBlocked);

      logger.info('ProfileScreen: Fetched block status', {
        isBlockedByMe: blockedByMeResult.success && blockedByMeResult.isBlocked,
        hasBlockedMe: blockedMeResult.success && blockedMeResult.isBlocked,
      });
    } catch (error) {
      logger.error('ProfileScreen: Error fetching friendship/block status', {
        error: error.message,
      });
    } finally {
      setFriendshipStatusLoaded(true); // Mark as loaded even on error
    }
  }, [isOwnProfile, userId, user?.uid]);

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

  // Fetch albums function (reusable for refresh after operations)
  const fetchAlbums = async () => {
    // For own profile, always fetch albums
    // For other profiles, only fetch if friends
    const targetUserId = isOwnProfile ? user?.uid : userId;
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
  // For other profiles: only fetch once when friendship status is determined (read-only, preserve scroll)
  useFocusEffect(
    useCallback(() => {
      if (isOwnProfile) {
        // Own profile: always refresh to reflect any album edits
        fetchAlbums();
      } else if (friendshipStatusLoaded && !albumsFetchedRef.current) {
        // Other profile: only fetch once when friendship is determined
        albumsFetchedRef.current = true;
        fetchAlbums();
      }
    }, [isOwnProfile, user?.uid, userId, friendshipStatus, friendshipStatusLoaded])
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
    const { newAlbumId } = route.params || {};
    if (newAlbumId && albums.length > 0) {
      // Clear param to prevent re-trigger on future focus
      navigation.setParams({ newAlbumId: undefined });
      // Run animation sequence
      runNewAlbumAnimation(newAlbumId);
    }
  }, [route.params, albums, navigation, runNewAlbumAnimation]);

  // Detect selectedSong from route params (passed back from SongSearchScreen)
  useEffect(() => {
    const { selectedSong } = route.params || {};
    if (selectedSong) {
      navigation.setParams({ selectedSong: undefined });
      handleSaveSong(selectedSong);
    }
  }, [route.params, navigation]);

  // Scroll to top when profile tab icon is pressed while already on profile
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isOwnProfile) return; // Only for own profile (tab navigation)

    // Get the parent tab navigator
    const tabNavigator = navigation.getParent();
    if (!tabNavigator) return;

    const unsubscribe = tabNavigator.addListener('tabPress', e => {
      // Only scroll to top if we're already focused on the profile tab
      if (isFocused) {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
    });

    return unsubscribe;
  }, [navigation, isFocused, isOwnProfile]);

  // Resolve profile data based on own vs other user
  const profileData = isOwnProfile ? userProfile : otherUserProfile;
  const isFriend = friendshipStatus === 'friends';

  const handleBackPress = () => {
    logger.info('ProfileScreen: Back button pressed');
    navigation.goBack();
  };

  const handleFriendsPress = () => {
    logger.info('ProfileScreen: Friends button pressed');
    navigation.navigate('FriendsList');
  };

  const handleSettingsPress = () => {
    logger.info('ProfileScreen: Settings button pressed');
    navigation.navigate('Settings');
  };

  // Friendship action handlers
  const handleAddFriend = async () => {
    if (!user?.uid || !userId) return;

    setFriendshipLoading(true);
    try {
      const result = await sendFriendRequest(user.uid, userId);
      if (result.success) {
        setFriendshipStatus('pending_sent');
        setFriendshipId(result.friendshipId);
        logger.info('ProfileScreen: Friend request sent', { userId });
      } else {
        Alert.alert('Error', result.error || 'Could not send friend request');
      }
    } catch (error) {
      logger.error('ProfileScreen: Error sending friend request', { error: error.message });
      Alert.alert('Error', 'Could not send friend request');
    } finally {
      setFriendshipLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!friendshipId || !user?.uid) return;

    setFriendshipLoading(true);
    try {
      const result = await declineFriendRequest(friendshipId, user.uid);
      if (result.success) {
        setFriendshipStatus('none');
        setFriendshipId(generateFriendshipId(user.uid, userId));
        logger.info('ProfileScreen: Friend request cancelled', { userId });
      } else {
        Alert.alert('Error', result.error || 'Could not cancel request');
      }
    } catch (error) {
      logger.error('ProfileScreen: Error cancelling request', { error: error.message });
      Alert.alert('Error', 'Could not cancel request');
    } finally {
      setFriendshipLoading(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!friendshipId || !user?.uid) return;

    setFriendshipLoading(true);
    try {
      const result = await acceptFriendRequest(friendshipId, user.uid);
      if (result.success) {
        setFriendshipStatus('friends');
        logger.info('ProfileScreen: Friend request accepted', { userId });
        // Refresh albums now that we're friends
        fetchAlbums();
      } else {
        Alert.alert('Error', result.error || 'Could not accept request');
      }
    } catch (error) {
      logger.error('ProfileScreen: Error accepting request', { error: error.message });
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
              const result = await removeFriend(user.uid, userId);
              if (result.success) {
                setFriendshipStatus('none');
                setFriendshipId(generateFriendshipId(user.uid, userId));
                logger.info('ProfileScreen: Friend removed', { userId });
              } else {
                Alert.alert('Error', result.error || 'Could not remove friend');
              }
            } catch (error) {
              logger.error('ProfileScreen: Error removing friend', { error: error.message });
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
      `Block ${profileData?.displayName || profileData?.username}? They won't be able to see your profile or contact you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await blockUser(user.uid, userId);
              if (result.success) {
                logger.info('ProfileScreen: User blocked, navigating back', { userId });
                navigation.goBack();
              } else {
                Alert.alert('Error', result.error || 'Could not block user');
              }
            } catch (error) {
              logger.error('ProfileScreen: Error blocking user', { error: error.message });
              Alert.alert('Error', 'Could not block user');
            }
          },
        },
      ]
    );
  };

  const handleUnblockUser = () => {
    Alert.alert('Unblock User', `Unblock ${otherUserProfile?.displayName || routeUsername}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          try {
            const result = await unblockUser(user.uid, userId);
            if (result.success) {
              setIsBlockedByMe(false);
              // Re-fetch friendship status (may have been friends before block)
              fetchFriendshipStatus();
              logger.info('ProfileScreen: User unblocked', { userId });
            } else {
              Alert.alert('Error', result.error || 'Could not unblock user');
            }
          } catch (error) {
            logger.error('ProfileScreen: Error unblocking user', { error: error.message });
            Alert.alert('Error', 'Could not unblock user');
          }
        },
      },
    ]);
  };

  const handleReportUserFromProfile = () => {
    navigation.navigate('ReportUser', {
      userId,
      username: profileData?.username,
      displayName: profileData?.displayName,
      profilePhotoURL: profileData?.photoURL,
    });
  };

  const getProfileMenuOptions = () => {
    const options = [];

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
      if (profileData?.selects?.length > 0) {
        setShowFullscreen(true);
      }
    }
  };

  // Handle saving selects from edit overlay
  const handleSaveSelects = async newSelects => {
    logger.info('ProfileScreen: Saving selects', { count: newSelects.length });
    try {
      const result = await updateUserDocumentNative(user.uid, { selects: newSelects });
      if (result.success) {
        // Update local profile state
        updateUserProfile({
          ...userProfile,
          selects: newSelects,
        });
        logger.info('ProfileScreen: Selects saved successfully');
        setShowEditOverlay(false);
      } else {
        Alert.alert('Error', 'Could not save your highlights. Please try again.');
      }
    } catch (error) {
      logger.error('ProfileScreen: Failed to save selects', { error: error.message });
      Alert.alert('Error', error.message || 'An error occurred');
    }
  };

  // Handle song card press (add song when empty)
  const handleSongPress = () => {
    if (!profileData?.profileSong) {
      logger.info('ProfileScreen: Add song pressed');
      navigation.navigate('SongSearch', {
        source: 'ProfileMain',
      });
    }
    // Play/pause handled internally by ProfileSongCard
  };

  // Handle song card long press (edit menu)
  const handleSongLongPress = () => {
    if (!profileData?.profileSong) return;

    logger.info('ProfileScreen: Song long press, showing menu');
    Alert.alert(profileData.profileSong.title, profileData.profileSong.artist, [
      {
        text: 'Edit Song',
        onPress: () => {
          // Opens clip selection first, cancel goes to search for different song
          navigation.navigate('SongSearch', {
            source: 'ProfileMain',
            editSong: profileData.profileSong,
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
      const result = await updateUserDocumentNative(user.uid, { profileSong: null });
      if (result.success) {
        updateUserProfile({ ...userProfile, profileSong: null });
        logger.info('ProfileScreen: Profile song removed');
      } else {
        Alert.alert('Error', 'Could not remove song. Please try again.');
      }
    } catch (error) {
      logger.error('ProfileScreen: Failed to remove song', { error: error.message });
      Alert.alert('Error', error.message || 'An error occurred');
    }
  };

  // Save song to Firestore and update local state
  const handleSaveSong = async songData => {
    try {
      const result = await updateUserDocumentNative(user.uid, { profileSong: songData });
      if (result.success) {
        updateUserProfile({ ...userProfile, profileSong: songData });
        logger.info('ProfileScreen: Profile song saved');
      } else {
        Alert.alert('Error', 'Could not save song. Please try again.');
      }
    } catch (error) {
      logger.error('ProfileScreen: Failed to save song', { error: error.message });
      Alert.alert('Error', error.message || 'An error occurred');
    }
  };

  // Album handlers
  const handleAlbumPress = album => {
    logger.info('ProfileScreen: Album pressed', { albumId: album.id, name: album.name });
    navigation.navigate('AlbumGrid', {
      albumId: album.id,
      isOwnProfile: isOwnProfile,
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
            navigation.navigate('AlbumGrid', {
              albumId: selectedAlbum.id,
              isOwnProfile: true,
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
    navigation.navigate('CreateAlbum');
  };

  // Handle monthly album month press
  const handleMonthPress = month => {
    logger.info('ProfileScreen: Monthly album pressed', { month });
    navigation.navigate('MonthlyAlbumGrid', {
      month,
      userId: isOwnProfile ? user?.uid : userId,
    });
  };

  // Handle loading state for own profile
  if (isOwnProfile && !userProfile) {
    return (
      <View style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  // Handle loading state for other user's profile
  if (!isOwnProfile && otherUserLoading) {
    return (
      <View style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  // Handle error state for other user's profile
  if (!isOwnProfile && otherUserError) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
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
        <View style={[styles.header, { paddingTop: insets.top }]}>
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
      <View style={[styles.header, { paddingTop: insets.top }]}>
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
          style={[styles.selectsBannerContainer, { marginTop: insets.top + HEADER_HEIGHT + 16 }]}
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
                  cacheKey: `profile-${isOwnProfile ? user?.uid : userId}`,
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

          {/* Profile Info Card - left half, best friends will go on right */}
          <View style={styles.profileInfoCard}>
            <Text style={styles.displayName}>{profileData?.displayName || 'New User'}</Text>
            <Text style={styles.username}>@{profileData?.username || 'username'}</Text>
            <Text style={[styles.bio, !profileData?.bio && styles.bioPlaceholder]}>
              {profileData?.bio || 'No bio yet'}
            </Text>
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
            <AlbumBar
              ref={albumBarRef}
              albums={albums}
              photoUrls={coverPhotoUrls}
              isOwnProfile={isOwnProfile}
              onAlbumPress={handleAlbumPress}
              highlightedAlbumId={highlightedAlbumId}
              onAlbumLongPress={isOwnProfile ? handleAlbumLongPress : undefined}
              onAddPress={handleAddAlbumPress}
            />

            {/* 6. Monthly Albums - Visible for own profile and friends */}
            <MonthlyAlbumsSection
              userId={isOwnProfile ? user?.uid : userId}
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
      <SelectsEditOverlay
        visible={showEditOverlay}
        selects={userProfile?.selects || []}
        onSave={handleSaveSelects}
        onClose={() => setShowEditOverlay(false)}
      />

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
    fontFamily: typography.fontFamily.body,
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120, // Tab bar clearance
  },
  // Selects Banner Container
  selectsBannerContainer: {
    marginHorizontal: 16,
  },
  // Profile Section
  profileSection: {
    marginTop: 16,
    marginHorizontal: 16,
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
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 70, // Space for profile photo overlay
  },
  displayName: {
    fontSize: typography.size.xxl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
  },
  username: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 4,
  },
  bio: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 8,
  },
  bioPlaceholder: {
    fontStyle: 'italic',
  },
  // Profile Song
  songContainer: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  // Add Friend Section (for non-friends)
  addFriendSection: {
    marginHorizontal: 16,
    marginTop: 24,
    alignItems: 'center',
  },
  addFriendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.purple,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 4,
    width: '100%',
    gap: 8,
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
    marginTop: 12,
    padding: 8,
  },
  cancelText: {
    color: colors.text.secondary,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
  },
});

export default ProfileScreen;
