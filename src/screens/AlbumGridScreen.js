import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { getAlbum, getPhotosByIds } from '../services/firebase';
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

  // Fetch album and photos on mount
  useEffect(() => {
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
        }
      } catch (error) {
        logger.error('AlbumGridScreen: Error fetching data', { error: error.message });
      } finally {
        setLoading(false);
      }
    };

    fetchAlbumData();
  }, [albumId]);

  const handleBackPress = () => {
    logger.info('AlbumGridScreen: Back pressed');
    navigation.goBack();
  };

  const handleMenuPress = () => {
    logger.info('AlbumGridScreen: Menu pressed');
    Alert.alert(album?.name || 'Album', 'Album options', [
      {
        text: 'Rename Album',
        onPress: () => {
          logger.info('AlbumGridScreen: Rename album selected (stub)');
          // TODO: 08-06 - Implement rename
        },
      },
      {
        text: 'Change Cover',
        onPress: () => {
          logger.info('AlbumGridScreen: Change cover selected (stub)');
          // TODO: 08-06 - Implement change cover
        },
      },
      {
        text: 'Delete Album',
        style: 'destructive',
        onPress: () => {
          logger.info('AlbumGridScreen: Delete album selected (stub)');
          // TODO: 08-06 - Implement delete with confirmation
        },
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  };

  const handlePhotoPress = (photo, index) => {
    logger.info('AlbumGridScreen: Photo pressed', { photoId: photo.id, index });
    // TODO: 08-05 - Navigate to AlbumPhotoViewer
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
});

export default AlbumGridScreen;
