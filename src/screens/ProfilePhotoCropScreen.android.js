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
import logger from '../utils/logger';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Circle size: approximately 80% of screen width
const CIRCLE_SIZE = SCREEN_WIDTH * 0.8;
const CIRCLE_RADIUS = CIRCLE_SIZE / 2;

/**
 * ProfilePhotoCropScreen (Android)
 *
 * Uses the same rendering approach as iOS (image at raw pixel dimensions with
 * initialScale to fit the circle) — the math is identical and proven correct.
 *
 * Android-specific additions vs the iOS file:
 *  1. EXIF normalization via ImageManipulator before getting image size.
 *     On Android, Image.getSize() returns the raw (EXIF-unrotated) dimensions
 *     while expo-image renders with EXIF rotation applied, creating a mismatch.
 *     Baking the rotation in via ImageManipulator aligns both coordinate systems.
 *  2. Measured imageAreaLayout for the circle overlay.
 *     With edgeToEdgeEnabled: true, Dimensions.get('window').height includes the
 *     system bars, making SCREEN_HEIGHT larger than the actual imageArea and
 *     displacing the overlay circle.  We measure the real imageArea height via
 *     onLayout and use those values for the SVG overlay.
 *
 * Crop formula (same as iOS):
 *   The image is rendered at imageSize.width × imageSize.height dp, centred in
 *   imageArea.  At initialScale the image's shorter side fills CIRCLE_SIZE.
 *   After transform [translateX: tx, translateY: ty, scale: s]:
 *     image centre on screen = imageArea.centre + (tx, ty)
 *     circle centre = imageArea.centre (fixed)
 *   Circle centre in image pixel coordinates:
 *     cropCentreX = imageWidth/2 - tx/s
 *     cropCentreY = imageHeight/2 - ty/s
 *   Crop size in pixels:
 *     cropSize = CIRCLE_SIZE / s
 */
const ProfilePhotoCropScreen = ({ navigation, route }) => {
  const { imageUri, onCropComplete } = route.params || {};
  const insets = useSafeAreaInsets();

  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const [cropping, setCropping] = useState(false);
  // workingUri has EXIF rotation baked in so Image.getSize() and the crop
  // operation share the same coordinate system.
  const [workingUri, setWorkingUri] = useState(null);
  // Measured imageArea dimensions so the circle overlay is centred in the real
  // available space — not the full window height which includes system bars on
  // Android with edgeToEdgeEnabled.
  const [imageAreaLayout, setImageAreaLayout] = useState({
    width: SCREEN_WIDTH,
    height: 400,
  });

  const handleImageAreaLayout = useCallback(event => {
    const { width, height } = event.nativeEvent.layout;
    setImageAreaLayout({ width, height });
  }, []);

  // Shared values for gestures
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Shared values for image dimensions and min scale (needed in worklets)
  const imageWidth = useSharedValue(0);
  const imageHeight = useSharedValue(0);
  const minScaleValue = useSharedValue(1);

  // Normalize EXIF rotation then load image dimensions.
  useEffect(() => {
    if (!imageUri) return;

    setLoading(true);

    const normalizeAndLoad = async () => {
      let uri = imageUri;

      try {
        const normalized = await ImageManipulator.manipulateAsync(imageUri, [], {
          compress: 1,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        uri = normalized.uri;
      } catch (err) {
        logger.warn('ProfilePhotoCropScreen (Android): EXIF normalization failed, using original', {
          error: err.message,
        });
      }

      setWorkingUri(uri);

      const ImageRN = require('react-native').Image;
      ImageRN.getSize(
        uri,
        (width, height) => {
          setImageSize({ width, height });
          imageWidth.value = width;
          imageHeight.value = height;

          // initialScale: scale the shorter side to fill CIRCLE_SIZE
          const imageAspect = width / height;
          const initialScale =
            imageAspect > 1
              ? CIRCLE_SIZE / height // landscape: height is shorter
              : CIRCLE_SIZE / width; // portrait / square: width is shorter

          minScaleValue.value = initialScale;
          scale.value = initialScale;
          savedScale.value = initialScale;

          // Reset pan
          translateX.value = 0;
          translateY.value = 0;
          savedTranslateX.value = 0;
          savedTranslateY.value = 0;

          setLoading(false);

          logger.debug('ProfilePhotoCropScreen (Android): Image loaded', {
            width,
            height,
            initialScale,
          });
        },
        error => {
          logger.error('ProfilePhotoCropScreen (Android): Failed to get image size', { error });
          setLoading(false);
        }
      );
    };

    normalizeAndLoad();
  }, [
    imageUri,
    scale,
    savedScale,
    translateX,
    translateY,
    savedTranslateX,
    savedTranslateY,
    imageWidth,
    imageHeight,
    minScaleValue,
  ]);

  // Pinch gesture for zooming
  const pinchGesture = Gesture.Pinch()
    .onUpdate(event => {
      'worklet';
      const newScale = savedScale.value * event.scale;
      scale.value = Math.max(minScaleValue.value, Math.min(4, newScale));
    })
    .onEnd(() => {
      'worklet';
      savedScale.value = scale.value;

      // Re-clamp translation after zoom
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
      const newX = savedTranslateX.value + event.translationX;
      const newY = savedTranslateY.value + event.translationY;

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

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleConfirm = useCallback(async () => {
    if (!workingUri || imageSize.width === 0) return;

    setCropping(true);

    try {
      const currentScale = scale.value;
      const currentTranslateX = translateX.value;
      const currentTranslateY = translateY.value;

      logger.debug('ProfilePhotoCropScreen (Android): handleConfirm gesture values', {
        scale: currentScale,
        translateX: currentTranslateX,
        translateY: currentTranslateY,
        imageSize,
      });

      // Crop size in original image pixels
      const cropSizeInOriginal = CIRCLE_SIZE / currentScale;

      // Crop centre in original image pixels (same formula as iOS)
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

      logger.debug('ProfilePhotoCropScreen (Android): Crop parameters', {
        currentScale,
        cropSizeInOriginal,
        originX: clampedOriginX,
        originY: clampedOriginY,
        size: clampedSize,
      });

      const result = await ImageManipulator.manipulateAsync(
        workingUri,
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

      logger.info('ProfilePhotoCropScreen (Android): Crop successful', { croppedUri: result.uri });

      if (onCropComplete) {
        onCropComplete(result.uri);
      }

      navigation.goBack();
    } catch (error) {
      logger.error('ProfilePhotoCropScreen (Android): Crop failed', { error: error.message });
      setCropping(false);
    }
  }, [workingUri, imageSize, scale, translateX, translateY, onCropComplete, navigation]);

  // Circle overlay — uses measured imageArea dimensions so the circle centre
  // matches the image centre assumed by the crop math (not full window height).
  const CircleOverlay = ({ areaWidth, areaHeight }) => (
    <View style={styles.overlayContainer} pointerEvents="none">
      <Svg width={areaWidth} height={areaHeight}>
        <Defs>
          <Mask id="mask">
            <Rect x="0" y="0" width={areaWidth} height={areaHeight} fill="white" />
            <Circle cx={areaWidth / 2} cy={areaHeight / 2} r={CIRCLE_RADIUS} fill="black" />
          </Mask>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={areaWidth}
          height={areaHeight}
          fill={colors.overlay.dark}
          mask="url(#mask)"
        />
        <Circle
          cx={areaWidth / 2}
          cy={areaHeight / 2}
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
        <View style={styles.imageArea} onLayout={handleImageAreaLayout}>
          {loading ? (
            <PixelSpinner size="large" color={colors.text.primary} />
          ) : (
            <GestureDetector gesture={composedGesture}>
              <Animated.View style={[styles.imageContainer, animatedImageStyle]}>
                <Image
                  source={{ uri: workingUri }}
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
          {!loading && (
            <CircleOverlay areaWidth={imageAreaLayout.width} areaHeight={imageAreaLayout.height} />
          )}
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
