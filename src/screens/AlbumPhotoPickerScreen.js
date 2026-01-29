import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
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
          // Pop both CreateAlbum and AlbumPhotoPicker screens
          navigation.navigate('ProfileMain');
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

  const renderPhoto = ({ item }) => {
    const isSelected = selectedIds.includes(item.id);
    const isInAlbum = existingPhotoIds.includes(item.id);

    return (
      <TouchableOpacity
        style={styles.photoCell}
        onPress={() => handlePhotoPress(item.id)}
        disabled={isInAlbum}
        activeOpacity={0.7}
      >
        <Image source={{ uri: item.imageURL }} style={styles.photoImage} />

        {/* Selection overlay */}
        {(isSelected || isInAlbum) && (
          <View style={[styles.selectionOverlay, isInAlbum && styles.disabledOverlay]}>
            <View style={[styles.checkmark, isInAlbum && styles.checkmarkDisabled]}>
              <Ionicons
                name="checkmark"
                size={16}
                color={isInAlbum ? colors.text.tertiary : colors.text.inverse}
              />
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
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
            <ActivityIndicator size="small" color={colors.system.blue} />
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
          <ActivityIndicator size="large" color={colors.text.secondary} />
        </View>
      ) : photos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={48} color={colors.text.tertiary} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 12,
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
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#888888',
    marginTop: 2,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: 8,
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: 6,
  },
  disabledOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.system.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkDisabled: {
    backgroundColor: colors.background.tertiary,
  },
});

export default AlbumPhotoPickerScreen;
