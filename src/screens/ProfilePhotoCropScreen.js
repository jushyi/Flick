import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import PixelSpinner from '../components/PixelSpinner';
import {
  TouchableOpacity,
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import * as ImageManipulator from 'expo-image-manipulator';
import Svg, { Defs, Rect, Mask, Circle } from 'react-native-svg';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';
import logger from '../utils/logger';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Circle size: approximately 80% of screen width
const CIRCLE_SIZE = SCREEN_WIDTH * 0.8;
const CIRCLE_RADIUS = CIRCLE_SIZE / 2;

/**
 * ProfilePhotoCropScreen
 *
 * Custom crop UI for profile photos with circular preview and gesture support.
 * - Circular mask overlay showing how the profile photo will appear
 * - Pinch-to-zoom and pan gestures
 * - Direct response (no bouncy animations)
 * - Crop produces square output matching the circular preview area
 *
 * @param {Object} route.params.imageUri - The image URI to crop
 * @param {Function} route.params.onCropComplete - Callback with cropped URI
 */
const ProfilePhotoCropScreen = ({ navigation, route }) => {
  const { imageUri, onCropComplete } = route.params || {};
  const insets = useSafeAreaInsets();

  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const [cropping, setCropping] = useState(false);

  // Shared values for gestures
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Shared values for image dimensions (needed in worklets)
  const imageWidth = useSharedValue(0);
  const imageHeight = useSharedValue(0);
  const minScaleValue = useSharedValue(1);

  // Load image dimensions
  useEffect(() => {
    if (!imageUri) return;

    Image.prefetch(imageUri).then(() => {
      // Use Image.getSize to get dimensions
      const ImageRN = require('react-native').Image;
      ImageRN.getSize(
        imageUri,
        (width, height) => {
          setImageSize({ width, height });

          // Also set shared values for use in worklets
          imageWidth.value = width;
          imageHeight.value = height;

          // Calculate base scale so image fills the circle
          // The smaller dimension should fill the circle diameter
          const imageAspect = width / height;
          let initialScale;

          if (imageAspect > 1) {
            // Landscape: height is smaller, scale based on height
            initialScale = CIRCLE_SIZE / height;
          } else {
            // Portrait or square: width is smaller, scale based on width
            initialScale = CIRCLE_SIZE / width;
          }

          minScaleValue.value = initialScale;
          scale.value = initialScale;
          savedScale.value = initialScale;
          setLoading(false);

          logger.debug('ProfilePhotoCropScreen: Image loaded', {
            width,
            height,
            initialScale,
          });
        },
        error => {
          logger.error('ProfilePhotoCropScreen: Failed to get image size', { error });
          setLoading(false);
        }
      );
    });
  }, [imageUri, scale, savedScale, imageWidth, imageHeight, minScaleValue]);

  // Pinch gesture for zooming
  const pinchGesture = Gesture.Pinch()
    .onUpdate(event => {
      'worklet';
      // Direct response: new scale = saved scale * pinch scale
      const newScale = savedScale.value * event.scale;
      // Clamp between minScale and 4x
      scale.value = Math.max(minScaleValue.value, Math.min(4, newScale));
    })
    .onEnd(() => {
      'worklet';
      savedScale.value = scale.value;

      // Re-clamp translation after zoom (inline clamping logic)
      const scaledWidth = imageWidth.value * scale.value;
      const scaledHeight = imageHeight.value * scale.value;
      const maxTranslateX = Math.max(0, (scaledWidth - CIRCLE_SIZE) / 2);
      const maxTranslateY = Math.max(0, (scaledHeight - CIRCLE_SIZE) / 2);

      const clampedX = Math.max(-maxTranslateX, Math.min(maxTranslateX, translateX.value));
      const clampedY = Math.max(-maxTranslateY, Math.min(maxTranslateY, translateY.value));

      translateX.value = clampedX;
      translateY.value = clampedY;
      savedTranslateX.value = clampedX;
      savedTranslateY.value = clampedY;
    });

  // Pan gesture for positioning
  const panGesture = Gesture.Pan()
    .onUpdate(event => {
      'worklet';
      // Direct response: new position = saved position + delta
      const newX = savedTranslateX.value + event.translationX;
      const newY = savedTranslateY.value + event.translationY;

      // Clamp to keep image covering the circle (inline clamping logic)
      const scaledWidth = imageWidth.value * scale.value;
      const scaledHeight = imageHeight.value * scale.value;
      const maxTranslateX = Math.max(0, (scaledWidth - CIRCLE_SIZE) / 2);
      const maxTranslateY = Math.max(0, (scaledHeight - CIRCLE_SIZE) / 2);

      translateX.value = Math.max(-maxTranslateX, Math.min(maxTranslateX, newX));
      translateY.value = Math.max(-maxTranslateY, Math.min(maxTranslateY, newY));
    })
    .onEnd(() => {
      'worklet';
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Compose gestures to work simultaneously
  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  // Animated style for the image
  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Handle cancel
  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Handle confirm - crop the image
  const handleConfirm = useCallback(async () => {
    if (!imageUri || imageSize.width === 0) return;

    setCropping(true);

    try {
      // Calculate the crop region in original image coordinates
      // The circle represents a square crop area in the center of the view
      const currentScale = scale.value;
      const currentTranslateX = translateX.value;
      const currentTranslateY = translateY.value;

      // The visible circle corresponds to a square region in the original image
      // We need to reverse the transformations to find the original pixel coordinates

      // Center of the crop circle in view coordinates (relative to image center)
      // The image is centered, and translations move it
      // So the crop center in image coordinates is: -translateX, -translateY

      // Size of the crop area in original image pixels
      const cropSizeInOriginal = CIRCLE_SIZE / currentScale;

      // Origin of the crop area in original image coordinates
      // Image center is at (width/2, height/2)
      // The displayed area's center is offset by -translate/scale from image center
      const cropCenterX = imageSize.width / 2 - currentTranslateX / currentScale;
      const cropCenterY = imageSize.height / 2 - currentTranslateY / currentScale;

      const originX = cropCenterX - cropSizeInOriginal / 2;
      const originY = cropCenterY - cropSizeInOriginal / 2;

      // Clamp to image bounds
      const clampedOriginX = Math.max(0, Math.min(originX, imageSize.width - cropSizeInOriginal));
      const clampedOriginY = Math.max(0, Math.min(originY, imageSize.height - cropSizeInOriginal));
      const clampedSize = Math.min(
        cropSizeInOriginal,
        imageSize.width - clampedOriginX,
        imageSize.height - clampedOriginY
      );

      logger.debug('ProfilePhotoCropScreen: Crop parameters', {
        currentScale,
        currentTranslateX,
        currentTranslateY,
        cropSizeInOriginal,
        originX: clampedOriginX,
        originY: clampedOriginY,
        size: clampedSize,
      });

      // Crop the image
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: Math.round(clampedOriginX),
              originY: Math.round(clampedOriginY),
              width: Math.round(clampedSize),
              height: Math.round(clampedSize),
            },
          },
        ],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      logger.info('ProfilePhotoCropScreen: Crop successful', { croppedUri: result.uri });

      // Call the callback with the cropped URI
      if (onCropComplete) {
        onCropComplete(result.uri);
      }

      navigation.goBack();
    } catch (error) {
      logger.error('ProfilePhotoCropScreen: Crop failed', { error: error.message });
      setCropping(false);
    }
  }, [imageUri, imageSize, scale, translateX, translateY, onCropComplete, navigation]);

  // Circle overlay component with transparent cutout
  const CircleOverlay = () => (
    <View style={styles.overlayContainer} pointerEvents="none">
      <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT}>
        <Defs>
          <Mask id="mask">
            {/* White background (will be visible/dimmed) */}
            <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="white" />
            {/* Black circle (will be transparent cutout) */}
            <Circle cx={SCREEN_WIDTH / 2} cy={SCREEN_HEIGHT / 2} r={CIRCLE_RADIUS} fill="black" />
          </Mask>
        </Defs>
        {/* Dark overlay with circular cutout */}
        <Rect
          x="0"
          y="0"
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          fill={colors.overlay.dark}
          mask="url(#mask)"
        />
        {/* Circle border for visibility */}
        <Circle
          cx={SCREEN_WIDTH / 2}
          cy={SCREEN_HEIGHT / 2}
          r={CIRCLE_RADIUS}
          stroke="rgba(255, 255, 255, 0.5)"
          strokeWidth="2"
          fill="none"
        />
      </Svg>
    </View>
  );

  if (!imageUri) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>No image provided</Text>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Crop Photo</Text>
          <TouchableOpacity
            onPress={handleConfirm}
            style={styles.headerButton}
            disabled={cropping || loading}
          >
            {cropping ? (
              <PixelSpinner size="small" color={colors.brand.purple} />
            ) : (
              <Text style={[styles.confirmText, loading && styles.textDisabled]}>Confirm</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Image area with gestures */}
        <View style={styles.imageArea}>
          {loading ? (
            <PixelSpinner size="large" color={colors.text.primary} />
          ) : (
            <GestureDetector gesture={composedGesture}>
              <Animated.View style={[styles.imageContainer, animatedImageStyle]}>
                <Image
                  source={{ uri: imageUri }}
                  style={{
                    width: imageSize.width,
                    height: imageSize.height,
                  }}
                  contentFit="contain"
                  cachePolicy="memory"
                />
              </Animated.View>
            </GestureDetector>
          )}

          {/* Circle overlay */}
          {!loading && <CircleOverlay />}
        </View>

        {/* Instructions */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.instructionText}>Pinch to zoom, drag to reposition</Text>
        </View>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    zIndex: 10,
  },
  headerButton: {
    minWidth: 70,
    paddingVertical: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  cancelText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
  },
  confirmText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.brand.purple,
    textAlign: 'right',
  },
  textDisabled: {
    opacity: 0.4,
  },
  imageArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'absolute',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 100,
  },
});

export default ProfilePhotoCropScreen;
