import { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import {
  getAlbum,
  getPhotosByIds,
  removePhotoFromAlbum,
  setCoverPhoto,
  updateAlbum,
  deleteAlbum,
} from '../services/firebase';
import { AlbumPhotoViewer } from '../components';
import logger from '../utils/logger';

const HEADER_HEIGHT = 64;
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = (SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

const AlbumGridScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  const { albumId, isOwnProfile } = route.params || {};

  const [album, setAlbum] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // Fetch album and photos function
  const fetchAlbumData = async () => {
    if (!albumId) {
      logger.error('AlbumGridScreen: No albumId provided');
      setLoading(false);
      return;
    }

    try {
      // Fetch album document
      const albumResult = await getAlbum(albumId);
      if (!albumResult.success) {
        logger.error('AlbumGridScreen: Failed to fetch album', { error: albumResult.error });
        setLoading(false);
        return;
      }

      setAlbum(albumResult.album);
      logger.info('AlbumGridScreen: Fetched album', {
        albumId,
        name: albumResult.album.name,
        photoCount: albumResult.album.photoIds?.length,
      });

      // Fetch photo documents for photoIds
      if (albumResult.album.photoIds?.length > 0) {
        const photosResult = await getPhotosByIds(albumResult.album.photoIds);
        if (photosResult.success) {
          // Maintain album's photoIds order (newest first)
          const orderedPhotos = albumResult.album.photoIds
            .map(id => photosResult.photos.find(p => p.id === id))
            .filter(p => p !== undefined);
          setPhotos(orderedPhotos);
          logger.info('AlbumGridScreen: Fetched photos', { count: orderedPhotos.length });
        }
      } else {
        setPhotos([]);
      }
    } catch (error) {
      logger.error('AlbumGridScreen: Error fetching data', { error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Fetch album and photos on mount
  useEffect(() => {
    fetchAlbumData();
  }, [albumId]);

  const handleBackPress = () => {
    logger.info('AlbumGridScreen: Back pressed');
    navigation.goBack();
  };

  // Rename album handler
  const handleRenameAlbum = () => {
    logger.info('AlbumGridScreen: Rename album selected');
    Alert.prompt(
      'Rename Album',
      'Enter a new name (max 24 characters)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async newName => {
            if (!newName || newName.trim().length === 0) {
              Alert.alert('Error', 'Album name cannot be empty');
              return;
            }
            if (newName.trim().length > 24) {
              Alert.alert('Error', 'Album name must be 24 characters or less');
              return;
            }
            logger.info('AlbumGridScreen: Renaming album', { albumId, newName: newName.trim() });
            const result = await updateAlbum(albumId, { name: newName.trim() });
            if (result.success) {
              fetchAlbumData(); // Refresh to show new name
            } else {
              Alert.alert('Error', result.error || 'Could not rename album');
            }
          },
        },
      ],
      'plain-text',
      album?.name || ''
    );
  };

  // Delete album handler with confirmation
  const handleDeleteAlbum = () => {
    logger.info('AlbumGridScreen: Delete album selected');
    Alert.alert('Delete Album?', 'Photos will remain in your library.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          logger.info('AlbumGridScreen: Confirming album deletion', { albumId });
          const result = await deleteAlbum(albumId);
          if (result.success) {
            logger.info('AlbumGridScreen: Album deleted successfully');
            navigation.goBack();
          } else {
            Alert.alert('Error', result.error || 'Could not delete album');
          }
        },
      },
    ]);
  };

  const handleMenuPress = () => {
    logger.info('AlbumGridScreen: Menu pressed');
    Alert.alert(album?.name || 'Album', '', [
      {
        text: 'Rename Album',
        onPress: handleRenameAlbum,
      },
      {
        text: 'Delete Album',
        style: 'destructive',
        onPress: handleDeleteAlbum,
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  };

  const handlePhotoPress = (photo, index) => {
    logger.info('AlbumGridScreen: Photo pressed', { photoId: photo.id, index });
    setViewerInitialIndex(index);
    setViewerVisible(true);
  };

  // Handle long-press on grid photo to show set cover option
  const handlePhotoLongPress = photo => {
    if (!isOwnProfile) return;

    logger.info('AlbumGridScreen: Photo long pressed', { photoId: photo.id });
    Alert.alert('Photo Options', '', [
      {
        text: 'Set as Album Cover',
        onPress: () => handleSetCover(photo.id),
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  };

  // Handle remove photo from album
  const handleRemovePhoto = async photoId => {
    logger.info('AlbumGridScreen: Removing photo from album', { albumId, photoId });
    const result = await removePhotoFromAlbum(albumId, photoId);
    if (result.success) {
      // Refresh album data
      fetchAlbumData();
    } else if (result.warning) {
      // Last photo - album will be empty, need to delete album instead
      Alert.alert('Cannot Remove', result.warning);
    } else {
      Alert.alert('Error', result.error || 'Could not remove photo');
    }
  };

  // Show toast notification
  const showToast = () => {
    setToastVisible(true);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1600),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setToastVisible(false));
  };

  // Handle set cover photo
  const handleSetCover = async photoId => {
    logger.info('AlbumGridScreen: Setting cover photo', { albumId, photoId });
    const result = await setCoverPhoto(albumId, photoId);
    if (result.success) {
      fetchAlbumData(); // Refresh to update cover
      showToast(); // Show confirmation toast
    } else {
      Alert.alert('Error', result.error || 'Could not set cover photo');
    }
  };

  const handleAddPhotosPress = () => {
    logger.info('AlbumGridScreen: Add photos pressed');
    navigation.navigate('AlbumPhotoPicker', {
      existingAlbumId: albumId,
    });
  };

  // Prepare grid data (photos + add button if own profile)
  const gridData = useMemo(() => {
    const data = photos.map(photo => ({ type: 'photo', photo }));
    if (isOwnProfile) {
      data.push({ type: 'addButton' });
    }
    return data;
  }, [photos, isOwnProfile]);

  const renderItem = ({ item, index }) => {
    if (item.type === 'addButton') {
      return (
        <TouchableOpacity
          style={styles.addButtonCell}
          onPress={handleAddPhotosPress}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={32} color={colors.text.secondary} />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={styles.photoCell}
        onPress={() => handlePhotoPress(item.photo, index)}
        onLongPress={() => handlePhotoLongPress(item.photo)}
        activeOpacity={0.8}
      >
        <Image source={{ uri: item.photo.imageURL }} style={styles.photoImage} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: insets.top + HEADER_HEIGHT }]}>
          <Text style={styles.loadingText}>Loading album...</Text>
        </View>
      </View>
    );
  }

  if (!album) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { top: insets.top }]}>
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Album</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={[styles.loadingContainer, { paddingTop: insets.top + HEADER_HEIGHT }]}>
          <Text style={styles.loadingText}>Album not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { top: insets.top }]}>
        <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {album.name}
          </Text>
          <Text style={styles.photoCount}>
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
          </Text>
        </View>
        {isOwnProfile ? (
          <TouchableOpacity onPress={handleMenuPress} style={styles.headerButton}>
            <Ionicons name="ellipsis-horizontal" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>

      {/* Grid */}
      <FlatList
        data={gridData}
        renderItem={renderItem}
        keyExtractor={(item, index) => (item.type === 'addButton' ? 'add-button' : item.photo.id)}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={[styles.gridContent, { paddingTop: insets.top + HEADER_HEIGHT }]}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.columnWrapper}
      />

      {/* Photo Viewer Modal */}
      <AlbumPhotoViewer
        visible={viewerVisible}
        photos={photos}
        initialIndex={viewerInitialIndex}
        albumName={album?.name}
        isOwnProfile={isOwnProfile}
        onClose={() => setViewerVisible(false)}
        onRemovePhoto={handleRemovePhoto}
        onSetCover={handleSetCover}
      />

      {/* Toast notification */}
      {toastVisible && (
        <Animated.View
          style={[styles.toast, { opacity: toastOpacity, bottom: insets.bottom + 20 }]}
        >
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <Text style={styles.toastText}>Cover set</Text>
        </Animated.View>
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
    fontSize: 16,
  },
  header: {
    position: 'absolute',
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
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    textAlign: 'center',
  },
  photoCount: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  gridContent: {
    paddingBottom: 100, // Tab bar clearance
  },
  columnWrapper: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  photoCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background.tertiary,
  },
  addButtonCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.text.secondary,
    borderStyle: 'dashed',
    borderRadius: 4,
  },
  addButtonText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
  },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333333',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default AlbumGridScreen;
