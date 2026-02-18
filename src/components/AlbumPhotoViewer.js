import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
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
  PanResponder,
  Easing,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import PixelIcon from './PixelIcon';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';
import { deleteAlbum } from '../services/firebase';
import { softDeletePhoto, archivePhoto, restorePhoto } from '../services/firebase/photoService';
import DropdownMenu from './DropdownMenu';

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
 * @param {object} sourceRect - Source card position for expand/collapse animation { x, y, width, height }
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
  sourceRect,
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

  // Ref to always access the latest photos array in async callbacks (setTimeout, etc.)
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  // Thumbnail dimensions (50x67 for 3:4 ratio)
  const THUMBNAIL_WIDTH = 50;
  const THUMBNAIL_MARGIN = 4;

  // Expand/collapse animation values (matching stories pattern)
  const translateY = useRef(new Animated.Value(0)).current;
  const viewerOpacity = useRef(new Animated.Value(0)).current;
  const openProgress = useRef(new Animated.Value(0)).current;
  const dismissScale = useRef(new Animated.Value(1)).current;
  const suckTranslateX = useRef(new Animated.Value(0)).current;

  // Source rect ref for close animation (stable across re-renders)
  const sourceRectRef = useRef(sourceRect);
  sourceRectRef.current = sourceRect;

  // Compute source transform from sourceRect
  const sourceTransform = useMemo(() => {
    if (!sourceRect) return null;
    const scaleX = sourceRect.width / SCREEN_WIDTH;
    const scaleY = sourceRect.height / SCREEN_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    const sourceCenterX = sourceRect.x + sourceRect.width / 2;
    const sourceCenterY = sourceRect.y + sourceRect.height / 2;
    return {
      scale,
      translateX: sourceCenterX - SCREEN_WIDTH / 2,
      translateY: sourceCenterY - SCREEN_HEIGHT / 2,
    };
  }, [sourceRect]);

  // Compute combined expand/collapse + dismiss transforms
  const expandScale = useMemo(() => {
    if (!sourceTransform) return dismissScale;
    return Animated.multiply(
      openProgress.interpolate({ inputRange: [0, 1], outputRange: [sourceTransform.scale, 1] }),
      dismissScale
    );
  }, [sourceTransform, openProgress, dismissScale]);

  const expandTranslateX = useMemo(() => {
    if (!sourceTransform) return suckTranslateX;
    return Animated.add(
      openProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [sourceTransform.translateX, 0],
      }),
      suckTranslateX
    );
  }, [sourceTransform, openProgress, suckTranslateX]);

  const expandTranslateY = useMemo(() => {
    if (!sourceTransform) return translateY;
    return Animated.add(
      openProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [sourceTransform.translateY, 0],
      }),
      translateY
    );
  }, [sourceTransform, openProgress, translateY]);

  // Opening animation - expand from source card to full screen
  const hasAnimatedOpen = useRef(false);
  useEffect(() => {
    if (visible && sourceTransform && !hasAnimatedOpen.current) {
      hasAnimatedOpen.current = true;
      openProgress.setValue(0);
      viewerOpacity.setValue(0);
      dismissScale.setValue(1);
      suckTranslateX.setValue(0);
      translateY.setValue(0);

      Animated.parallel([
        Animated.spring(openProgress, {
          toValue: 1,
          tension: 180,
          friction: 16,
          useNativeDriver: true,
        }),
        Animated.timing(viewerOpacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (visible && !sourceTransform && !hasAnimatedOpen.current) {
      // No source rect - instant show
      hasAnimatedOpen.current = true;
      openProgress.setValue(1);
      viewerOpacity.setValue(1);
    }
    if (!visible) {
      hasAnimatedOpen.current = false;
    }
  }, [visible, sourceTransform]);

  /**
   * Close with animation - suck-back to source or slide-down fallback
   */
  const closeWithAnimation = useCallback(() => {
    const source = sourceRectRef.current;
    const transform = source
      ? {
          scale: Math.min(source.width / SCREEN_WIDTH, source.height / SCREEN_HEIGHT),
          translateX: source.x + source.width / 2 - SCREEN_WIDTH / 2,
          translateY: source.y + source.height / 2 - SCREEN_HEIGHT / 2,
        }
      : null;

    const resetAll = () => {
      setTimeout(() => {
        translateY.setValue(0);
        viewerOpacity.setValue(0);
        openProgress.setValue(0);
        dismissScale.setValue(1);
        suckTranslateX.setValue(0);
      }, 100);
    };

    if (!transform) {
      // Fallback: slide down + fade
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(viewerOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onClose?.();
        resetAll();
      });
      return;
    }

    // Suck-back to source position
    const suckDuration = 200;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: transform.translateY,
        duration: suckDuration,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(suckTranslateX, {
        toValue: transform.translateX,
        duration: suckDuration,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dismissScale, {
        toValue: transform.scale,
        duration: suckDuration,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(viewerOpacity, {
        toValue: 0,
        duration: suckDuration,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose?.();
      resetAll();
    });
  }, [translateY, viewerOpacity, openProgress, dismissScale, suckTranslateX, onClose]);

  /**
   * Spring back to original position (cancelled swipe)
   */
  const springBack = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(viewerOpacity, {
        toValue: 1,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(dismissScale, {
        toValue: 1,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, viewerOpacity, dismissScale]);

  // Store closeWithAnimation in ref for panResponder access
  const closeWithAnimationRef = useRef(closeWithAnimation);
  useEffect(() => {
    closeWithAnimationRef.current = closeWithAnimation;
  }, [closeWithAnimation]);

  const springBackRef = useRef(springBack);
  useEffect(() => {
    springBackRef.current = springBack;
  }, [springBack]);

  // Gesture axis lock - once determined vertical, stays locked
  const gestureLockRef = useRef(null);
  const verticalDirectionRef = useRef(null);

  /**
   * PanResponder for swipe-down-to-dismiss gesture
   * Only captures vertical downward swipes to avoid interfering with horizontal FlatList
   */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        if (isVerticalSwipe) {
          return gestureState.dy > 5;
        }
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        if (isVerticalSwipe) {
          return gestureState.dy > 5;
        }
        return false;
      },
      onPanResponderMove: (_, gestureState) => {
        const { dy } = gestureState;

        // If already locked to vertical
        if (gestureLockRef.current === 'vertical') {
          if (verticalDirectionRef.current === 'down') {
            const clampedDy = Math.max(0, dy);
            translateY.setValue(clampedDy);
            const dragRatio = Math.min(1, clampedDy / SCREEN_HEIGHT);
            dismissScale.setValue(1 - dragRatio * 0.15);
            const fadeAmount = Math.max(0, 1 - dragRatio * 0.8);
            viewerOpacity.setValue(fadeAmount);
          }
          return;
        }

        // Lock axis on first significant movement
        const absDy = Math.abs(dy);
        const absDx = Math.abs(gestureState.dx);
        if (absDy > absDx && absDy > 5) {
          gestureLockRef.current = 'vertical';
          verticalDirectionRef.current = dy > 0 ? 'down' : 'up';
        }

        if (gestureLockRef.current === 'vertical' && verticalDirectionRef.current === 'down') {
          const clampedDy = Math.max(0, dy);
          translateY.setValue(clampedDy);
          const dragRatio = Math.min(1, clampedDy / SCREEN_HEIGHT);
          dismissScale.setValue(1 - dragRatio * 0.15);
          const fadeAmount = Math.max(0, 1 - dragRatio * 0.8);
          viewerOpacity.setValue(fadeAmount);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dy, vy } = gestureState;
        const gestureDir = verticalDirectionRef.current;

        // Reset gesture lock
        gestureLockRef.current = null;
        verticalDirectionRef.current = null;

        if (gestureDir === 'down') {
          const dismissThreshold = SCREEN_HEIGHT / 3;
          if (dy > dismissThreshold || vy > 0.5) {
            closeWithAnimationRef.current();
          } else {
            springBackRef.current();
          }
          return;
        }

        // Fallback: spring back
        springBackRef.current();
      },
      onPanResponderTerminate: () => {
        gestureLockRef.current = null;
        verticalDirectionRef.current = null;
      },
    })
  ).current;

  // Reset to initial index when modal opens
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      // Fallback scroll in case onLayout fires before initialIndex is set.
      // Use a longer delay (200ms) to cover Android Modal rendering latency.
      setTimeout(() => {
        const currentPhotos = photosRef.current;
        if (!currentPhotos || currentPhotos.length === 0) return;
        const safeIndex = Math.min(initialIndex, currentPhotos.length - 1);
        if (safeIndex < 0) return;
        flatListRef.current?.scrollToIndex({
          index: safeIndex,
          animated: false,
        });
        scrollThumbnailTo(safeIndex, false);
      }, 200);
    }
  }, [visible, initialIndex, scrollThumbnailTo]);

  // Clamp currentIndex if photos shrinks while viewer is open (race condition guard)
  useEffect(() => {
    if (visible && photos.length > 0 && currentIndex >= photos.length) {
      setCurrentIndex(photos.length - 1);
    }
  }, [visible, photos.length, currentIndex]);

  // Auto-scroll thumbnail bar when currentIndex changes (during swiping)
  useEffect(() => {
    if (visible && photos.length > 0) {
      scrollThumbnailTo(currentIndex, true);
    }
  }, [currentIndex, visible, photos.length, scrollThumbnailTo]);

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

    setMenuVisible(false);
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
              onPhotoStateChanged?.(currentPhoto.id);
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

  // Scroll thumbnail strip to center a specific index using scrollToOffset (more reliable
  // than scrollToIndex on Android, especially inside a Modal).
  const THUMB_ITEM_WIDTH = THUMBNAIL_WIDTH + THUMBNAIL_MARGIN * 2; // 58px
  const THUMB_CONTENT_PADDING = spacing.xs; // 8px (from contentContainerStyle paddingHorizontal)
  const scrollThumbnailTo = useCallback(
    (index, animated) => {
      const totalItems = photosRef.current.length;
      if (totalItems === 0 || !thumbnailListRef.current) return;
      const itemStart = THUMB_CONTENT_PADDING + index * THUMB_ITEM_WIDTH;
      const centeredOffset = itemStart - (SCREEN_WIDTH - THUMB_ITEM_WIDTH) / 2;
      const maxOffset = Math.max(
        0,
        totalItems * THUMB_ITEM_WIDTH + THUMB_CONTENT_PADDING * 2 - SCREEN_WIDTH
      );
      const offset = Math.max(0, Math.min(centeredOffset, maxOffset));
      thumbnailListRef.current.scrollToOffset({ offset, animated });
    },
    [THUMB_ITEM_WIDTH, THUMB_CONTENT_PADDING]
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
        />
      </TouchableOpacity>
    ),
    [currentIndex, goToIndex]
  );

  if (!visible || photos.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={closeWithAnimation}
    >
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        {/* Background overlay - fades independently */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.background.primary, opacity: viewerOpacity },
          ]}
        />

        {/* Expand/collapse wrapper */}
        <Animated.View
          style={{
            flex: 1,
            overflow: 'hidden',
            opacity: viewerOpacity,
            transform: [
              { translateX: expandTranslateX },
              { translateY: expandTranslateY },
              { scale: expandScale },
            ],
          }}
        >
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
              // Clamp retry index to current photos bounds to avoid a second failure
              const safeIndex = Math.min(info.index, photosRef.current.length - 1);
              if (safeIndex >= 0) {
                setTimeout(() => {
                  flatListRef.current?.scrollToIndex({
                    index: safeIndex,
                    animated: false,
                  });
                }, 100);
              }
            }}
          />

          {/* Header overlay */}
          <View style={[styles.header, { paddingTop: insets.top }]}>
            {/* Close button */}
            <TouchableOpacity
              onPress={closeWithAnimation}
              style={styles.headerButton}
              activeOpacity={0.7}
            >
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
              windowSize={21}
              removeClippedSubviews={false}
              onLayout={() => scrollThumbnailTo(currentIndex, false)}
              onScrollToIndexFailed={info => {
                const safeIndex = Math.min(info.index, photosRef.current.length - 1);
                if (safeIndex >= 0) {
                  setTimeout(() => {
                    scrollThumbnailTo(safeIndex, false);
                  }, 100);
                }
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
        </Animated.View>
      </View>
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
    zIndex: 10,
    elevation: 10,
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
