import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  Platform,
} from 'react-native';
import PixelIcon from './PixelIcon';
import PixelSpinner from './PixelSpinner';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { getUserAlbums, getPhotosByIds, addPhotosToAlbum } from '../services/firebase';
import logger from '../utils/logger';

const THUMBNAIL_SIZE = 50;

/**
 * AddToAlbumSheet - Bottom sheet for adding a photo to an album
 *
 * Props:
 * - visible: Boolean to show/hide
 * - photoId: Photo ID to add to album
 * - onClose: Close callback
 * - onAlbumCreated: Optional callback when album created/photo added
 */
const AddToAlbumSheet = ({ visible, photoId, onClose, onAlbumCreated }) => {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [albums, setAlbums] = useState([]);
  const [coverUrls, setCoverUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [addingToAlbum, setAddingToAlbum] = useState(null);

  // Fetch albums when sheet becomes visible
  useEffect(() => {
    const fetchAlbums = async () => {
      if (!visible || !user?.uid) {
        return;
      }

      setLoading(true);
      logger.info('AddToAlbumSheet: Fetching albums');

      try {
        const result = await getUserAlbums(user.uid);
        if (result.success) {
          setAlbums(result.albums);

          // Fetch cover photo URLs
          const coverPhotoIds = result.albums.map(album => album.coverPhotoId).filter(id => id);

          if (coverPhotoIds.length > 0) {
            const photosResult = await getPhotosByIds(coverPhotoIds);
            if (photosResult.success) {
              const urlMap = {};
              photosResult.photos.forEach(photo => {
                urlMap[photo.id] = photo.imageURL;
              });
              setCoverUrls(urlMap);
            }
          }

          logger.info('AddToAlbumSheet: Fetched albums', { count: result.albums.length });
        } else {
          logger.error('AddToAlbumSheet: Failed to fetch albums', { error: result.error });
          setAlbums([]);
        }
      } catch (error) {
        logger.error('AddToAlbumSheet: Error fetching albums', { error: error.message });
        setAlbums([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAlbums();
  }, [visible, user?.uid]);

  const handleClose = () => {
    logger.info('AddToAlbumSheet: Closing');
    onClose?.();
  };

  const handleCreateNewAlbum = () => {
    logger.info('AddToAlbumSheet: Create new album pressed', { photoId });
    handleClose();
    // Navigate to CreateAlbum with the photo pre-selected
    navigation.navigate('CreateAlbum', { preselectedPhotoId: photoId });
  };

  const handleSelectAlbum = async album => {
    // Check if photo is already in album
    if (album.photoIds?.includes(photoId)) {
      logger.info('AddToAlbumSheet: Photo already in album', { albumId: album.id, photoId });
      return;
    }

    setAddingToAlbum(album.id);
    logger.info('AddToAlbumSheet: Adding photo to album', { albumId: album.id, photoId });

    try {
      const result = await addPhotosToAlbum(album.id, [photoId]);
      if (result.success) {
        logger.info('AddToAlbumSheet: Photo added successfully');
        Alert.alert('Success', `Added to "${album.name}"`);
        onAlbumCreated?.();
        handleClose();
      } else {
        Alert.alert('Error', result.error || 'Could not add photo to album');
      }
    } catch (error) {
      logger.error('AddToAlbumSheet: Failed to add photo', { error: error.message });
      Alert.alert('Error', 'An error occurred');
    } finally {
      setAddingToAlbum(null);
    }
  };

  const renderAlbumItem = ({ item }) => {
    const isPhotoInAlbum = item.photoIds?.includes(photoId);
    const isAdding = addingToAlbum === item.id;
    const coverUrl = coverUrls[item.coverPhotoId];

    return (
      <TouchableOpacity
        style={[styles.albumRow, isPhotoInAlbum && styles.albumRowDisabled]}
        onPress={() => handleSelectAlbum(item)}
        disabled={isPhotoInAlbum || isAdding}
        activeOpacity={0.7}
      >
        {/* Album Cover Thumbnail */}
        <View style={styles.thumbnail}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.thumbnailImage} />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <PixelIcon name="images" size={20} color={colors.text.secondary} />
            </View>
          )}
        </View>

        {/* Album Info */}
        <View style={styles.albumInfo}>
          <Text style={[styles.albumName, isPhotoInAlbum && styles.textDisabled]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.photoCount, isPhotoInAlbum && styles.textDisabled]}>
            {item.photoIds?.length || 0} {item.photoIds?.length === 1 ? 'photo' : 'photos'}
          </Text>
        </View>

        {/* Status indicator */}
        <View style={styles.statusContainer}>
          {isAdding ? (
            <PixelSpinner size="small" color={colors.brand.primary} />
          ) : isPhotoInAlbum ? (
            <PixelIcon name="checkmark-circle" size={24} color={colors.brand.primary} />
          ) : (
            <PixelIcon name="chevron-forward" size={20} color={colors.text.secondary} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Backdrop */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        {/* Sheet */}
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Add to Album</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <PixelIcon name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Create New Album Option */}
          <TouchableOpacity
            style={styles.createRow}
            onPress={handleCreateNewAlbum}
            activeOpacity={0.7}
          >
            <View style={styles.createIcon}>
              <PixelIcon name="add" size={24} color={colors.brand.primary} />
            </View>
            <Text style={styles.createText}>Create New Album</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Albums List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <PixelSpinner size="large" color={colors.brand.primary} />
              <Text style={styles.loadingText}>Loading albums...</Text>
            </View>
          ) : albums.length === 0 ? (
            <View style={styles.emptyContainer}>
              <PixelIcon name="albums-outline" size={48} color={colors.text.secondary} />
              <Text style={styles.emptyText}>No albums yet</Text>
              <Text style={styles.emptySubtext}>Create your first album above</Text>
            </View>
          ) : (
            <FlatList
              data={albums}
              renderItem={renderAlbumItem}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  sheet: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    maxHeight: '70%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  createIcon: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: colors.brand.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.brand.primary,
    marginLeft: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginHorizontal: 20,
    marginVertical: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  albumRowDisabled: {
    opacity: 0.6,
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 2,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumInfo: {
    flex: 1,
    marginLeft: 12,
  },
  albumName: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  photoCount: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 2,
  },
  textDisabled: {
    color: colors.text.secondary,
  },
  statusContainer: {
    width: 32,
    alignItems: 'center',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 12,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 4,
  },
});

export default AddToAlbumSheet;
