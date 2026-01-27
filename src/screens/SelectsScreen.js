import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Button, StepIndicator } from '../components';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
import logger from '../utils/logger';

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
}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);

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
      if (isOverDelete) {
        // Delete the photo
        runOnJS(onDelete)(index);
      } else {
        // Reorder
        const targetIndex = calculateTargetIndex(translateX.value);
        if (targetIndex !== index) {
          runOnJS(onReorder)(index, targetIndex);
        }
      }
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
      zIndex.value = 0;
      runOnJS(onHoverIndexChange)(null);
      runOnJS(onDragEnd)();
    })
    .onFinalize(() => {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
      zIndex.value = 0;
      runOnJS(onHoverIndexChange)(null);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
  }));

  const opacityStyle = useAnimatedStyle(() => ({
    opacity: isDraggingAny && draggingIndex !== index ? 0.6 : 1,
  }));

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
            <Ionicons name="hand-left-outline" size={32} color={colors.text.primary} />
          </Animated.View>
          <Ionicons
            name="swap-horizontal"
            size={24}
            color={colors.text.secondary}
            style={styles.tutorialSwapIcon}
          />
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

      const newPhotos = result.assets.map(asset => ({
        uri: asset.uri,
        assetId: asset.assetId || asset.uri,
      }));

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
      logger.info('SelectsScreen: Photo selected', { uri: asset.uri });

      const newPhoto = {
        uri: asset.uri,
        assetId: asset.assetId || asset.uri,
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
        // Update local profile state - triggers navigation via AppNavigator
        updateUserProfile({
          ...userProfile,
          ...updateData,
        });
        logger.info('SelectsScreen: Profile updated with selects');
        // Navigation will be handled automatically by AuthContext state change
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
      <Ionicons name="images-outline" size={64} color={colors.text.secondary} />
      <Text style={styles.previewEmptyText}>Tap to add photos</Text>
    </View>
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
      return (
        <DraggableThumbnail
          key={index}
          photo={selectedPhotos[index]}
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
        <Ionicons name="add" size={24} color={colors.text.secondary} />
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
            <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
          </TouchableOpacity>
          <StepIndicator currentStep={2} totalSteps={2} style={styles.headerStepIndicator} />
          <View style={styles.headerSpacer} />
        </View>

        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Pick Your Highlights</Text>
          <Text style={styles.subtitle}>
            Choose up to {MAX_SELECTS} photos to highlight on your profile
          </Text>
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
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
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
    marginTop: 24,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: colors.text.secondary,
  },
  previewContainer: {
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    marginBottom: 8,
  },
  previewTouchable: {
    borderRadius: 12,
    overflow: 'hidden',
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
    flex: 1,
    overflow: 'visible',
  },
  buttonContainer: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 24,
    paddingTop: 8,
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
  // Tutorial hint styles
  tutorialOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  tutorialContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  tutorialIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  tutorialSwapIcon: {
    marginLeft: 8,
  },
  tutorialTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  tutorialSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 20,
  },
  tutorialButton: {
    backgroundColor: colors.brand.purple,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  tutorialButtonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SelectsScreen;
