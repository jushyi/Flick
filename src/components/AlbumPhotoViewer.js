import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Modal,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Alert,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedModule, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { deleteAlbum } from '../services/firebase';

const ReanimatedView = ReanimatedModule.View;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * AlbumPhotoViewer - Full-screen photo viewer for browsing album photos
 *
 * @param {boolean} visible - Whether modal is visible
 * @param {Array} photos - Array of photo objects with { id, imageURL }
 * @param {number} initialIndex - Starting photo index
 * @param {string} albumId - Album ID for deletion
 * @param {string} albumName - Album name for header
 * @param {boolean} isOwnProfile - Show edit options only for own albums
 * @param {function} onClose - Callback to close viewer
 * @param {function} onRemovePhoto - Callback(photoId) when photo removed
 * @param {function} onSetCover - Callback(photoId) when set as cover
 */
const AlbumPhotoViewer = ({
  visible,
  photos = [],
  initialIndex = 0,
  albumId = '',
  albumName = '',
  isOwnProfile = false,
  onClose,
  onRemovePhoto,
  onSetCover,
}) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [toastVisible, setToastVisible] = useState(false);
  const flatListRef = useRef(null);
  const thumbnailListRef = useRef(null);
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

  // Handle scroll to update position indicator in real-time
  const handleScroll = useCallback(
    event => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const newIndex = Math.round(offsetX / SCREEN_WIDTH);
      // Only update if index changed and is valid
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < photos.length) {
        setCurrentIndex(newIndex);
      }
    },
    [currentIndex, photos.length]
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

  // Handle 3-dot menu press
  const handleMenuPress = useCallback(() => {
    const currentPhoto = photos[currentIndex];
    if (!currentPhoto) return;

    Alert.alert(albumName, 'Photo Options', [
      {
        text: 'Set as Album Cover',
        onPress: () => {
          if (onSetCover) {
            onSetCover(currentPhoto.id);
            showToast();
          }
        },
      },
      {
        text: 'Remove from Album',
        style: 'destructive',
        onPress: () => {
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
                    // If removing last photo in list, go to previous index first
                    if (currentIndex === photos.length - 1 && currentIndex > 0) {
                      goToIndex(currentIndex - 1);
                    }
                    // Remove the photo (parent will refresh data)
                    onRemovePhoto(currentPhoto.id);
                  }
                },
              },
            ]
          );
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [
    photos,
    currentIndex,
    albumId,
    albumName,
    navigation,
    onSetCover,
    onRemovePhoto,
    onClose,
    goToIndex,
    showToast,
  ]);

  // Render individual photo
  const renderPhoto = useCallback(
    ({ item }) => (
      <TouchableOpacity activeOpacity={1} onPress={handleImagePress} style={styles.photoContainer}>
        <Image source={{ uri: item.imageURL }} style={styles.photo} resizeMode="cover" />
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
          source={{ uri: item.imageURL }}
          style={[styles.thumbnail, index === currentIndex && styles.thumbnailActive]}
        />
      </TouchableOpacity>
    ),
    [currentIndex, goToIndex]
  );

  if (!visible || photos.length === 0) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
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
              onScroll={handleScroll}
              scrollEventThrottle={16}
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
                <Ionicons name="close" size={28} color={colors.text.primary} />
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
                  onPress={handleMenuPress}
                  style={styles.headerButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="ellipsis-horizontal" size={24} color={colors.text.primary} />
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
                <Ionicons name="checkmark-circle" size={20} color="#4CD964" />
                <Text style={styles.toastText}>Cover set</Text>
              </Animated.View>
            )}
          </ReanimatedView>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
    paddingHorizontal: 8,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    marginHorizontal: 8,
  },
  albumNameText: {
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: '#333333',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    gap: 8,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  thumbnailBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingTop: 8,
  },
  thumbnailContent: {
    paddingHorizontal: 8,
  },
  thumbnailWrapper: {
    marginHorizontal: 4,
  },
  thumbnail: {
    width: 50,
    height: 67,
    borderRadius: 4,
  },
  thumbnailActive: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});

export default AlbumPhotoViewer;
