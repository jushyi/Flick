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
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * AlbumPhotoViewer - Full-screen photo viewer for browsing album photos
 *
 * @param {boolean} visible - Whether modal is visible
 * @param {Array} photos - Array of photo objects with { id, imageURL }
 * @param {number} initialIndex - Starting photo index
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
  albumName = '',
  isOwnProfile = false,
  onClose,
  onRemovePhoto,
  onSetCover,
}) => {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [toastVisible, setToastVisible] = useState(false);
  const flatListRef = useRef(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

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
      }, 50);
    }
  }, [visible, initialIndex]);

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
          // Show confirmation
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
                    // If removing current photo and it's the last one, close viewer
                    if (photos.length === 1) {
                      onClose?.();
                    } else if (currentIndex === photos.length - 1) {
                      // If removing last photo in list, go to previous
                      goToIndex(currentIndex - 1);
                    }
                  }
                },
              },
            ]
          );
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [photos, currentIndex, albumName, onSetCover, onRemovePhoto, onClose, goToIndex, showToast]);

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

  if (!visible || photos.length === 0) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
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

        {/* Toast notification */}
        {toastVisible && (
          <Animated.View
            style={[styles.toast, { opacity: toastOpacity, bottom: insets.bottom + 20 }]}
          >
            <Ionicons name="checkmark-circle" size={20} color="#4CD964" />
            <Text style={styles.toastText}>Cover set</Text>
          </Animated.View>
        )}
      </View>
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
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333333',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default AlbumPhotoViewer;
