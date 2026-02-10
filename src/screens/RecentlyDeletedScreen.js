import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import PixelSpinner from '../components/PixelSpinner';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedModule, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import PixelIcon from '../components/PixelIcon';
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

const ReanimatedView = ReanimatedModule.View;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useAuth();

  // State
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  // Refs
  const viewerFlatListRef = useRef(null);

  // Swipe-to-dismiss gesture for viewer modal
  const translateY = useSharedValue(0);

  const handleDismissViewer = useCallback(() => {
    setViewerVisible(false);
  }, []);

  const panGesture = Gesture.Pan()
    .onUpdate(event => {
      'worklet';
      // Only track downward movement
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd(event => {
      'worklet';
      // Dismiss if dragged far enough or fast enough
      if (event.translationY > 150 || event.velocityY > 500) {
        runOnJS(handleDismissViewer)();
      } else {
        // Spring back to original position
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Reset translateY when viewer opens
  React.useEffect(() => {
    if (viewerVisible) {
      translateY.value = 0;
    }
  }, [viewerVisible, translateY]);

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

  const handlePhotoPress = (photo, index) => {
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
      // Open full-screen viewer at this index
      setViewerIndex(index);
      setViewerVisible(true);
      // Scroll to the correct position after a brief delay
      setTimeout(() => {
        viewerFlatListRef.current?.scrollToIndex({
          index,
          animated: false,
        });
      }, 50);
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

  // Get current photo from viewer
  const currentViewerPhoto = photos[viewerIndex];

  // Single photo restore (from viewer)
  const handleSingleRestore = async () => {
    if (!currentViewerPhoto) return;

    setActionLoading(true);
    logger.info('RecentlyDeletedScreen: Single restore', { photoId: currentViewerPhoto.id });

    const result = await restoreDeletedPhoto(currentViewerPhoto.id, user.uid);

    setActionLoading(false);

    if (result.success) {
      Alert.alert('Success', 'Photo restored to your journal');
      setViewerVisible(false);
      fetchPhotos();
    } else {
      Alert.alert('Error', 'Failed to restore photo');
    }
  };

  // Single photo permanent delete (from viewer)
  const handleSingleDelete = () => {
    if (!currentViewerPhoto) return;

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
            logger.info('RecentlyDeletedScreen: Single delete', { photoId: currentViewerPhoto.id });

            const result = await permanentlyDeletePhoto(currentViewerPhoto.id, user.uid);

            setActionLoading(false);

            if (result.success) {
              Alert.alert('Deleted', 'Photo permanently deleted');
              setViewerVisible(false);
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
  const renderPhoto = ({ item, index }) => {
    const isSelected = selectedIds.includes(item.id);
    const daysRemaining = getDaysRemaining(item);

    return (
      <TouchableOpacity
        style={styles.photoCell}
        onPress={() => handlePhotoPress(item, index)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: item.imageURL }}
          style={styles.photoImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="normal"
          recyclingKey={item.id}
          transition={150}
        />

        {/* Countdown overlay */}
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownText}>{daysRemaining}d</Text>
        </View>

        {/* Selection overlay */}
        {multiSelectMode && isSelected && (
          <View style={styles.selectionOverlay}>
            <View style={styles.checkmark}>
              <PixelIcon name="checkmark" size={16} color={colors.text.inverse} />
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

  // Handle viewer scroll end to update current index
  const handleViewerScrollEnd = useCallback(
    event => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const newIndex = Math.round(offsetX / SCREEN_WIDTH);
      if (newIndex >= 0 && newIndex < photos.length) {
        setViewerIndex(newIndex);
      }
    },
    [photos.length]
  );

  // Get item layout for viewer FlatList optimization
  const getViewerItemLayout = useCallback(
    (_, index) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    []
  );

  // Render individual viewer photo
  const renderViewerPhoto = useCallback(
    ({ item }) => (
      <View style={styles.viewerPhotoContainer}>
        <Image
          source={{ uri: item.imageURL }}
          style={styles.viewerImage}
          contentFit="contain"
          cachePolicy="memory-disk"
          priority="high"
          recyclingKey={`viewer-${item.id}`}
          transition={150}
        />
      </View>
    ),
    []
  );

  // Render full-screen viewer modal
  const renderViewer = () => {
    if (!viewerVisible || photos.length === 0) return null;

    const daysRemaining = currentViewerPhoto ? getDaysRemaining(currentViewerPhoto) : 0;

    return (
      <Modal
        visible={viewerVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={handleDismissViewer}
      >
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'transparent' }}>
          <GestureDetector gesture={panGesture}>
            <ReanimatedView style={[styles.viewerContainer, animatedStyle]}>
              {/* Photo viewer - horizontal swipeable */}
              <FlatList
                ref={viewerFlatListRef}
                data={photos}
                renderItem={renderViewerPhoto}
                keyExtractor={item => `viewer-${item.id}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleViewerScrollEnd}
                getItemLayout={getViewerItemLayout}
                initialScrollIndex={viewerIndex}
                onScrollToIndexFailed={info => {
                  setTimeout(() => {
                    viewerFlatListRef.current?.scrollToIndex({
                      index: info.index,
                      animated: false,
                    });
                  }, 100);
                }}
              />

              {/* Header */}
              <View style={[styles.viewerHeader, { paddingTop: insets.top }]}>
                <TouchableOpacity style={styles.viewerCloseButton} onPress={handleDismissViewer}>
                  <PixelIcon name="close" size={28} color={colors.text.primary} />
                </TouchableOpacity>
                <View style={styles.viewerHeaderCenter}>
                  <View style={styles.viewerDaysBadge}>
                    <Text style={styles.viewerDaysText}>
                      {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
                    </Text>
                  </View>
                  <Text style={styles.viewerPositionText}>
                    {viewerIndex + 1} of {photos.length}
                  </Text>
                </View>
                <View style={styles.viewerCloseButton} />
              </View>

              {/* Footer actions */}
              <View style={[styles.viewerFooter, { paddingBottom: insets.bottom + 16 }]}>
                <TouchableOpacity
                  style={[styles.viewerButton, styles.viewerRestoreButton]}
                  onPress={handleSingleRestore}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <PixelSpinner size="small" color={colors.text.primary} />
                  ) : (
                    <>
                      <PixelIcon name="arrow-undo" size={20} color={colors.text.primary} />
                      <Text style={styles.viewerButtonText}>Restore</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewerButton, styles.viewerDeleteButton]}
                  onPress={handleSingleDelete}
                  disabled={actionLoading}
                >
                  <PixelIcon name="trash" size={20} color={colors.text.primary} />
                  <Text style={styles.viewerButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </ReanimatedView>
          </GestureDetector>
        </GestureHandlerRootView>
      </Modal>
    );
  };

  // Calculate bottom action bar height for content padding
  const ACTION_BAR_HEIGHT = 80; // Approximate height of action bar without safe area

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeHeader}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
              <PixelIcon name="chevron-back" size={28} color={colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Recently Deleted</Text>
            </View>
            <View style={styles.headerButton} />
          </View>
        </SafeAreaView>
        <View style={styles.loadingContainer}>
          <PixelSpinner size="large" color={colors.text.secondary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeHeader}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <PixelIcon name="chevron-back" size={28} color={colors.text.primary} />
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
      </SafeAreaView>

      {/* Content */}
      {photos.length === 0 ? (
        <View style={[styles.emptyContainer, { paddingBottom: tabBarHeight }]}>
          <PixelIcon
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
                  ? tabBarHeight + ACTION_BAR_HEIGHT + 16
                  : tabBarHeight + 20,
            },
          ]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={9}
          maxToRenderPerBatch={6}
          windowSize={5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.brand.purple}
              colors={[colors.brand.purple]}
              progressBackgroundColor={colors.background.secondary}
            />
          }
        />
      )}

      {/* Bottom action bar (multi-select mode) */}
      {multiSelectMode && selectedIds.length > 0 && (
        <View style={[styles.bottomActionBar, { bottom: tabBarHeight, paddingBottom: 16 }]}>
          <TouchableOpacity
            style={[styles.actionButton, styles.restoreButton]}
            onPress={handleBatchRestore}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <PixelSpinner size="small" color={colors.text.primary} />
            ) : (
              <>
                <PixelIcon name="arrow-undo" size={20} color={colors.text.primary} />
                <Text style={styles.actionButtonText}>Restore</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleBatchDelete}
            disabled={actionLoading}
          >
            <PixelIcon name="trash" size={20} color={colors.text.primary} />
            <Text style={styles.actionButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Full-screen viewer modal */}
      {renderViewer()}
    </View>
  );
};

export default RecentlyDeletedScreen;
