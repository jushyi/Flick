import React, { useState, useCallback, useEffect, useRef } from 'react';
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

// Maximum dp dimension for the rendered image view.
// Android image libraries (Coil/Glide) silently downsample views that are
// larger than the screen, breaking the gesture math.  We cap at CIRCLE_SIZE*4
// and apply a displayScale factor so the crop formula can convert back to
// original pixel coordinates.
const MAX_DISPLAY_DP = CIRCLE_SIZE * 4;

/**
 * ProfilePhotoCropScreen (Android)
 *
 * Android-specific additions vs the iOS file:
 *  1. EXIF normalization via ImageManipulator before getting image size.
 *     On Android, Image.getSize() returns the raw (EXIF-unrotated) dimensions
 *     while expo-image renders with EXIF rotation applied.  Baking the rotation
 *     in aligns both coordinate systems.
 *  2. displayScale capping.
 *     Camera photos can be 3000+ pixels wide.  Rendering at raw pixel dp values
 *     causes Android to silently scale the view down, breaking gesture math.
 *     We cap the rendered view at MAX_DISPLAY_DP and store displayScale so the
 *     crop formula can convert display-dp coords back to original pixel coords.
 *  3. Measured imageAreaLayout for the circle overlay.
 *     With edgeToEdgeEnabled: true, Dimensions.get('window').height includes
 *     system bars.  We measure the real imageArea height via onLayout.
 *
 * Crop formula:
 *   Image rendered at displayWidth × displayHeight dp (= original * displayScale).
 *   imageWidth/imageHeight shared values hold display dp dimensions.
 *   After transform [translateX: tx, translateY: ty, scale: s]:
 *     Circle centre in display-dp coords:
 *       cx_dp = displayWidth/2 - tx/s
 *       cy_dp = displayHeight/2 - ty/s
 *     Convert to original pixel coords (÷ displayScale):
 *       cropCentreX = imageOrigWidth/2  - (tx/s) / displayScale
 *       cropCentreY = imageOrigHeight/2 - (ty/s) / displayScale
 *     Crop size in original pixels:
 *       cropSize = (CIRCLE_SIZE / s) / displayScale
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
  // displayScale < 1 when the image is larger than MAX_DISPLAY_DP.
  // Stored as a ref (not state) because it only needs to be read in handleConfirm.
  const displayScaleRef = useRef(1);
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
      // Normalize EXIF rotation and capture true pixel dimensions in one step.
      // manipulateAsync returns { uri, width, height } where width/height are the
      // actual pixel dimensions of the output file — unlike Image.getSize() which
      // uses Fresco and silently downsamples images larger than ~2048px.
      let normalized = null;
      try {
        normalized = await ImageManipulator.manipulateAsync(imageUri, [], {
          compress: 1,
          format: ImageManipulator.SaveFormat.JPEG,
        });
      } catch (err) {
        logger.warn('ProfilePhotoCropScreen (Android): EXIF normalization failed, using original', {
          error: err.message,
        });
      }

      const uri = normalized ? normalized.uri : imageUri;
      setWorkingUri(uri);

      // Use the dimensions from the manipulateAsync result.  If normalization
      // failed, fall back to Image.getSize() on the original URI.
      let width = normalized?.width;
      let height = normalized?.height;

      if (!width || !height) {
        // Fallback: Image.getSize via Fresco (may downsample >2048px images on
        // Android but is better than nothing if manipulateAsync failed).
        await new Promise(resolve => {
          const ImageRN = require('react-native').Image;
          ImageRN.getSize(
            uri,
            (w, h) => {
              width = w;
              height = h;
              resolve();
            },
            err => {
              logger.error('ProfilePhotoCropScreen (Android): Failed to get image size', {
                error: err,
              });
              resolve();
            }
          );
        });
      }

      if (!width || !height) {
        logger.error('ProfilePhotoCropScreen (Android): Could not determine image dimensions');
        setLoading(false);
        return;
      }

      setImageSize({ width, height });

      // Cap rendered dp size so Coil doesn't silently downsample the view.
      // (expo-image allowDownscaling=false is set on the Image; this cap keeps
      // the view small enough that full-quality decoding won't cause OOM.)
      const rawMax = Math.max(width, height);
      const displayScale = rawMax > MAX_DISPLAY_DP ? MAX_DISPLAY_DP / rawMax : 1;
      displayScaleRef.current = displayScale;

      const displayWidth = Math.round(width * displayScale);
      const displayHeight = Math.round(height * displayScale);

      // Shared values hold DISPLAY dp dimensions (used for gesture clamping)
      imageWidth.value = displayWidth;
      imageHeight.value = displayHeight;

      // initialScale: shorter DISPLAY side fills CIRCLE_SIZE
      const imageAspect = width / height;
      const initialScale =
        imageAspect > 1
          ? CIRCLE_SIZE / displayHeight // landscape: displayHeight is shorter
          : CIRCLE_SIZE / displayWidth; // portrait / square: displayWidth is shorter

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
        displayWidth,
        displayHeight,
        displayScale,
        initialScale,
      });
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

      // displayScale converts between display-dp coordinates (used by gestures)
      // and original pixel coordinates (used by ImageManipulator.crop).
      const ds = displayScaleRef.current;

      // Crop size in original image pixels
      const cropSizeInOriginal = CIRCLE_SIZE / currentScale / ds;

      // Crop centre in original image pixels.
      // Circle centre in display-dp = (displayWidth/2 - tx/s, displayHeight/2 - ty/s).
      // Divide by ds to get original pixel coords.
      const cropCenterX = imageSize.width / 2 - currentTranslateX / currentScale / ds;
      const cropCenterY = imageSize.height / 2 - currentTranslateY / currentScale / ds;

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
                    width: Math.round(imageSize.width * displayScaleRef.current),
                    height: Math.round(imageSize.height * displayScaleRef.current),
                  }}
                  contentFit="contain"
                  cachePolicy="memory"
                  allowDownscaling={false}
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
