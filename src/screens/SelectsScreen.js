import React, { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import PixelIcon from '../components/PixelIcon';
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
import { Button, StepIndicator } from '../components';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';
import logger from '../utils/logger';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MAX_SELECTS = 10;
const THUMBNAIL_SIZE = 56;
const THUMBNAIL_GAP = 8;
const PREVIEW_ASPECT_RATIO = 4 / 5;
const SCREEN_PADDING = 24;
const DELETE_BAR_HEIGHT = 48;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DRAG_HINT_STORAGE_KEY = '@selects_drag_hint_dismissed';

// DraggableThumbnail component for drag-to-reorder
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

  // Track pending reorder for animation after layout changes
  const pendingReorderRef = useRef(null);
  const prevIndexRef = useRef(index);

  // Reset position when the photo at this slot changes (after reorder)
  // Cancel any running animations and reset instantly to avoid flash
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

  // Apply compensation and animate AFTER layout has changed
  // useLayoutEffect runs after render but before paint
  useLayoutEffect(() => {
    if (pendingReorderRef.current !== null && prevIndexRef.current !== index) {
      // Layout has changed, now apply compensation so item appears at drop position
      const { savedTranslateX, savedTranslateY, slotShift } = pendingReorderRef.current;
      translateX.value = savedTranslateX - slotShift;
      translateY.value = savedTranslateY;

      // Animate from drop position to final slot position
      translateX.value = withTiming(0, { duration: 220 });
      translateY.value = withTiming(0, { duration: 220 });
      opacity.value = withTiming(1, { duration: 150 });

      pendingReorderRef.current = null;
    }
    prevIndexRef.current = index;
  }, [index]);

  // Animate horizontal shift for non-dragged items based on hover position
  useEffect(() => {
    // When drag ends, instantly snap to position (no animation) to avoid replay effect
    if (draggingIndex === null) {
      shiftX.value = 0;
      return;
    }

    // Collapse gaps when over delete zone or this is the dragged item
    if (isOverDeleteZone || hoverIndex === null || draggingIndex === index) {
      shiftX.value = withTiming(0, { duration: 200 });
      return;
    }

    const shiftAmount = THUMBNAIL_SIZE + THUMBNAIL_GAP;

    // Determine if this item needs to shift
    // Items between old position and new position need to move
    if (draggingIndex < hoverIndex) {
      // Dragging right: items in range (draggingIndex, hoverIndex] shift left
      if (index > draggingIndex && index <= hoverIndex) {
        shiftX.value = withTiming(-shiftAmount, { duration: 200 });
      } else {
        shiftX.value = withTiming(0, { duration: 200 });
      }
    } else if (draggingIndex > hoverIndex) {
      // Dragging left: items in range [hoverIndex, draggingIndex) shift right
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
      // Clamp to valid range
      targetIndex = Math.max(0, Math.min(targetIndex, totalPhotos - 1));
      return targetIndex;
    },
    [index, totalPhotos]
  );

  // Store pending reorder info for useLayoutEffect to process after layout changes
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
      // Check if over delete zone using absolute Y position
      const isOverDelete = deleteZoneY > 0 && event.absoluteY >= deleteZoneY;
      runOnJS(onDragMove)(isOverDelete);
      // Update hover index (null when over delete zone to collapse gaps)
      if (isOverDelete) {
        runOnJS(onHoverIndexChange)(null);
      } else {
        const targetIndex = calculateTargetIndex(translateX.value);
        runOnJS(onHoverIndexChange)(targetIndex);
      }
    })
    .onEnd(event => {
      // Check if dropping on delete zone using absolute Y position
      const isOverDelete = deleteZoneY > 0 && event.absoluteY >= deleteZoneY;
      const targetIndex = calculateTargetIndex(translateX.value);
      const didReorder = !isOverDelete && targetIndex !== index;

      if (isOverDelete) {
        // Delete the photo
        translateX.value = 0;
        translateY.value = 0;
        scale.value = 1;
        zIndex.value = 0;
        runOnJS(onDelete)(index);
        runOnJS(onHoverIndexChange)(null);
        runOnJS(onDragEnd)();
      } else if (didReorder) {
        // Calculate compensation for after layout changes
        const slotShift = (targetIndex - index) * (THUMBNAIL_SIZE + THUMBNAIL_GAP);

        // Store pending reorder info - compensation will be applied in useLayoutEffect
        // after the layout has actually changed
        runOnJS(storePendingReorder)({
          savedTranslateX: translateX.value,
          savedTranslateY: translateY.value,
          slotShift,
        });

        // Brief opacity fade to mask the layout transition
        opacity.value = withTiming(0.4, { duration: 30 });

        scale.value = withTiming(1, { duration: 150 });
        zIndex.value = 0;
        runOnJS(onHoverIndexChange)(null);
        runOnJS(onReorder)(index, targetIndex);
        runOnJS(onDragEnd)();
      } else {
        // No reorder - snap back
        translateX.value = withTiming(0, { duration: 150 });
        translateY.value = withTiming(0, { duration: 150 });
        scale.value = withTiming(1, { duration: 150 });
        zIndex.value = 0;
        runOnJS(onHoverIndexChange)(null);
        runOnJS(onDragEnd)();
      }
    })
    .onFinalize(() => {
      // onEnd handles all resets - onFinalize only needed for edge cases
      // Don't reset here as it can interrupt ongoing animations
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      // Combine gesture translation (for dragged item) with shift animation (for non-dragged items)
      // Dragged item: translateX follows gesture, shiftX stays at 0
      // Non-dragged items: translateX stays at 0, shiftX shifts based on hover position
      { translateX: translateX.value + shiftX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
  }));

  const opacityStyle = useAnimatedStyle(() => {
    // Combine: non-dragged items are dimmed, and dropped item fades during transition
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
          <Image
            source={{ uri: photo.uri }}
            style={styles.thumbnailImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="low"
            recyclingKey={photo.assetId || photo.uri}
            transition={100}
          />
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
};

// DeleteBar component that appears when dragging
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
      <PixelIcon
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

// TutorialHint component for drag-to-reorder instruction
const TutorialHint = ({ isVisible, onDismiss }) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const arrowTranslateX = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1);
      // Animate arrow left-right to indicate drag
      const animateArrow = () => {
        arrowTranslateX.value = withTiming(8, { duration: 500 }, () => {
          arrowTranslateX.value = withTiming(-8, { duration: 500 }, () => {
            arrowTranslateX.value = withTiming(0, { duration: 300 });
          });
        });
      };
      animateArrow();
      const interval = setInterval(animateArrow, 2000);
      return () => clearInterval(interval);
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0.9, { duration: 200 });
    }
  }, [isVisible, opacity, scale, arrowTranslateX]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: arrowTranslateX.value }],
  }));

  if (!isVisible) return null;

  return (
    <Animated.View style={[styles.tutorialOverlay, overlayStyle]} pointerEvents="box-none">
      <Animated.View style={[styles.tutorialContainer, containerStyle]}>
        <View style={styles.tutorialIconRow}>
          <Animated.View style={arrowStyle}>
            <PixelIcon name="swap-horizontal" size={32} color={colors.text.primary} />
          </Animated.View>
        </View>
        <Text style={styles.tutorialTitle}>Drag to reorder</Text>
        <Text style={styles.tutorialSubtitle}>Drag down to delete</Text>
        <TouchableOpacity style={styles.tutorialButton} onPress={onDismiss} activeOpacity={0.7}>
          <Text style={styles.tutorialButtonText}>Got it</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

const SelectsScreen = ({ navigation }) => {
  const { user, userProfile, updateUserProfile, updateUserDocumentNative } = useAuth();

  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [isOverDeleteZone, setIsOverDeleteZone] = useState(false);
  const [deleteZoneY, setDeleteZoneY] = useState(0);
  const [showDragHint, setShowDragHint] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(null);

  // Check if hint should be shown on mount
  useEffect(() => {
    const checkHintDismissed = async () => {
      try {
        const dismissed = await AsyncStorage.getItem(DRAG_HINT_STORAGE_KEY);
        if (dismissed !== 'true') {
          // Show hint after 1 second delay (let screen load first)
          const timer = setTimeout(() => {
            setShowDragHint(true);
          }, 1000);
          return () => clearTimeout(timer);
        }
      } catch (error) {
        logger.error('SelectsScreen: Failed to check hint state', { error: error.message });
      }
    };
    checkHintDismissed();
  }, []);

  // Dismiss hint and save to AsyncStorage
  const dismissDragHint = useCallback(async () => {
    setShowDragHint(false);
    try {
      await AsyncStorage.setItem(DRAG_HINT_STORAGE_KEY, 'true');
    } catch (error) {
      logger.error('SelectsScreen: Failed to save hint state', { error: error.message });
    }
  }, []);

  // Load existing selects when returning to edit
  useEffect(() => {
    if (userProfile?.selects?.length > 0) {
      const existingPhotos = userProfile.selects.map((uri, index) => ({
        uri,
        assetId: `existing_${index}`,
      }));
      setSelectedPhotos(existingPhotos);
      logger.debug('SelectsScreen: Loaded existing selects', { count: existingPhotos.length });
    }
  }, []); // Run once on mount

  // Determine if editing existing selects
  const isEditing = userProfile?.selectsCompleted === true;

  const handleDeleteZoneLayout = useCallback(event => {
    const { y } = event.nativeEvent.layout;
    // Measure relative to screen
    event.target.measureInWindow((x, windowY) => {
      setDeleteZoneY(windowY);
    });
  }, []);

  // Calculate preview dimensions
  const previewWidth = SCREEN_WIDTH - SCREEN_PADDING * 2;
  const previewHeight = previewWidth / PREVIEW_ASPECT_RATIO;

  // Multi-select picker for preview area
  const handlePickMultiplePhotos = async () => {
    logger.debug('SelectsScreen: Opening multi-select photo picker');

    // Check if already at max
    if (selectedPhotos.length >= MAX_SELECTS) {
      Alert.alert('Maximum Reached', `You can only select up to ${MAX_SELECTS} photos`);
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const remaining = MAX_SELECTS - selectedPhotos.length;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      logger.info('SelectsScreen: Photos selected', { count: result.assets.length });

      // Filter out duplicates
      const existingIds = new Set(selectedPhotos.map(p => p.assetId || p.uri));
      const newPhotos = result.assets
        .map(asset => ({
          uri: asset.uri,
          assetId: asset.assetId || asset.uri,
        }))
        .filter(photo => !existingIds.has(photo.assetId));

      if (newPhotos.length === 0) {
        Alert.alert('Already Added', 'All selected photos are already in your highlights');
        return;
      }

      if (newPhotos.length < result.assets.length) {
        logger.info('SelectsScreen: Filtered duplicates', {
          selected: result.assets.length,
          added: newPhotos.length,
        });
      }

      setSelectedPhotos(prev => {
        const combined = [...prev, ...newPhotos].slice(0, MAX_SELECTS);
        // Set selected index to the first newly added photo
        setSelectedIndex(prev.length);
        return combined;
      });
    }
  };

  // Single photo picker for thumbnail slots
  const handlePickSinglePhoto = async () => {
    logger.debug('SelectsScreen: Opening single photo picker');

    // Check if already at max
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

      // Check for duplicate
      const isDuplicate = selectedPhotos.some(p => (p.assetId || p.uri) === photoId);

      if (isDuplicate) {
        Alert.alert('Already Added', 'This photo is already in your highlights');
        return;
      }

      logger.info('SelectsScreen: Photo selected', { uri: asset.uri });

      const newPhoto = {
        uri: asset.uri,
        assetId: photoId,
      };

      setSelectedPhotos(prev => {
        const newPhotos = [...prev, newPhoto];
        // Set selected index to the newly added photo
        setSelectedIndex(newPhotos.length - 1);
        return newPhotos;
      });
    }
  };

  const handleRemovePhoto = useCallback(
    index => {
      logger.debug('SelectsScreen: Removing photo', { index });

      // Animate layout change so remaining items slide smoothly
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      setSelectedPhotos(prev => {
        const newPhotos = prev.filter((_, i) => i !== index);
        // Adjust selectedIndex if needed
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
      logger.debug('SelectsScreen: Reordering photo', { fromIndex, toIndex });

      // Animate layout change to prevent flash when array reorders
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      setSelectedPhotos(prev => {
        const newPhotos = [...prev];
        const [movedItem] = newPhotos.splice(fromIndex, 1);
        newPhotos.splice(toIndex, 0, movedItem);
        return newPhotos;
      });
      // Update selectedIndex if the moved item was selected or affected range
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

  const handleDragStart = useCallback(
    index => {
      setIsDragging(true);
      setDraggingIndex(index);
      setSelectedIndex(index); // Show dragged photo in preview
      // Auto-dismiss hint on first drag
      if (showDragHint) {
        dismissDragHint();
      }
    },
    [showDragHint, dismissDragHint]
  );

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
      // Photo exists at this index - show in preview
      setSelectedIndex(index);
    } else {
      // Empty slot - open single photo picker
      handlePickSinglePhoto();
    }
  };

  const saveSelects = async selectsData => {
    logger.info('SelectsScreen: Saving selects', { count: selectsData.length });
    setUploading(true);

    try {
      const updateData = {
        selects: selectsData,
        selectsCompleted: true,
      };

      const result = await updateUserDocumentNative(user.uid, updateData);

      if (result.success) {
        // Update local profile state
        updateUserProfile({
          ...userProfile,
          ...updateData,
        });
        logger.info('SelectsScreen: Profile updated with selects');

        // Navigate to ContactsSync screen (next step in onboarding)
        // Only navigate if user hasn't completed contacts sync yet
        if (userProfile?.contactsSyncCompleted === undefined) {
          navigation.navigate('ContactsSync');
        }
        // Otherwise, auth state listener will handle navigation to main app
      } else {
        Alert.alert('Error', 'Could not save your selects. Please try again.');
      }
    } catch (error) {
      logger.error('SelectsScreen: Failed to save', { error: error.message });
      Alert.alert('Error', error.message || 'An error occurred');
    } finally {
      setUploading(false);
    }
  };

  const handleComplete = () => {
    // If no photos selected, show skip confirmation
    if (selectedPhotos.length === 0) {
      Alert.alert(
        'Skip Highlights?',
        'Are you sure you want to skip selecting highlights? You can always add them later from your profile.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Skip', onPress: () => saveSelects([]), style: 'destructive' },
        ]
      );
      return;
    }

    // Has photos - save them
    const selectsData = selectedPhotos.map(photo => photo.uri);
    saveSelects(selectsData);
  };

  // Render empty preview placeholder
  const renderEmptyPreview = () => (
    <View style={[styles.previewEmpty, { width: previewWidth, height: previewHeight }]}>
      <PixelIcon name="images-outline" size={64} color={colors.text.secondary} />
      <Text style={styles.previewEmptyText}>Tap to add photos</Text>
    </View>
  );

  // Render preview with photo
  const renderPreviewPhoto = () => (
    <Image
      source={{ uri: selectedPhotos[selectedIndex]?.uri }}
      style={[styles.previewImage, { width: previewWidth, height: previewHeight }]}
      contentFit="cover"
      cachePolicy="memory-disk"
      priority="high"
      transition={150}
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
        key={index}
        style={[styles.thumbnailSlot, styles.thumbnailEmpty]}
        onPress={() => handleThumbnailPress(index)}
        activeOpacity={0.7}
      >
        <PixelIcon name="add" size={24} color={colors.text.secondary} />
      </TouchableOpacity>
    );
  };

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <PixelIcon name="chevron-back" size={28} color={colors.text.primary} />
          </TouchableOpacity>
          <StepIndicator currentStep={2} totalSteps={2} style={styles.headerStepIndicator} />
          <View style={styles.headerSpacer} />
        </View>

        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Pick Your Highlights</Text>
        </View>

        {/* Preview Area */}
        <View style={styles.previewContainer}>
          {selectedPhotos.length === 0 ? (
            <TouchableOpacity
              style={styles.previewTouchable}
              onPress={handlePickMultiplePhotos}
              activeOpacity={0.8}
            >
              {renderEmptyPreview()}
            </TouchableOpacity>
          ) : (
            <View style={styles.previewTouchable}>{renderPreviewPhoto()}</View>
          )}
        </View>

        {/* Thumbnail Strip */}
        <View style={styles.thumbnailSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.thumbnailScroll}
            contentContainerStyle={styles.thumbnailContainer}
          >
            {Array.from({ length: MAX_SELECTS }).map((_, index) => renderThumbnailSlot(index))}
          </ScrollView>
          {/* Edge masks to hide horizontal scroll overflow while allowing vertical drag */}
          <View style={styles.thumbnailMaskLeft} pointerEvents="none" />
          <View style={styles.thumbnailMaskRight} pointerEvents="none" />
        </View>

        {/* Tutorial Hint - only show when there are photos to reorder */}
        {selectedPhotos.length > 1 && (
          <TutorialHint isVisible={showDragHint} onDismiss={dismissDragHint} />
        )}

        {/* Spacer to push button to bottom */}
        <View style={styles.spacer} />

        {/* Button Area / Delete Bar (swaps when dragging) */}
        <View style={styles.buttonContainer} onLayout={handleDeleteZoneLayout}>
          {isDragging ? (
            <DeleteBar isVisible={isDragging} isHovering={isOverDeleteZone} />
          ) : (
            <Button
              title={isEditing ? 'Save Changes' : 'Complete Profile Setup'}
              variant="primary"
              onPress={handleComplete}
              loading={uploading}
              testID="selects-complete-button"
            />
          )}
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
    backgroundColor: colors.background.primary,
    overflow: 'visible',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    overflow: 'visible',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxs,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerStepIndicator: {
    flex: 1,
  },
  headerSpacer: {
    width: 44,
  },
  titleSection: {
    paddingHorizontal: SCREEN_PADDING,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.size.xxxl,
    fontFamily: typography.fontFamily.display,
    textAlign: 'center',
    color: colors.text.primary,
  },
  previewContainer: {
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    marginBottom: spacing.md,
  },
  previewTouchable: {
    borderRadius: layout.borderRadius.sm,
    overflow: 'hidden',
  },
  previewEmpty: {
    backgroundColor: colors.background.tertiary,
    borderRadius: layout.borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border.subtle,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmptyText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  previewImage: {
    borderRadius: layout.borderRadius.sm,
    backgroundColor: colors.background.tertiary,
  },
  thumbnailSection: {
    paddingVertical: spacing.md,
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
    borderRadius: layout.borderRadius.xs,
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
  thumbnailMaskLeft: {
    position: 'absolute',
    left: -SCREEN_PADDING,
    top: 0,
    bottom: 0,
    width: SCREEN_PADDING,
    backgroundColor: colors.background.primary,
    zIndex: 2,
  },
  thumbnailMaskRight: {
    position: 'absolute',
    right: -SCREEN_PADDING,
    top: 0,
    bottom: 0,
    width: SCREEN_PADDING,
    backgroundColor: colors.background.primary,
    zIndex: 2,
  },
  thumbnailImage: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: layout.borderRadius.xs,
  },
  thumbnailTouchable: {
    width: '100%',
    height: '100%',
    borderRadius: layout.borderRadius.xs,
    overflow: 'hidden',
  },
  spacer: {
    flex: 1,
    overflow: 'visible',
  },
  buttonContainer: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
  },
  deleteBar: {
    height: DELETE_BAR_HEIGHT,
    backgroundColor: colors.status.danger,
    opacity: 0.9,
    borderRadius: layout.borderRadius.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBarHovering: {
    backgroundColor: colors.status.dangerHover,
    opacity: 1,
  },
  deleteBarIcon: {
    marginRight: spacing.xs,
  },
  deleteBarText: {
    color: colors.text.primary,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
  },
  // Tutorial hint styles
  tutorialOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  tutorialContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: layout.borderRadius.sm,
    padding: spacing.lg,
    marginHorizontal: spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  tutorialIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  tutorialTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  tutorialSubtitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  tutorialButton: {
    backgroundColor: colors.brand.purple,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: layout.borderRadius.xs,
  },
  tutorialButtonText: {
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
  },
});

export default SelectsScreen;
