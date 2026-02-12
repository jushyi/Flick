import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import PixelIcon from '../components/PixelIcon';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';
import { useAuth } from '../context/AuthContext';
import {
  getAlbum,
  getPhotosByIds,
  removePhotoFromAlbum,
  setCoverPhoto,
  updateAlbum,
  deleteAlbum,
} from '../services/firebase';
import { AlbumPhotoViewer, DropdownMenu, RenameAlbumModal } from '../components';
import logger from '../utils/logger';

const HEADER_HEIGHT = 64;
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_WIDTH = (SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const CELL_HEIGHT = CELL_WIDTH * (4 / 3); // 3:4 portrait ratio

const AlbumGridScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { albumId, isOwnProfile } = route.params || {};

  const [album, setAlbum] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [viewerSourceRect, setViewerSourceRect] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // Refs for measuring photo cell positions (expand/collapse animation)
  const cellRefs = useRef({});

  // Menu states
  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
  const [photoMenuVisible, setPhotoMenuVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [headerMenuAnchor, setHeaderMenuAnchor] = useState(null);
  const [photoMenuAnchor, setPhotoMenuAnchor] = useState(null);
  const headerMenuButtonRef = useRef(null);

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

  // Fetch album and photos when screen gains focus (handles returning from photo picker)
  useFocusEffect(
    useCallback(() => {
      fetchAlbumData();
    }, [albumId])
  );

  const handleBackPress = () => {
    logger.info('AlbumGridScreen: Back pressed');
    navigation.goBack();
  };

  // Handle photo state change (archive/restore/delete) - refresh album data
  const handlePhotoStateChanged = useCallback(() => {
    logger.info('AlbumGridScreen: Photo state changed, refreshing');
    fetchAlbumData();
  }, []);

  // Open header menu with anchor position
  const handleOpenHeaderMenu = useCallback(() => {
    if (headerMenuButtonRef.current) {
      headerMenuButtonRef.current.measure((x, y, width, height, pageX, pageY) => {
        setHeaderMenuAnchor({ x: pageX, y: pageY, width, height });
        setHeaderMenuVisible(true);
      });
    } else {
      setHeaderMenuVisible(true);
    }
  }, []);

  // Rename album handler - save new name
  const handleRenameAlbum = async newName => {
    logger.info('AlbumGridScreen: Renaming album', { albumId, newName });
    const result = await updateAlbum(albumId, { name: newName });
    if (result.success) {
      fetchAlbumData(); // Refresh to show new name
    } else {
      Alert.alert('Error', result.error || 'Could not rename album');
    }
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

  // Header menu options
  const headerMenuOptions = [
    {
      label: 'Rename Album',
      icon: 'pencil-outline',
      onPress: () => setRenameModalVisible(true),
    },
    {
      label: 'Delete Album',
      icon: 'trash-outline',
      onPress: handleDeleteAlbum,
      destructive: true,
    },
  ];

  const handlePhotoPress = (photo, index) => {
    logger.info('AlbumGridScreen: Photo pressed', { photoId: photo.id, index });
    const cellRef = cellRefs.current[index];
    if (cellRef) {
      cellRef.measureInWindow((x, y, width, height) => {
        setViewerSourceRect({ x, y, width, height });
        setViewerInitialIndex(index);
        setViewerVisible(true);
      });
    } else {
      setViewerSourceRect(null);
      setViewerInitialIndex(index);
      setViewerVisible(true);
    }
  };

  // Handle long-press on grid photo to show set cover option
  const handlePhotoLongPress = (photo, event) => {
    if (!isOwnProfile) return;

    logger.info('AlbumGridScreen: Photo long pressed', { photoId: photo.id });
    setSelectedPhoto(photo);

    // Capture touch position for anchored menu
    if (event?.nativeEvent) {
      const { pageX, pageY } = event.nativeEvent;
      setPhotoMenuAnchor({ x: pageX, y: pageY, width: 0, height: 0 });
    }
    setPhotoMenuVisible(true);
  };

  // Photo menu options (dynamically created based on selectedPhoto)
  const photoMenuOptions = selectedPhoto
    ? [
        {
          label: 'Set as Cover',
          icon: 'image-outline',
          onPress: () => handleSetCover(selectedPhoto.id),
        },
      ]
    : [];

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
      existingPhotoIds: album?.photoIds || [],
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

  // FlatList optimization: pre-calculate item layout for faster scrolling
  const getItemLayout = useCallback(
    (data, index) => ({
      length: CELL_HEIGHT + GRID_GAP,
      offset: (CELL_HEIGHT + GRID_GAP) * Math.floor(index / NUM_COLUMNS),
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item, index }) => {
      if (item.type === 'addButton') {
        return (
          <TouchableOpacity
            style={styles.addButtonCell}
            onPress={handleAddPhotosPress}
            activeOpacity={0.7}
          >
            <PixelIcon name="add" size={32} color={colors.text.secondary} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        );
      }

      return (
        <TouchableOpacity
          ref={r => {
            cellRefs.current[index] = r;
          }}
          style={styles.photoCell}
          onPress={() => handlePhotoPress(item.photo, index)}
          onLongPress={event => handlePhotoLongPress(item.photo, event)}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: item.photo.imageURL, cacheKey: `photo-${item.photo.id}` }}
            style={styles.photoImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="normal"
            recyclingKey={item.photo.id}
            transition={150}
          />
        </TouchableOpacity>
      );
    },
    [handlePhotoPress, handlePhotoLongPress, handleAddPhotosPress]
  );

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
            <PixelIcon name="chevron-back" size={24} color={colors.text.primary} />
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
      {/* Safe area background - covers gap between screen top and header */}
      <View style={[styles.safeAreaBackground, { height: insets.top }]} />

      {/* Header */}
      <View style={[styles.header, { top: insets.top }]}>
        <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
          <PixelIcon name="chevron-back" size={24} color={colors.text.primary} />
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
          <TouchableOpacity
            ref={headerMenuButtonRef}
            onPress={handleOpenHeaderMenu}
            style={styles.headerButton}
          >
            <PixelIcon name="ellipsis-horizontal" size={24} color={colors.text.primary} />
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
        getItemLayout={getItemLayout}
        initialNumToRender={9}
        maxToRenderPerBatch={6}
        windowSize={5}
      />

      {/* Photo Viewer Modal */}
      <AlbumPhotoViewer
        visible={viewerVisible}
        photos={photos}
        initialIndex={viewerInitialIndex}
        albumId={albumId}
        albumName={album?.name}
        isOwnProfile={isOwnProfile}
        currentUserId={user?.uid}
        sourceRect={viewerSourceRect}
        onClose={() => {
          setViewerVisible(false);
          setViewerSourceRect(null);
        }}
        onRemovePhoto={handleRemovePhoto}
        onSetCover={handleSetCover}
        onPhotoStateChanged={handlePhotoStateChanged}
      />

      {/* Toast notification */}
      {toastVisible && (
        <Animated.View
          style={[styles.toast, { opacity: toastOpacity, bottom: insets.bottom + 20 }]}
        >
          <PixelIcon name="checkmark-circle" size={20} color={colors.status.ready} />
          <Text style={styles.toastText}>Cover set</Text>
        </Animated.View>
      )}

      {/* Header dropdown menu */}
      <DropdownMenu
        visible={headerMenuVisible}
        onClose={() => setHeaderMenuVisible(false)}
        options={headerMenuOptions}
        anchorPosition={headerMenuAnchor}
      />

      {/* Photo long-press dropdown menu */}
      <DropdownMenu
        visible={photoMenuVisible}
        onClose={() => setPhotoMenuVisible(false)}
        options={photoMenuOptions}
        anchorPosition={photoMenuAnchor}
      />

      {/* Rename album modal */}
      <RenameAlbumModal
        visible={renameModalVisible}
        currentName={album?.name || ''}
        onClose={() => setRenameModalVisible(false)}
        onSave={handleRenameAlbum}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  safeAreaBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
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
    left: 0,
    right: 0,
    zIndex: 10,
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerButton: {
    width: layout.dimensions.avatarMedium,
    height: layout.dimensions.avatarMedium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    textAlign: 'center',
  },
  photoCount: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
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
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background.tertiary,
  },
  addButtonCell: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.text.secondary,
    borderStyle: 'dashed',
    borderRadius: layout.borderRadius.md,
  },
  addButtonText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.tertiary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: layout.borderRadius.xl,
    gap: spacing.xs,
  },
  toastText: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
  },
});

export default AlbumGridScreen;
