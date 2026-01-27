import React, { useState, useCallback } from 'react';
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
const DELETE_ZONE_THRESHOLD = 120; // How far down to trigger delete zone (reaches button area)
const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    })
    .onUpdate(event => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      // Check if over delete zone (dragging down)
      const isOverDelete = event.translationY > DELETE_ZONE_THRESHOLD;
      runOnJS(onDragMove)(isOverDelete);
    })
    .onEnd(event => {
      // Check if dropping on delete zone
      const isOverDelete = event.translationY > DELETE_ZONE_THRESHOLD;
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
      runOnJS(onDragEnd)();
    })
    .onFinalize(() => {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
      zIndex.value = 0;
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

const SelectsScreen = ({ navigation }) => {
  const { user, userProfile, updateUserProfile, updateUserDocumentNative } = useAuth();

  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [isOverDeleteZone, setIsOverDeleteZone] = useState(false);

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

  const handleDragStart = useCallback(index => {
    setIsDragging(true);
    setDraggingIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDraggingIndex(null);
    setIsOverDeleteZone(false);
  }, []);

  const handleDragMove = useCallback(isOverDelete => {
    setIsOverDeleteZone(isOverDelete);
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

  const handleComplete = async () => {
    logger.info('SelectsScreen: Completing with photos', { count: selectedPhotos.length });
    setUploading(true);

    try {
      // Store selected photo URIs to user profile
      const selectsData = selectedPhotos.map(photo => photo.uri);

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
      logger.error('SelectsScreen: Failed to complete', { error: error.message });
      Alert.alert('Error', error.message || 'An error occurred');
    } finally {
      setUploading(false);
    }
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
        {/* Step Indicator */}
        <StepIndicator currentStep={2} totalSteps={2} style={styles.stepIndicator} />

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

        {/* Spacer to push button to bottom */}
        <View style={styles.spacer} />

        {/* Button Area / Delete Bar (swaps when dragging) */}
        <View style={styles.buttonContainer}>
          {isDragging ? (
            <DeleteBar isVisible={isDragging} isHovering={isOverDeleteZone} />
          ) : (
            <Button
              title="Complete Profile Setup"
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
  },
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  stepIndicator: {
    marginTop: 16,
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
    paddingHorizontal: SCREEN_PADDING,
    overflow: 'visible',
    zIndex: 1,
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
});

export default SelectsScreen;
