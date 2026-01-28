import React, { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import { colors } from '../constants/colors';
import logger from '../utils/logger';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MAX_SELECTS = 10;
const THUMBNAIL_SIZE = 56;
const THUMBNAIL_GAP = 8;
const PREVIEW_ASPECT_RATIO = 3 / 4; // Taller preview (was 4/5)
const SCREEN_PADDING = 24;
const DELETE_BAR_HEIGHT = 48;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// DraggableThumbnail component - reused from SelectsScreen
const DraggableThumbnail = ({
  photo,
  photoId,
  index,
  isSelected,
  onPress,
  onDragStart,
  onDragEnd,
  onDragMove,
  onReorder,
  onDelete,
  isDraggingAny,
  draggingIndex,
  totalPhotos,
  deleteZoneY,
  hoverIndex,
  onHoverIndexChange,
  isOverDeleteZone,
}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const shiftX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const pendingReorderRef = useRef(null);
  const prevIndexRef = useRef(index);

  useEffect(() => {
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    cancelAnimation(shiftX);
    cancelAnimation(scale);
    translateX.value = 0;
    translateY.value = 0;
    shiftX.value = 0;
    scale.value = 1;
    opacity.value = 1;
  }, [photoId]);

  useLayoutEffect(() => {
    if (pendingReorderRef.current !== null && prevIndexRef.current !== index) {
      const { savedTranslateX, savedTranslateY, slotShift } = pendingReorderRef.current;
      translateX.value = savedTranslateX - slotShift;
      translateY.value = savedTranslateY;

      translateX.value = withTiming(0, { duration: 220 });
      translateY.value = withTiming(0, { duration: 220 });
      opacity.value = withTiming(1, { duration: 150 });

      pendingReorderRef.current = null;
    }
    prevIndexRef.current = index;
  }, [index]);

  useEffect(() => {
    if (draggingIndex === null) {
      shiftX.value = 0;
      return;
    }

    if (isOverDeleteZone || hoverIndex === null || draggingIndex === index) {
      shiftX.value = withTiming(0, { duration: 200 });
      return;
    }

    const shiftAmount = THUMBNAIL_SIZE + THUMBNAIL_GAP;

    if (draggingIndex < hoverIndex) {
      if (index > draggingIndex && index <= hoverIndex) {
        shiftX.value = withTiming(-shiftAmount, { duration: 200 });
      } else {
        shiftX.value = withTiming(0, { duration: 200 });
      }
    } else if (draggingIndex > hoverIndex) {
      if (index >= hoverIndex && index < draggingIndex) {
        shiftX.value = withTiming(shiftAmount, { duration: 200 });
      } else {
        shiftX.value = withTiming(0, { duration: 200 });
      }
    } else {
      shiftX.value = withTiming(0, { duration: 200 });
    }
  }, [isOverDeleteZone, hoverIndex, draggingIndex, index, shiftX]);

  const calculateTargetIndex = useCallback(
    currentX => {
      'worklet';
      const movement = currentX / (THUMBNAIL_SIZE + THUMBNAIL_GAP);
      let targetIndex = index + Math.round(movement);
      targetIndex = Math.max(0, Math.min(targetIndex, totalPhotos - 1));
      return targetIndex;
    },
    [index, totalPhotos]
  );

  const storePendingReorder = useCallback(info => {
    pendingReorderRef.current = info;
  }, []);

  const gesture = Gesture.Pan()
    .activateAfterLongPress(200)
    .onStart(() => {
      scale.value = withSpring(1.1);
      zIndex.value = 1000;
      runOnJS(onDragStart)(index);
      runOnJS(onHoverIndexChange)(index);
    })
    .onUpdate(event => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      const isOverDelete = deleteZoneY > 0 && event.absoluteY >= deleteZoneY;
      runOnJS(onDragMove)(isOverDelete);
      if (isOverDelete) {
        runOnJS(onHoverIndexChange)(null);
      } else {
        const targetIndex = calculateTargetIndex(translateX.value);
        runOnJS(onHoverIndexChange)(targetIndex);
      }
    })
    .onEnd(event => {
      const isOverDelete = deleteZoneY > 0 && event.absoluteY >= deleteZoneY;
      const targetIndex = calculateTargetIndex(translateX.value);
      const didReorder = !isOverDelete && targetIndex !== index;

      if (isOverDelete) {
        translateX.value = 0;
        translateY.value = 0;
        scale.value = 1;
        zIndex.value = 0;
        runOnJS(onDelete)(index);
        runOnJS(onHoverIndexChange)(null);
        runOnJS(onDragEnd)();
      } else if (didReorder) {
        const slotShift = (targetIndex - index) * (THUMBNAIL_SIZE + THUMBNAIL_GAP);

        runOnJS(storePendingReorder)({
          savedTranslateX: translateX.value,
          savedTranslateY: translateY.value,
          slotShift,
        });

        opacity.value = withTiming(0.4, { duration: 30 });
        scale.value = withTiming(1, { duration: 150 });
        zIndex.value = 0;
        runOnJS(onHoverIndexChange)(null);
        runOnJS(onReorder)(index, targetIndex);
        runOnJS(onDragEnd)();
      } else {
        translateX.value = withTiming(0, { duration: 150 });
        translateY.value = withTiming(0, { duration: 150 });
        scale.value = withTiming(1, { duration: 150 });
        zIndex.value = 0;
        runOnJS(onHoverIndexChange)(null);
        runOnJS(onDragEnd)();
      }
    })
    .onFinalize(() => {});

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value + shiftX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
  }));

  const opacityStyle = useAnimatedStyle(() => {
    const baseOpacity = isDraggingAny && draggingIndex !== index ? 0.6 : 1;
    return { opacity: baseOpacity * opacity.value };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.thumbnailSlot,
          styles.thumbnailFilled,
          animatedStyle,
          opacityStyle,
          isSelected && styles.thumbnailSelected,
        ]}
      >
        <TouchableOpacity style={styles.thumbnailTouchable} onPress={onPress} activeOpacity={0.7}>
          <Image source={{ uri: photo.uri }} style={styles.thumbnailImage} />
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
};

// DeleteBar component - reused from SelectsScreen
const DeleteBar = ({ isVisible, isHovering }) => {
  const translateY = useSharedValue(DELETE_BAR_HEIGHT + 20);
  const barScale = useSharedValue(1);

  React.useEffect(() => {
    translateY.value = withTiming(isVisible ? 0 : DELETE_BAR_HEIGHT + 20, { duration: 200 });
  }, [isVisible, translateY]);

  React.useEffect(() => {
    barScale.value = withSpring(isHovering ? 1.05 : 1);
  }, [isHovering, barScale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: barScale.value }],
  }));

  return (
    <Animated.View
      style={[styles.deleteBar, animatedStyle, isHovering && styles.deleteBarHovering]}
    >
      <Ionicons
        name="trash-outline"
        size={20}
        color={colors.text.primary}
        style={styles.deleteBarIcon}
      />
      <Text style={styles.deleteBarText}>
        {isHovering ? 'Release to delete' : 'Drop to remove'}
      </Text>
    </Animated.View>
  );
};

/**
 * SelectsEditOverlay - Edit overlay for own profile selects
 *
 * @param {boolean} visible - Whether overlay is visible
 * @param {Array} selects - Array of photo URIs
 * @param {function} onSave - Callback with new selects array when saved
 * @param {function} onClose - Callback when overlay is closed without saving
 */
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100; // Minimum swipe distance to trigger close

const SelectsEditOverlay = ({ visible, selects = [], onSave, onClose }) => {
  // Get safe area insets for explicit positioning (fixes first-render issue with SafeAreaView edges)
  const insets = useSafeAreaInsets();

  // Convert URI array to photo objects for state management
  const initializePhotos = useCallback(uris => {
    return uris.map((uri, index) => ({
      uri,
      assetId: `existing_${index}_${Date.now()}`,
    }));
  }, []);

  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [isOverDeleteZone, setIsOverDeleteZone] = useState(false);
  const [deleteZoneY, setDeleteZoneY] = useState(0);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const [initialSelects, setInitialSelects] = useState([]);

  // Swipe-to-dismiss animation
  const translateY = useSharedValue(0);

  // Initialize photos when overlay opens
  useEffect(() => {
    if (visible) {
      const photos = initializePhotos(selects);
      setSelectedPhotos(photos);
      setInitialSelects(selects); // Store initial state for comparison
      setSelectedIndex(0);
      setIsDragging(false);
      setDraggingIndex(null);
      setIsOverDeleteZone(false);
      setHoverIndex(null);
      setSaving(false);
      translateY.value = 0;
    }
  }, [visible, selects, initializePhotos, translateY]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    const currentUris = selectedPhotos.map(p => p.uri);
    // Different length means changes
    if (currentUris.length !== initialSelects.length) return true;
    // Different order or content means changes
    return currentUris.some((uri, index) => uri !== initialSelects[index]);
  }, [selectedPhotos, initialSelects]);

  const handleDeleteZoneLayout = useCallback(event => {
    event.target.measureInWindow((x, windowY) => {
      setDeleteZoneY(windowY);
    });
  }, []);

  // Calculate preview dimensions
  const previewWidth = SCREEN_WIDTH - SCREEN_PADDING * 2;
  const previewHeight = previewWidth / PREVIEW_ASPECT_RATIO;

  // Single photo picker for thumbnail slots
  const handlePickSinglePhoto = async () => {
    logger.debug('SelectsEditOverlay: Opening single photo picker');

    if (selectedPhotos.length >= MAX_SELECTS) {
      Alert.alert('Maximum Reached', `You can only select up to ${MAX_SELECTS} photos`);
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const photoId = asset.assetId || asset.uri;

      const isDuplicate = selectedPhotos.some(p => (p.assetId || p.uri) === photoId);

      if (isDuplicate) {
        Alert.alert('Already Added', 'This photo is already in your highlights');
        return;
      }

      logger.info('SelectsEditOverlay: Photo selected', { uri: asset.uri });

      const newPhoto = {
        uri: asset.uri,
        assetId: photoId,
      };

      setSelectedPhotos(prev => {
        const newPhotos = [...prev, newPhoto];
        setSelectedIndex(newPhotos.length - 1);
        return newPhotos;
      });
    }
  };

  const handleRemovePhoto = useCallback(
    index => {
      logger.debug('SelectsEditOverlay: Removing photo', { index });

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      setSelectedPhotos(prev => {
        const newPhotos = prev.filter((_, i) => i !== index);
        if (newPhotos.length === 0) {
          setSelectedIndex(0);
        } else if (selectedIndex >= newPhotos.length) {
          setSelectedIndex(newPhotos.length - 1);
        } else if (selectedIndex > index) {
          setSelectedIndex(selectedIndex - 1);
        }
        return newPhotos;
      });
    },
    [selectedIndex]
  );

  const handleReorder = useCallback(
    (fromIndex, toIndex) => {
      logger.debug('SelectsEditOverlay: Reordering photo', { fromIndex, toIndex });

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      setSelectedPhotos(prev => {
        const newPhotos = [...prev];
        const [movedItem] = newPhotos.splice(fromIndex, 1);
        newPhotos.splice(toIndex, 0, movedItem);
        return newPhotos;
      });

      if (selectedIndex === fromIndex) {
        setSelectedIndex(toIndex);
      } else if (fromIndex < selectedIndex && toIndex >= selectedIndex) {
        setSelectedIndex(selectedIndex - 1);
      } else if (fromIndex > selectedIndex && toIndex <= selectedIndex) {
        setSelectedIndex(selectedIndex + 1);
      }
    },
    [selectedIndex]
  );

  const handleDragStart = useCallback(index => {
    setIsDragging(true);
    setDraggingIndex(index);
    setSelectedIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDraggingIndex(null);
    setIsOverDeleteZone(false);
  }, []);

  const handleDragMove = useCallback(isOverDelete => {
    setIsOverDeleteZone(isOverDelete);
  }, []);

  const handleHoverIndexChange = useCallback(newHoverIndex => {
    setHoverIndex(newHoverIndex);
  }, []);

  const handleThumbnailPress = index => {
    if (index < selectedPhotos.length) {
      setSelectedIndex(index);
    } else {
      handlePickSinglePhoto();
    }
  };

  const handleSave = useCallback(() => {
    setSaving(true);
    const selectsData = selectedPhotos.map(photo => photo.uri);
    logger.info('SelectsEditOverlay: Saving selects', { count: selectsData.length });
    if (onSave) {
      onSave(selectsData);
    }
  }, [selectedPhotos, onSave]);

  // Attempt to close - check for unsaved changes first
  const attemptClose = useCallback(() => {
    if (hasUnsavedChanges()) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to close without saving?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              if (onClose) onClose();
            },
          },
        ]
      );
    } else {
      if (onClose) onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  // Handle swipe threshold reached - check changes and decide action
  const handleSwipeThreshold = useCallback(() => {
    if (hasUnsavedChanges()) {
      // Bounce back first, then show alert
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      // Show confirmation after bounce back starts
      setTimeout(() => {
        Alert.alert(
          'Discard Changes?',
          'You have unsaved changes. Are you sure you want to close without saving?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => {
                if (onClose) onClose();
              },
            },
          ]
        );
      }, 100);
    } else {
      // No changes - animate out and close
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 }, () => {
        runOnJS(onClose)();
      });
    }
  }, [hasUnsavedChanges, translateY, onClose]);

  // Swipe-to-dismiss gesture
  const swipeGesture = Gesture.Pan()
    .onUpdate(event => {
      // Only allow downward swipe
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd(event => {
      if (event.translationY > SWIPE_THRESHOLD) {
        // Swipe threshold reached - check for unsaved changes
        runOnJS(handleSwipeThreshold)();
      } else {
        // Bounce back
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  // Animated style for swipe-to-dismiss
  const swipeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleCancel = useCallback(() => {
    attemptClose();
  }, [attemptClose]);

  // Render empty preview placeholder
  const renderEmptyPreview = () => (
    <TouchableOpacity
      style={[styles.previewEmpty, { width: previewWidth, height: previewHeight }]}
      onPress={handlePickSinglePhoto}
      activeOpacity={0.8}
    >
      <Ionicons name="images-outline" size={64} color={colors.text.secondary} />
      <Text style={styles.previewEmptyText}>Tap to add photos</Text>
    </TouchableOpacity>
  );

  // Render preview with photo
  const renderPreviewPhoto = () => (
    <Image
      source={{ uri: selectedPhotos[selectedIndex]?.uri }}
      style={[styles.previewImage, { width: previewWidth, height: previewHeight }]}
      resizeMode="cover"
    />
  );

  // Render thumbnail slot
  const renderThumbnailSlot = index => {
    const hasPhoto = index < selectedPhotos.length;
    const isSelected = hasPhoto && index === selectedIndex;

    if (hasPhoto) {
      const photo = selectedPhotos[index];
      const photoKey = photo.assetId || photo.uri;
      return (
        <DraggableThumbnail
          key={photoKey}
          photo={photo}
          photoId={photo.assetId || photo.uri}
          index={index}
          isSelected={isSelected}
          onPress={() => handleThumbnailPress(index)}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragMove={handleDragMove}
          onReorder={handleReorder}
          onDelete={handleRemovePhoto}
          isDraggingAny={isDragging}
          draggingIndex={draggingIndex}
          totalPhotos={selectedPhotos.length}
          deleteZoneY={deleteZoneY}
          hoverIndex={hoverIndex}
          onHoverIndexChange={handleHoverIndexChange}
          isOverDeleteZone={isOverDeleteZone}
        />
      );
    }

    return (
      <TouchableOpacity
        key={`empty_${index}`}
        style={[styles.thumbnailSlot, styles.thumbnailEmpty]}
        onPress={() => handleThumbnailPress(index)}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={24} color={colors.text.secondary} />
      </TouchableOpacity>
    );
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleCancel}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.overlay}>
          <GestureDetector gesture={swipeGesture}>
            <Animated.View style={[styles.container, swipeAnimatedStyle]}>
              {/* Header with Cancel button */}
              <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={28} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Highlights</Text>
                <View style={styles.headerSpacer} />
              </View>

              {/* Preview Area */}
              <View style={styles.previewContainer}>
                {selectedPhotos.length === 0 ? renderEmptyPreview() : renderPreviewPhoto()}
              </View>

              {/* Thumbnail Strip */}
              <View style={styles.thumbnailSection}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.thumbnailScroll}
                  contentContainerStyle={styles.thumbnailContainer}
                >
                  {Array.from({ length: MAX_SELECTS }).map((_, index) =>
                    renderThumbnailSlot(index)
                  )}
                </ScrollView>
              </View>

              {/* Spacer to push button to bottom */}
              <View style={styles.spacer} />

              {/* Button Area / Delete Bar (swaps when dragging) */}
              <View
                style={[styles.buttonContainer, { paddingBottom: insets.bottom + 24 }]}
                onLayout={handleDeleteZoneLayout}
              >
                {isDragging ? (
                  <DeleteBar isVisible={isDragging} isHovering={isOverDeleteZone} />
                ) : (
                  <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    activeOpacity={0.8}
                    disabled={saving}
                  >
                    <Text style={styles.saveButtonText}>
                      {saving ? 'Saving...' : 'Save highlights'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  container: {
    flex: 1,
    overflow: 'visible',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  cancelButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  previewContainer: {
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    marginTop: 24, // Space between header and preview
    marginBottom: 8,
  },
  previewEmpty: {
    backgroundColor: colors.background.tertiary,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border.subtle,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmptyText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 12,
  },
  previewImage: {
    borderRadius: 12,
    backgroundColor: colors.background.tertiary,
  },
  thumbnailSection: {
    paddingVertical: 16,
    marginHorizontal: SCREEN_PADDING,
    zIndex: 1,
    overflow: 'visible',
  },
  thumbnailScroll: {
    overflow: 'visible',
  },
  thumbnailContainer: {
    flexDirection: 'row',
    gap: THUMBNAIL_GAP,
    overflow: 'visible',
  },
  thumbnailSlot: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  thumbnailFilled: {
    backgroundColor: colors.background.tertiary,
  },
  thumbnailEmpty: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderStyle: 'dashed',
  },
  thumbnailSelected: {
    borderWidth: 2,
    borderColor: colors.text.primary,
    borderStyle: 'solid',
  },
  thumbnailImage: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 8,
  },
  thumbnailTouchable: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  spacer: {
    minHeight: 16,
    overflow: 'visible',
  },
  buttonContainer: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 0,
  },
  saveButton: {
    height: 48,
    backgroundColor: colors.brand.purple,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteBar: {
    height: DELETE_BAR_HEIGHT,
    backgroundColor: colors.status.danger,
    opacity: 0.9,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBarHovering: {
    backgroundColor: '#FF6666',
    opacity: 1,
  },
  deleteBarIcon: {
    marginRight: 8,
  },
  deleteBarText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SelectsEditOverlay;
