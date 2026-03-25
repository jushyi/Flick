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
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';
import { getUserAlbums, addPhotosToAlbum, Album } from '../services/supabase/albumService';
// TODO(20-01): getPhotosByIds - wire to supabase photoService in subsequent plans
import { getPhotoById } from '../services/supabase/photoService';
import logger from '../utils/logger';

// Temporary helper until getPhotosByIds is wired
const getPhotosByIds = async (ids: string[]) => {
  const photos = await Promise.all(ids.map(id => getPhotoById(id)));
  return photos.filter(Boolean) as unknown as Array<{ id: string; imageUrl: string | null; [key: string]: unknown }>;
};

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
type Props = {
  visible: boolean;
  photoId: string;
  onClose: () => void;
  onAlbumCreated?: () => void;
};

const AddToAlbumSheet = ({ visible, photoId, onClose, onAlbumCreated }: Props) => {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [albums, setAlbums] = useState<Album[]>([]);
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [addingToAlbum, setAddingToAlbum] = useState<string | null>(null);

  // Fetch albums when sheet becomes visible
  useEffect(() => {
    const fetchAlbums = async () => {
      if (!visible || !user?.id) {
        return;
      }

      setLoading(true);
      logger.info('AddToAlbumSheet: Fetching albums');

      try {
        const result = await getUserAlbums(user!.id);
        setAlbums(result);

        // Fetch cover photo URLs
        const coverPhotoIds = result.map(album => album.coverPhotoId).filter((id): id is string => !!id);

        if (coverPhotoIds.length > 0) {
          const photos = await getPhotosByIds(coverPhotoIds);
          const urlMap: Record<string, string> = {};
          photos.forEach(photo => {
            if (photo.imageUrl) {
              urlMap[photo.id] = photo.imageUrl;
            }
          });
          setCoverUrls(urlMap);
        }

        logger.info('AddToAlbumSheet: Fetched albums', { count: result.length });
      } catch (error) {
        logger.error('AddToAlbumSheet: Error fetching albums', { error: (error as Error).message });
        setAlbums([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAlbums();
  }, [visible, user?.id]);

  const handleClose = () => {
    logger.info('AddToAlbumSheet: Closing');
    onClose?.();
  };

  const handleCreateNewAlbum = () => {
    logger.info('AddToAlbumSheet: Create new album pressed', { photoId });
    handleClose();
    // Navigate to CreateAlbum with the photo pre-selected
    (navigation as any).navigate('CreateAlbum', { preselectedPhotoId: photoId });
  };

  const handleSelectAlbum = async (album: Album) => {
    setAddingToAlbum(album.id);
    logger.info('AddToAlbumSheet: Adding photo to album', { albumId: album.id, photoId });

    try {
      await addPhotosToAlbum(album.id, [photoId]);
      logger.info('AddToAlbumSheet: Photo added successfully');
      Alert.alert('Success', `Added to "${album.title}"`);
      onAlbumCreated?.();
      handleClose();
    } catch (error) {
      logger.error('AddToAlbumSheet: Failed to add photo', { error: (error as Error).message });
      Alert.alert('Error', (error as Error).message || 'An error occurred');
    } finally {
      setAddingToAlbum(null);
    }
  };

  const renderAlbumItem = ({ item }: { item: Album }) => {
    const isAdding = addingToAlbum === item.id;
    const coverUrl = item.coverPhotoId ? coverUrls[item.coverPhotoId] : undefined;

    return (
      <TouchableOpacity
        style={styles.albumRow}
        onPress={() => handleSelectAlbum(item)}
        disabled={isAdding}
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
          <Text style={styles.albumName} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.photoCount}>
            {item.photoCount || 0} {item.photoCount === 1 ? 'photo' : 'photos'}
          </Text>
        </View>

        {/* Status indicator */}
        <View style={styles.statusContainer}>
          {isAdding ? (
            <PixelSpinner size="small" color={colors.brand.purple} />
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
              <PixelIcon name="add" size={24} color={colors.brand.purple} />
            </View>
            <Text style={styles.createText}>Create New Album</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Albums List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <PixelSpinner size="large" color={colors.brand.purple} />
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
              initialNumToRender={6}
              maxToRenderPerBatch={4}
              windowSize={5}
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
    borderTopLeftRadius: layout.borderRadius.xl,
    borderTopRightRadius: layout.borderRadius.xl,
    maxHeight: '70%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: spacing.md,
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
    paddingVertical: spacing.sm,
  },
  createIcon: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: layout.borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.brand.purple,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.brand.purple,
    marginLeft: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginHorizontal: 20,
    marginVertical: spacing.xs,
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
    borderRadius: layout.borderRadius.sm,
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
    marginLeft: spacing.sm,
  },
  albumName: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  photoCount: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    marginTop: 2,
  },
  textDisabled: {
    color: colors.text.secondary,
  },
  statusContainer: {
    width: layout.dimensions.avatarSmall,
    alignItems: 'center',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  emptySubtext: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
});

export default AddToAlbumSheet;
