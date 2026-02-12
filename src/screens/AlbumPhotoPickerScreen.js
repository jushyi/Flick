import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import PixelIcon from '../components/PixelIcon';
import PixelSpinner from '../components/PixelSpinner';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';
import { useAuth } from '../context/AuthContext';
import { getUserPhotos } from '../services/firebase/photoService';
import { createAlbum, addPhotosToAlbum } from '../services/firebase/albumService';
import logger from '../utils/logger';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GAP = 2;
const CELL_WIDTH = (SCREEN_WIDTH - GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;
const CELL_HEIGHT = CELL_WIDTH * (4 / 3); // 3:4 portrait ratio

const AlbumPhotoPickerScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Route params
  const { albumName, existingAlbumId, existingPhotoIds = [] } = route.params || {};

  const [photos, setPhotos] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAddingToExisting = !!existingAlbumId;

  // Fetch user's triaged photos
  useEffect(() => {
    const fetchPhotos = async () => {
      if (!user?.uid) return;

      setLoading(true);
      const result = await getUserPhotos(user.uid);

      if (result.success) {
        // Filter for triaged photos only (both journal and archive)
        const triagedPhotos = result.photos.filter(photo => photo.status === 'triaged');
        setPhotos(triagedPhotos);
        logger.info('AlbumPhotoPickerScreen: Fetched photos', { count: triagedPhotos.length });
      } else {
        logger.error('AlbumPhotoPickerScreen: Failed to fetch photos', { error: result.error });
        Alert.alert('Error', 'Could not load your photos');
      }

      setLoading(false);
    };

    fetchPhotos();
  }, [user?.uid]);

  const handleBackPress = () => {
    logger.info('AlbumPhotoPickerScreen: Back pressed');
    navigation.goBack();
  };

  const handlePhotoPress = photoId => {
    // Check if already in album (for existing album mode)
    if (existingPhotoIds.includes(photoId)) {
      return; // Not tappable
    }

    setSelectedIds(prev => {
      if (prev.includes(photoId)) {
        return prev.filter(id => id !== photoId);
      } else {
        return [...prev, photoId];
      }
    });
  };

  const handleCreatePress = async () => {
    if (selectedIds.length === 0) return;

    setSaving(true);
    logger.info('AlbumPhotoPickerScreen: Creating/adding photos', {
      isAddingToExisting,
      albumName,
      existingAlbumId,
      selectedCount: selectedIds.length,
    });

    try {
      let result;

      if (isAddingToExisting) {
        // Add photos to existing album
        result = await addPhotosToAlbum(existingAlbumId, selectedIds);
      } else {
        // Create new album
        result = await createAlbum(user.uid, albumName, selectedIds);
      }

      if (result.success) {
        logger.info('AlbumPhotoPickerScreen: Success', {
          isAddingToExisting,
          albumId: result.album?.id || existingAlbumId,
        });

        if (isAddingToExisting) {
          // Return to album grid
          navigation.goBack();
        } else {
          // Pop both CreateAlbum and AlbumPhotoPicker screens, passing newAlbumId for animation
          navigation.navigate('ProfileMain', { newAlbumId: result.album.id });
        }
      } else {
        Alert.alert('Error', result.error || 'Could not save album');
      }
    } catch (error) {
      logger.error('AlbumPhotoPickerScreen: Error', { error: error.message });
      Alert.alert('Error', error.message || 'An unexpected error occurred');
    }

    setSaving(false);
  };

  const isCreateDisabled = selectedIds.length === 0 || saving;
  const actionButtonText = isAddingToExisting ? 'Add' : 'Create';

  // FlatList optimization: pre-calculate item layout for faster scrolling
  const getItemLayout = useCallback(
    (data, index) => ({
      length: CELL_HEIGHT + GAP,
      offset: (CELL_HEIGHT + GAP) * Math.floor(index / NUM_COLUMNS),
      index,
    }),
    []
  );

  const renderPhoto = useCallback(
    ({ item }) => {
      const isSelected = selectedIds.includes(item.id);
      const isInAlbum = existingPhotoIds.includes(item.id);

      return (
        <TouchableOpacity
          style={styles.photoCell}
          onPress={() => handlePhotoPress(item.id)}
          disabled={isInAlbum}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: item.imageURL, cacheKey: `photo-${item.id}` }}
            style={styles.photoImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="normal"
            recyclingKey={item.id}
            transition={150}
          />

          {/* Selection overlay */}
          {(isSelected || isInAlbum) && (
            <View style={[styles.selectionOverlay, isInAlbum && styles.disabledOverlay]}>
              <View style={[styles.checkmark, isInAlbum && styles.checkmarkDisabled]}>
                <PixelIcon
                  name={isInAlbum ? 'checkmark-done-circle' : 'checkmark'}
                  size={isInAlbum ? 20 : 16}
                  color={isInAlbum ? colors.text.tertiary : colors.text.inverse}
                />
              </View>
              {/* In Album badge */}
              {isInAlbum && (
                <View style={styles.inAlbumBadge}>
                  <Text style={styles.inAlbumText}>In Album</Text>
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [selectedIds, existingPhotoIds, handlePhotoPress]
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
          <PixelIcon name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Select Photos</Text>
          <Text style={styles.headerSubtitle}>{selectedIds.length} selected</Text>
        </View>
        <TouchableOpacity
          onPress={handleCreatePress}
          style={styles.headerButton}
          disabled={isCreateDisabled}
        >
          {saving ? (
            <PixelSpinner size="small" color={colors.system.blue} />
          ) : (
            <Text
              style={[styles.actionButtonText, isCreateDisabled && styles.actionButtonDisabled]}
            >
              {actionButtonText}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Photo Grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <PixelSpinner size="large" color={colors.text.secondary} />
        </View>
      ) : photos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <PixelIcon name="images-outline" size={48} color={colors.text.tertiary} />
          <Text style={styles.emptyText}>No photos yet</Text>
          <Text style={styles.emptySubtext}>Take some photos and triage them to add to albums</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          renderItem={renderPhoto}
          keyExtractor={item => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={[styles.gridContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          getItemLayout={getItemLayout}
          initialNumToRender={12}
          maxToRenderPerBatch={6}
          windowSize={5}
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
  header: {
    backgroundColor: colors.background.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerButton: {
    minWidth: 60,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 2,
  },
  actionButtonText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.system.blue,
  },
  actionButtonDisabled: {
    color: colors.text.tertiary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  gridContent: {
    paddingTop: GAP,
    paddingHorizontal: GAP,
  },
  photoCell: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    margin: GAP / 2,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background.tertiary,
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: 6,
  },
  disabledOverlay: {
    backgroundColor: colors.overlay.darker,
  },
  inAlbumBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: colors.overlay.dark,
    borderRadius: layout.borderRadius.md,
    paddingVertical: spacing.xxs,
  },
  inAlbumText: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: layout.borderRadius.round,
    backgroundColor: colors.system.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkDisabled: {
    backgroundColor: colors.background.tertiary,
  },
});

export default AlbumPhotoPickerScreen;
