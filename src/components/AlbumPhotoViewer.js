import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Alert,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedModule, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import PixelIcon from './PixelIcon';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';
import { deleteAlbum } from '../services/firebase';
import { softDeletePhoto, archivePhoto, restorePhoto } from '../services/firebase/photoService';
import DropdownMenu from './DropdownMenu';

const ReanimatedView = ReanimatedModule.View;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * AlbumPhotoViewer - Full-screen photo viewer for browsing album photos
 *
 * @param {boolean} visible - Whether modal is visible
 * @param {Array} photos - Array of photo objects with { id, imageURL, photoState?, userId? }
 * @param {number} initialIndex - Starting photo index
 * @param {string} albumId - Album ID for deletion (empty for monthly albums)
 * @param {string} albumName - Album name for header
 * @param {boolean} isOwnProfile - Show edit options only for own albums
 * @param {string} currentUserId - Current user's ID for ownership checks
 * @param {function} onClose - Callback to close viewer
 * @param {function} onRemovePhoto - Callback(photoId) when photo removed
 * @param {function} onSetCover - Callback(photoId) when set as cover
 * @param {function} onPhotoStateChanged - Callback when photo archived/deleted/restored
 */
const AlbumPhotoViewer = ({
  visible,
  photos = [],
  initialIndex = 0,
  albumId = '',
  albumName = '',
  isOwnProfile = false,
  currentUserId = '',
  onClose,
  onRemovePhoto,
  onSetCover,
  onPhotoStateChanged,
}) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [toastVisible, setToastVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const flatListRef = useRef(null);
  const thumbnailListRef = useRef(null);
  const menuButtonRef = useRef(null);
  const isUserDragging = useRef(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // Thumbnail dimensions (50x67 for 3:4 ratio)
  const THUMBNAIL_WIDTH = 50;
  const THUMBNAIL_HEIGHT = 67;
  const THUMBNAIL_MARGIN = 4;

  // Swipe down to close gesture
  const translateY = useSharedValue(0);

  const handleDismiss = useCallback(() => {
    onClose?.();
  }, [onClose]);

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
        runOnJS(handleDismiss)();
      } else {
        // Spring back to original position
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Reset translateY when modal opens
  React.useEffect(() => {
    if (visible) {
      translateY.value = 0;
    }
  }, [visible, translateY]);

  // Reset to initial index when modal opens
  React.useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      // Scroll to initial index after a brief delay to ensure FlatList is ready
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: initialIndex,
          animated: false,
        });
        thumbnailListRef.current?.scrollToIndex({
          index: initialIndex,
          animated: false,
          viewPosition: 0.5,
        });
      }, 50);
    }
  }, [visible, initialIndex]);

  // Auto-scroll thumbnail bar when currentIndex changes
  React.useEffect(() => {
    if (visible && photos.length > 0) {
      thumbnailListRef.current?.scrollToIndex({
        index: currentIndex,
        animated: true,
        viewPosition: 0.5,
      });
    }
  }, [currentIndex, visible, photos.length]);

  // Mark beginning of a user-initiated drag so handleScroll can update the index optimistically
  const handleScrollBeginDrag = useCallback(() => {
    isUserDragging.current = true;
  }, []);

  // Optimistically update currentIndex during user swipes so the thumbnail bar tracks the gesture
  const handleScroll = useCallback(
    event => {
      if (!isUserDragging.current) return; // skip programmatic scrolls from goToIndex / edge taps
      const offsetX = event.nativeEvent.contentOffset.x;
      const newIndex = Math.round(offsetX / SCREEN_WIDTH);
      if (newIndex >= 0 && newIndex < photos.length) {
        setCurrentIndex(prevIndex => (prevIndex !== newIndex ? newIndex : prevIndex));
      }
    },
    [photos.length]
  );

  // Handle momentum scroll end for stable index updates (prevents oscillation)
  const handleMomentumScrollEnd = useCallback(
    event => {
      isUserDragging.current = false;
      const offsetX = event.nativeEvent.contentOffset.x;
      const newIndex = Math.round(offsetX / SCREEN_WIDTH);
      if (newIndex >= 0 && newIndex < photos.length) {
        setCurrentIndex(newIndex);
      }
    },
    [photos.length]
  );

  // Navigate to specific index
  const goToIndex = useCallback(
    index => {
      if (index >= 0 && index < photos.length) {
        flatListRef.current?.scrollToIndex({ index, animated: true });
        setCurrentIndex(index);
      }
    },
    [photos.length]
  );

  // Handle tap on edges for navigation
  const handleImagePress = useCallback(
    event => {
      const { locationX } = event.nativeEvent;
      const edgeWidth = SCREEN_WIDTH * 0.25; // 25% of screen width on each edge

      if (locationX < edgeWidth) {
        // Left edge - go to previous
        goToIndex(currentIndex - 1);
      } else if (locationX > SCREEN_WIDTH - edgeWidth) {
        // Right edge - go to next
        goToIndex(currentIndex + 1);
      }
      // Center tap - could toggle header visibility (optional, not implementing)
    },
    [currentIndex, goToIndex]
  );

  // Show toast notification
  const showToast = useCallback(() => {
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
  }, [toastOpacity]);

  // Handle set cover from menu
  const handleSetCover = useCallback(() => {
    const currentPhoto = photos[currentIndex];
    if (!currentPhoto) return;

    if (onSetCover) {
      onSetCover(currentPhoto.id);
      showToast();
    }
  }, [photos, currentIndex, onSetCover, showToast]);

  // Handle remove photo from menu
  const handleRemovePhoto = useCallback(() => {
    const currentPhoto = photos[currentIndex];
    if (!currentPhoto) return;

    // Check if this is the last photo - prompt to delete album instead
    if (photos.length === 1) {
      Alert.alert('Delete Album?', 'Removing the last photo will delete this album.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Album',
          style: 'destructive',
          onPress: async () => {
            if (albumId) {
              await deleteAlbum(albumId);
              onClose?.();
              navigation.navigate('ProfileMain');
            }
          },
        },
      ]);
      return;
    }

    // Show confirmation for non-last photo
    Alert.alert(
      'Remove Photo?',
      'This photo will be removed from the album but will still be in your library.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            if (onRemovePhoto) {
              onRemovePhoto(currentPhoto.id);
              // Close viewer and return to album grid
              onClose?.();
            }
          },
        },
      ]
    );
  }, [photos, currentIndex, albumId, navigation, onRemovePhoto, onClose]);

  // Open menu with anchor position
  const handleOpenMenu = () => {
    if (menuButtonRef.current) {
      menuButtonRef.current.measure((x, y, width, height, pageX, pageY) => {
        setMenuAnchor({ x: pageX, y: pageY, width, height });
        setMenuVisible(true);
      });
    } else {
      setMenuVisible(true);
    }
  };

  // Handle archive photo
  const handleArchive = useCallback(() => {
    const currentPhoto = photos[currentIndex];
    if (!currentPhoto) return;

    setMenuVisible(false);
    Alert.alert(
      'Remove from Journal',
      'This photo will be hidden from your stories and feed but remain in your albums. You can restore it anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          onPress: async () => {
            const result = await archivePhoto(currentPhoto.id, currentUserId);
            if (result.success) {
              onPhotoStateChanged?.();
              onClose?.();
            } else {
              Alert.alert('Error', result.error || 'Failed to archive photo');
            }
          },
        },
      ]
    );
  }, [photos, currentIndex, currentUserId, onPhotoStateChanged, onClose]);

  // Handle restore photo
  const handleRestore = useCallback(async () => {
    const currentPhoto = photos[currentIndex];
    if (!currentPhoto) return;

    setMenuVisible(false);
    const result = await restorePhoto(currentPhoto.id, currentUserId);
    if (result.success) {
      onPhotoStateChanged?.();
      Alert.alert('Restored', 'Photo has been restored to your journal.');
    } else {
      Alert.alert('Error', result.error || 'Failed to restore photo');
    }
  }, [photos, currentIndex, currentUserId, onPhotoStateChanged]);

  // Handle delete photo (soft delete with 30-day grace period)
  const handleDelete = useCallback(() => {
    const currentPhoto = photos[currentIndex];
    if (!currentPhoto) return;

    setMenuVisible(false);
    Alert.alert(
      'Delete Photo',
      'This photo will be moved to Recently Deleted. You can restore it within 30 days from Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await softDeletePhoto(currentPhoto.id, currentUserId);
            if (result.success) {
              onPhotoStateChanged?.();
              onClose?.();
            } else {
              Alert.alert('Error', result.error || 'Failed to delete photo');
            }
          },
        },
      ]
    );
  }, [photos, currentIndex, currentUserId, onPhotoStateChanged, onClose]);

  // Build menu options based on context
  const menuOptions = React.useMemo(() => {
    const currentPhoto = photos[currentIndex];
    const options = [];

    // Album-specific options (only if albumId exists - not for monthly albums)
    if (albumId) {
      options.push({
        label: 'Set as Album Cover',
        icon: 'image-outline',
        onPress: handleSetCover,
      });
      options.push({
        label: 'Remove from Album',
        icon: 'close-circle-outline',
        onPress: handleRemovePhoto,
      });
    }

    // Photo state options (for own photos)
    if (currentPhoto && isOwnProfile && currentUserId) {
      if (currentPhoto.photoState === 'journal') {
        options.push({
          label: 'Remove from Journal',
          icon: 'archive-outline',
          onPress: handleArchive,
        });
      } else if (currentPhoto.photoState === 'archive') {
        options.push({
          label: 'Restore to Journal',
          icon: 'refresh-outline',
          onPress: handleRestore,
        });
      }

      options.push({
        label: 'Delete',
        icon: 'trash-outline',
        onPress: handleDelete,
        destructive: true,
      });
    }

    return options;
  }, [
    photos,
    currentIndex,
    albumId,
    isOwnProfile,
    currentUserId,
    handleSetCover,
    handleRemovePhoto,
    handleArchive,
    handleRestore,
    handleDelete,
  ]);

  // Render individual photo
  const renderPhoto = useCallback(
    ({ item }) => (
      <TouchableOpacity activeOpacity={1} onPress={handleImagePress} style={styles.photoContainer}>
        <Image
          source={{ uri: item.imageURL, cacheKey: `photo-${item.id}` }}
          style={styles.photo}
          contentFit="contain"
          cachePolicy="memory-disk"
          priority="high"
        />
      </TouchableOpacity>
    ),
    [handleImagePress]
  );

  // Get item layout for FlatList optimization
  const getItemLayout = useCallback(
    (_, index) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    []
  );

  // Get thumbnail layout for optimization
  const getThumbnailLayout = useCallback(
    (_, index) => ({
      length: THUMBNAIL_WIDTH + THUMBNAIL_MARGIN * 2,
      offset: (THUMBNAIL_WIDTH + THUMBNAIL_MARGIN * 2) * index,
      index,
    }),
    [THUMBNAIL_WIDTH, THUMBNAIL_MARGIN]
  );

  // Render thumbnail item
  const renderThumbnail = useCallback(
    ({ item, index }) => (
      <TouchableOpacity
        onPress={() => goToIndex(index)}
        activeOpacity={0.8}
        style={styles.thumbnailWrapper}
      >
        <Image
          source={{ uri: item.imageURL, cacheKey: `photo-${item.id}` }}
          style={[styles.thumbnail, index === currentIndex && styles.thumbnailActive]}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="low"
          recyclingKey={`thumb-${item.id}`}
          transition={100}
        />
      </TouchableOpacity>
    ),
    [currentIndex, goToIndex]
  );

  if (!visible || photos.length === 0) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'transparent' }}>
        <GestureDetector gesture={panGesture}>
          <ReanimatedView style={[styles.container, animatedStyle]}>
            {/* Photo viewer - fills entire screen */}
            <FlatList
              ref={flatListRef}
              data={photos}
              renderItem={renderPhoto}
              keyExtractor={item => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScrollBeginDrag={handleScrollBeginDrag}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              getItemLayout={getItemLayout}
              initialScrollIndex={initialIndex}
              onScrollToIndexFailed={info => {
                // Fallback if scrollToIndex fails
                setTimeout(() => {
                  flatListRef.current?.scrollToIndex({
                    index: info.index,
                    animated: false,
                  });
                }, 100);
              }}
            />

            {/* Header overlay */}
            <View style={[styles.header, { paddingTop: insets.top }]}>
              {/* Close button */}
              <TouchableOpacity onPress={onClose} style={styles.headerButton} activeOpacity={0.7}>
                <PixelIcon name="close" size={28} color={colors.text.primary} />
              </TouchableOpacity>

              {/* Album name + position */}
              <View style={styles.headerCenter}>
                <Text style={styles.albumNameText} numberOfLines={1}>
                  {albumName} • {currentIndex + 1} of {photos.length}
                </Text>
              </View>

              {/* 3-dot menu (only for own profile) */}
              {isOwnProfile ? (
                <TouchableOpacity
                  ref={menuButtonRef}
                  onPress={handleOpenMenu}
                  style={styles.headerButton}
                  activeOpacity={0.7}
                >
                  <PixelIcon name="ellipsis-horizontal" size={24} color={colors.text.primary} />
                </TouchableOpacity>
              ) : (
                <View style={styles.headerButton} />
              )}
            </View>

            {/* Thumbnail navigation bar */}
            <View style={[styles.thumbnailBar, { paddingBottom: insets.bottom + 8 }]}>
              <FlatList
                ref={thumbnailListRef}
                data={photos}
                renderItem={renderThumbnail}
                keyExtractor={item => `thumb-${item.id}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                getItemLayout={getThumbnailLayout}
                contentContainerStyle={styles.thumbnailContent}
                initialNumToRender={10}
                maxToRenderPerBatch={5}
                windowSize={7}
                onScrollToIndexFailed={() => {
                  // Silently handle scroll failure
                }}
              />
            </View>

            {/* Toast notification */}
            {toastVisible && (
              <Animated.View
                style={[styles.toast, { opacity: toastOpacity, bottom: insets.bottom + 100 }]}
              >
                <PixelIcon name="checkmark-circle" size={20} color={colors.status.ready} />
                <Text style={styles.toastText}>Cover set</Text>
              </Animated.View>
            )}

            {/* Dropdown menu for photo options */}
            <DropdownMenu
              visible={menuVisible}
              onClose={() => setMenuVisible(false)}
              options={menuOptions}
              anchorPosition={menuAnchor}
            />
          </ReanimatedView>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
    backgroundColor: colors.overlay.dark,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  albumNameText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  photoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
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
    fontFamily: typography.fontFamily.body,
  },
  thumbnailBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.overlay.dark,
    paddingTop: spacing.xs,
  },
  thumbnailContent: {
    paddingHorizontal: spacing.xs,
  },
  thumbnailWrapper: {
    marginHorizontal: spacing.xxs,
  },
  thumbnail: {
    width: 50,
    height: 67,
    borderRadius: layout.borderRadius.md,
  },
  thumbnailActive: {
    borderWidth: 2,
    borderColor: colors.text.primary,
  },
});

export default AlbumPhotoViewer;
