import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
import {
  SelectsBanner,
  FullscreenSelectsViewer,
  SelectsEditOverlay,
  ProfileSongCard,
  AlbumBar,
  DropdownMenu,
} from '../components';
import { getUserAlbums, getPhotosByIds, deleteAlbum } from '../services/firebase';
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

  // Get route params for viewing other users' profiles
  const { userId, username: routeUsername } = route.params || {};

  // Determine if viewing own profile vs another user's profile
  const isOwnProfile = !userId || userId === user?.uid;

  // Fetch albums function (reusable for refresh after operations)
  const fetchAlbums = async () => {
    if (!isOwnProfile || !user?.uid) {
      // TODO: For other profiles, fetch albums with friendship check
      setAlbums([]);
      setCoverPhotoUrls({});
      return;
    }

    const result = await getUserAlbums(user.uid);
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
  useFocusEffect(
    useCallback(() => {
      fetchAlbums();
    }, [isOwnProfile, user?.uid])
  );

  // Run new album animation sequence
  const runNewAlbumAnimation = useCallback(
    albumId => {
      // Wait for albums to be fetched, then run animation sequence
      // Timing: scroll + highlight immediately, clear at 200ms

      // Step 1: Scroll main ScrollView to show albums bar
      scrollViewRef.current?.scrollTo({ y: 450, animated: true });

      // Step 2: Scroll the album FlatList to the new album
      albumBarRef.current?.scrollToAlbum(albumId);

      // Step 3: Immediately trigger scale bounce
      setHighlightedAlbumId(albumId);

      // Step 4: After 200ms, clear the highlight
      setTimeout(() => {
        setHighlightedAlbumId(null);
      }, 200);
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

  // TODO: Fetch other user's profile data from Firestore
  // For now, use own profile for own view, placeholder for other users
  const profileData = isOwnProfile
    ? userProfile
    : {
        username: routeUsername || 'user',
        displayName: routeUsername || 'User',
        photoURL: null,
        bio: null,
        selects: [], // Placeholder - will be fetched from Firestore
      };

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
        onSongSelected: songWithClip => {
          handleSaveSong(songWithClip);
        },
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
            editSong: profileData.profileSong,
            onSongSelected: songWithClip => {
              handleSaveSong(songWithClip);
            },
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

  // Handle loading state
  if (!userProfile) {
    return (
      <View style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header - 3 column layout */}
      <View style={[styles.header, { top: insets.top }]}>
        {/* Left: Friends icon (own) or Back arrow (other user) */}
        {isOwnProfile ? (
          <TouchableOpacity onPress={handleFriendsPress} style={styles.headerButton}>
            <Ionicons name="people-outline" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        )}

        {/* Center: Username */}
        <Text style={styles.headerTitle}>
          {isOwnProfile ? userProfile?.username || 'Profile' : routeUsername || 'Profile'}
        </Text>

        {/* Right: Settings icon (own) or empty space (other user) */}
        {isOwnProfile ? (
          <TouchableOpacity onPress={handleSettingsPress} style={styles.headerButton}>
            <Ionicons name="settings-outline" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerButton} />
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
              <Image source={{ uri: profileData.photoURL }} style={styles.profilePhoto} />
            ) : (
              <View style={[styles.profilePhoto, styles.profilePhotoPlaceholder]}>
                <Ionicons name="person" size={60} color={colors.text.secondary} />
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

        {/* 4. Profile Song */}
        <View style={styles.songContainer}>
          <ProfileSongCard
            song={profileData?.profileSong || null}
            isOwnProfile={isOwnProfile}
            onPress={handleSongPress}
            onLongPress={handleSongLongPress}
          />
        </View>

        {/* 5. Albums Bar */}
        <AlbumBar
          ref={albumBarRef}
          albums={albums}
          photoUrls={coverPhotoUrls}
          isOwnProfile={isOwnProfile}
          onAlbumPress={handleAlbumPress}
          highlightedAlbumId={highlightedAlbumId}
          onAlbumLongPress={handleAlbumLongPress}
          onAddPress={handleAddAlbumPress}
        />

        <View style={[styles.featurePlaceholder, styles.featurePlaceholderLarge]}>
          <Text style={styles.placeholderText}>Monthly Albums</Text>
        </View>
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
    fontSize: 16,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
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
  // Profile Info Card - left half
  profileInfoCard: {
    flex: 1,
    maxWidth: '48%',
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    padding: 12,
  },
  displayName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  username: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 4,
  },
  bio: {
    fontSize: 14,
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
  // Feature Placeholders
  featurePlaceholder: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    height: 60,
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featurePlaceholderLarge: {
    height: 80,
  },
  placeholderText: {
    color: colors.text.secondary,
    fontSize: 16,
  },
});

export default ProfileScreen;
