import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
import {
  getDeletedPhotos,
  restoreDeletedPhoto,
  permanentlyDeletePhoto,
} from '../services/firebase/photoService';
import logger from '../utils/logger';
import {
  styles,
  NUM_COLUMNS_EXPORT as NUM_COLUMNS,
  GAP_EXPORT as GAP,
} from '../styles/RecentlyDeletedScreen.styles';

/**
 * RecentlyDeletedScreen
 *
 * iOS Photos-style Recently Deleted album experience.
 * Shows deleted photos with countdown overlays, supports multi-select
 * for batch restore/delete, and full-screen viewing.
 *
 * Access: Settings → Recently Deleted
 */
const RecentlyDeletedScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // State
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch deleted photos
  const fetchPhotos = useCallback(async () => {
    if (!user?.uid) return;

    const result = await getDeletedPhotos(user.uid);
    if (result.success) {
      setPhotos(result.photos);
      logger.info('RecentlyDeletedScreen: Fetched deleted photos', {
        count: result.photos.length,
      });
    } else {
      logger.error('RecentlyDeletedScreen: Failed to fetch photos', { error: result.error });
    }
    setLoading(false);
    setRefreshing(false);
  }, [user?.uid]);

  // Load photos on focus
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchPhotos();
    }, [fetchPhotos])
  );

  // Calculate days remaining for a photo
  const getDaysRemaining = photo => {
    if (!photo.scheduledForPermanentDeletionAt) return 30;
    const deletionDate = photo.scheduledForPermanentDeletionAt.toDate
      ? photo.scheduledForPermanentDeletionAt.toDate()
      : new Date(photo.scheduledForPermanentDeletionAt.seconds * 1000);
    const now = Date.now();
    const daysRemaining = Math.ceil((deletionDate - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysRemaining);
  };

  // Handlers
  const handleBackPress = () => {
    logger.info('RecentlyDeletedScreen: Back pressed');
    navigation.goBack();
  };

  const handleSelectToggle = () => {
    if (multiSelectMode) {
      // Exit select mode
      setMultiSelectMode(false);
      setSelectedIds([]);
    } else {
      // Enter select mode
      setMultiSelectMode(true);
    }
  };

  const handlePhotoPress = photo => {
    if (multiSelectMode) {
      // Toggle selection
      setSelectedIds(prev => {
        if (prev.includes(photo.id)) {
          return prev.filter(id => id !== photo.id);
        } else {
          return [...prev, photo.id];
        }
      });
    } else {
      // Open full-screen viewer
      setViewerPhoto(photo);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPhotos();
  };

  // Batch restore selected photos
  const handleBatchRestore = () => {
    const count = selectedIds.length;
    Alert.alert(
      'Restore Photos',
      `Restore ${count} ${count === 1 ? 'photo' : 'photos'} to your journal?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            setActionLoading(true);
            logger.info('RecentlyDeletedScreen: Batch restore started', { count });

            let successCount = 0;
            for (const photoId of selectedIds) {
              const result = await restoreDeletedPhoto(photoId, user.uid);
              if (result.success) successCount++;
            }

            logger.info('RecentlyDeletedScreen: Batch restore completed', {
              successCount,
              total: count,
            });

            setSelectedIds([]);
            setMultiSelectMode(false);
            setActionLoading(false);
            fetchPhotos();

            Alert.alert(
              'Success',
              `Restored ${successCount} ${successCount === 1 ? 'photo' : 'photos'}`
            );
          },
        },
      ]
    );
  };

  // Batch permanently delete selected photos
  const handleBatchDelete = () => {
    const count = selectedIds.length;
    Alert.alert(
      'Delete Permanently',
      `This will permanently delete ${count} ${count === 1 ? 'photo' : 'photos'}. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            logger.info('RecentlyDeletedScreen: Batch delete started', { count });

            let successCount = 0;
            for (const photoId of selectedIds) {
              const result = await permanentlyDeletePhoto(photoId, user.uid);
              if (result.success) successCount++;
            }

            logger.info('RecentlyDeletedScreen: Batch delete completed', {
              successCount,
              total: count,
            });

            setSelectedIds([]);
            setMultiSelectMode(false);
            setActionLoading(false);
            fetchPhotos();

            Alert.alert(
              'Deleted',
              `Permanently deleted ${successCount} ${successCount === 1 ? 'photo' : 'photos'}`
            );
          },
        },
      ]
    );
  };

  // Single photo restore (from viewer)
  const handleSingleRestore = async () => {
    if (!viewerPhoto) return;

    setActionLoading(true);
    logger.info('RecentlyDeletedScreen: Single restore', { photoId: viewerPhoto.id });

    const result = await restoreDeletedPhoto(viewerPhoto.id, user.uid);

    setActionLoading(false);

    if (result.success) {
      Alert.alert('Success', 'Photo restored to your journal');
      setViewerPhoto(null);
      fetchPhotos();
    } else {
      Alert.alert('Error', 'Failed to restore photo');
    }
  };

  // Single photo permanent delete (from viewer)
  const handleSingleDelete = () => {
    if (!viewerPhoto) return;

    Alert.alert(
      'Delete Permanently',
      'This photo will be permanently deleted. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            logger.info('RecentlyDeletedScreen: Single delete', { photoId: viewerPhoto.id });

            const result = await permanentlyDeletePhoto(viewerPhoto.id, user.uid);

            setActionLoading(false);

            if (result.success) {
              Alert.alert('Deleted', 'Photo permanently deleted');
              setViewerPhoto(null);
              fetchPhotos();
            } else {
              Alert.alert('Error', 'Failed to delete photo');
            }
          },
        },
      ]
    );
  };

  // Render photo thumbnail
  const renderPhoto = ({ item }) => {
    const isSelected = selectedIds.includes(item.id);
    const daysRemaining = getDaysRemaining(item);

    return (
      <TouchableOpacity
        style={styles.photoCell}
        onPress={() => handlePhotoPress(item)}
        activeOpacity={0.7}
      >
        <Image source={{ uri: item.imageURL }} style={styles.photoImage} />

        {/* Countdown overlay */}
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownText}>{daysRemaining}d</Text>
        </View>

        {/* Selection overlay */}
        {multiSelectMode && isSelected && (
          <View style={styles.selectionOverlay}>
            <View style={styles.checkmark}>
              <Ionicons name="checkmark" size={16} color={colors.text.inverse} />
            </View>
          </View>
        )}

        {/* Selection circle when in select mode but not selected */}
        {multiSelectMode && !isSelected && (
          <View style={[styles.selectionOverlay, { backgroundColor: 'transparent' }]}>
            <View
              style={[
                styles.checkmark,
                {
                  backgroundColor: 'transparent',
                  borderWidth: 2,
                  borderColor: colors.text.primary,
                },
              ]}
            />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Render full-screen viewer modal
  const renderViewer = () => {
    if (!viewerPhoto) return null;

    const daysRemaining = getDaysRemaining(viewerPhoto);

    return (
      <Modal
        visible={!!viewerPhoto}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setViewerPhoto(null)}
      >
        <View style={styles.viewerContainer}>
          {/* Header */}
          <View style={[styles.viewerHeader, { paddingTop: insets.top }]}>
            <TouchableOpacity style={styles.viewerCloseButton} onPress={() => setViewerPhoto(null)}>
              <Ionicons name="close" size={28} color={colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.viewerHeaderCenter}>
              <View style={styles.viewerDaysBadge}>
                <Text style={styles.viewerDaysText}>
                  {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
                </Text>
              </View>
            </View>
            <View style={styles.viewerCloseButton} />
          </View>

          {/* Image */}
          <View style={styles.viewerImageContainer}>
            <Image
              source={{ uri: viewerPhoto.imageURL }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          </View>

          {/* Footer actions */}
          <View style={[styles.viewerFooter, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[styles.viewerButton, styles.viewerRestoreButton]}
              onPress={handleSingleRestore}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color={colors.text.primary} />
              ) : (
                <>
                  <Ionicons name="arrow-undo" size={20} color={colors.text.primary} />
                  <Text style={styles.viewerButtonText}>Restore</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewerButton, styles.viewerDeleteButton]}
              onPress={handleSingleDelete}
              disabled={actionLoading}
            >
              <Ionicons name="trash" size={20} color={colors.text.primary} />
              <Text style={styles.viewerButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Recently Deleted</Text>
          </View>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.text.secondary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Recently Deleted</Text>
          {multiSelectMode && selectedIds.length > 0 && (
            <Text style={styles.headerSubtitle}>{selectedIds.length} selected</Text>
          )}
        </View>
        <TouchableOpacity onPress={handleSelectToggle} style={styles.headerButton}>
          <Text style={styles.selectButtonText}>{multiSelectMode ? 'Done' : 'Select'}</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {photos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="trash-outline"
            size={64}
            color={colors.text.tertiary}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyText}>No Recently Deleted Photos</Text>
          <Text style={styles.emptySubtext}>
            Photos you delete will appear here for 30 days before being permanently removed.
          </Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          renderItem={renderPhoto}
          keyExtractor={item => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={[
            styles.gridContent,
            {
              paddingBottom:
                multiSelectMode && selectedIds.length > 0
                  ? insets.bottom + 100
                  : insets.bottom + 20,
            },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.text.secondary}
            />
          }
        />
      )}

      {/* Bottom action bar (multi-select mode) */}
      {multiSelectMode && selectedIds.length > 0 && (
        <View style={[styles.bottomActionBar, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.actionButton, styles.restoreButton]}
            onPress={handleBatchRestore}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color={colors.text.primary} />
            ) : (
              <>
                <Ionicons name="arrow-undo" size={20} color={colors.text.primary} />
                <Text style={styles.actionButtonText}>Restore</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleBatchDelete}
            disabled={actionLoading}
          >
            <Ionicons name="trash" size={20} color={colors.text.primary} />
            <Text style={styles.actionButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Full-screen viewer modal */}
      {renderViewer()}
    </SafeAreaView>
  );
};

export default RecentlyDeletedScreen;
