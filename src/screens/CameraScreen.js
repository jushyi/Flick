import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../context/AuthContext';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { getDarkroomCounts } from '../services/firebase/photoService';
import { addToQueue, initializeQueue } from '../services/uploadQueueService';
import logger from '../utils/logger';
import { lightImpact } from '../utils/haptics';
import Svg, { Path } from 'react-native-svg';
import { DarkroomBottomSheet } from '../components';

// Zoom level configuration
// expo-camera zoom is 0-1 range where 0 is no zoom and 1 is max zoom
// Mapping: 0.5x=0, 1x=0.17, 2x=0.33, 3x=0.5
const ZOOM_LEVELS = [
  { label: '.5', value: 0.5, cameraZoom: 0 },
  { label: '1x', value: 1, cameraZoom: 0.17 },
  { label: '2', value: 2, cameraZoom: 0.33 },
  { label: '3', value: 3, cameraZoom: 0.5 },
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Layout constants
const TAB_BAR_HEIGHT = 65; // Bottom tab navigator height (includes safe area)
const FOOTER_HEIGHT = 200; // Covers ~1/4 of screen for iOS-native camera feel
const CAMERA_HEIGHT = SCREEN_HEIGHT - FOOTER_HEIGHT - TAB_BAR_HEIGHT;
const CAMERA_PREVIEW_MARGIN = 16; // Breathing room around camera preview
const CAMERA_BORDER_RADIUS = 24; // Rounded corners for camera preview
const CIRCLE_BUTTON_SIZE = 50; // Darkroom buttons
const FLOATING_BUTTON_SIZE = 45; // Flash, flip buttons (10% smaller, floating above footer)
const FLOATING_BUTTON_OFFSET = 8; // Distance above footer edge

// Flash icon SVG component - matches bottom nav design system
const FlashIcon = ({ color = '#FFFFFF', mode = 'off' }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Path
      d="M13 2L4.09 12.35a1 1 0 0 0 .77 1.65H11v6a1 1 0 0 0 1.84.54l8.91-10.35a1 1 0 0 0-.77-1.65H13V2z"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={mode === 'on' ? color : 'none'}
    />
  </Svg>
);

// Flip camera icon SVG component - matches bottom nav design system
const FlipCameraIcon = ({ color = '#FFFFFF' }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Camera body outline */}
    <Path
      d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2v11z"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Circular arrows for flip/rotate */}
    <Path
      d="M12 17a4 4 0 1 0 0-8"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M8 13l-1.5-1.5L8 10"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M12 9a4 4 0 1 1 0 8"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M16 13l1.5 1.5L16 16"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const CameraScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [zoom, setZoom] = useState(ZOOM_LEVELS[1]); // Default to 1x
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [darkroomCounts, setDarkroomCounts] = useState({
    totalCount: 0,
    developingCount: 0,
    revealedCount: 0,
  });
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const cameraRef = useRef(null);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const badgeBounce = useRef(new Animated.Value(1)).current;

  // Initialize upload queue on app start
  useEffect(() => {
    initializeQueue();
  }, []);

  // Load darkroom counts on mount and poll every 30s
  useEffect(() => {
    if (!user) return;

    const loadDarkroomCounts = async () => {
      const counts = await getDarkroomCounts(user.uid);
      logger.debug('CameraScreen: Darkroom counts updated', counts);
      setDarkroomCounts(counts);
    };

    loadDarkroomCounts();

    // Poll every 30 seconds to update counts
    const interval = setInterval(loadDarkroomCounts, 30000);

    return () => clearInterval(interval);
  }, [user]);

  // Reload counts when screen comes into focus (after returning from Darkroom)
  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      const loadDarkroomCounts = async () => {
        logger.info('CameraScreen: Reloading darkroom counts on focus');
        const counts = await getDarkroomCounts(user.uid);
        logger.debug('CameraScreen: Darkroom counts after focus', counts);
        setDarkroomCounts(counts);
      };

      loadDarkroomCounts();
    }, [user])
  );

  // Handle openDarkroom param from notification deep link
  useEffect(() => {
    logger.debug('CameraScreen: route.params changed', { params: route.params });
    if (route.params?.openDarkroom) {
      logger.info('CameraScreen: Opening darkroom from notification deep link');
      setIsBottomSheetVisible(true);
      // Clear the param to prevent re-opening on subsequent renders
      navigation.setParams({ openDarkroom: undefined });
    }
  }, [route.params?.openDarkroom, navigation]);

  // Handle permission request
  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          Lapse needs access to your camera to take photos
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash(current => {
      if (current === 'off') return 'on';
      if (current === 'on') return 'auto';
      return 'off';
    });
  };

  const handleZoomChange = (zoomLevel) => {
    if (zoomLevel.value !== zoom.value) {
      lightImpact();
      setZoom(zoomLevel);
      logger.debug('CameraScreen: Zoom level changed', { zoom: zoomLevel.value });
    }
  };

  // Play flash effect on capture (simulates camera shutter)
  const playFlashEffect = () => {
    setShowFlash(true);
    flashOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(flashOpacity, {
        toValue: 0.8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(flashOpacity, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => setShowFlash(false));
  };

  // Play badge bounce when photo "lands" in darkroom
  const playBadgeBounce = () => {
    badgeBounce.setValue(1);
    Animated.sequence([
      Animated.spring(badgeBounce, {
        toValue: 1.3,
        friction: 3,
        tension: 200,
        useNativeDriver: true,
      }),
      Animated.spring(badgeBounce, {
        toValue: 1,
        friction: 4,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const playPhotoAnimation = (photoUri) => {
    // Flash already started in takePicture() - don't duplicate

    setCapturedPhoto(photoUri);
    animatedValue.setValue(0);

    Animated.sequence([
      // Arc trajectory to darkroom position with physics-style easing
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      // Fade out
      Animated.timing(animatedValue, {
        toValue: 2,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCapturedPhoto(null);
      animatedValue.setValue(0);
    });

    // Trigger badge bounce when photo reaches destination (at t=600ms)
    setTimeout(playBadgeBounce, 600);
  };

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing || !user) return;

    try {
      setIsCapturing(true);

      // INSTANT FEEDBACK: Flash fires immediately on tap!
      // Camera capture runs in parallel with flash animation
      playFlashEffect();

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });

      logger.debug('CameraScreen: Photo captured', { uri: photo.uri });

      // Queue for background upload (non-blocking)
      addToQueue(user.uid, photo.uri);

      // Play animation (don't await - camera should be ready immediately)
      playPhotoAnimation(photo.uri);

      // Optimistically update badge count (+1 developing)
      setDarkroomCounts(prev => ({
        ...prev,
        developingCount: prev.developingCount + 1,
        totalCount: prev.totalCount + 1,
      }));

      logger.info('CameraScreen: Photo queued for background upload');
    } catch (error) {
      logger.error('CameraScreen: Error capturing photo', error);
    } finally {
      setIsCapturing(false);
    }
  };

  // Calculate animation interpolations with curved arc trajectory
  const photoScale = animatedValue.interpolate({
    inputRange: [0, 0.3, 0.7, 1, 2],
    outputRange: [1, 0.7, 0.3, 0.15, 0.15],
  });

  // Darkroom button position calculation:
  // Footer is at bottom: TAB_BAR_HEIGHT (65) from screen bottom, FOOTER_HEIGHT (160) tall
  // Footer controls are centered with gap: 40 between buttons (56px wide each)
  // Darkroom button is first (left of capture), so it's at: center - 40 - 40 - 28 = center - 108
  // Final Y position from center: footer center is at SCREEN_HEIGHT - TAB_BAR_HEIGHT - FOOTER_HEIGHT/2 - 10 (paddingBottom adjustment)
  // Offset from screen center (50%): targetY - SCREEN_HEIGHT/2
  const DARKROOM_BUTTON_OFFSET_X = -108; // Left of center (gap + half capture button + half darkroom button)
  const DARKROOM_BUTTON_Y = SCREEN_HEIGHT - TAB_BAR_HEIGHT - FOOTER_HEIGHT / 2 - 10;
  const DARKROOM_OFFSET_FROM_CENTER_Y = DARKROOM_BUTTON_Y - SCREEN_HEIGHT / 2;

  // Arc trajectory: rises slightly at start, then curves down to darkroom button
  const photoTranslateY = animatedValue.interpolate({
    inputRange: [0, 0.2, 0.5, 0.8, 1, 2],
    outputRange: [0, -40, DARKROOM_OFFSET_FROM_CENTER_Y * 0.3, DARKROOM_OFFSET_FROM_CENTER_Y * 0.7, DARKROOM_OFFSET_FROM_CENTER_Y, DARKROOM_OFFSET_FROM_CENTER_Y],
  });

  // Curved X path: starts moving right slightly, then curves LEFT toward darkroom button
  const photoTranslateX = animatedValue.interpolate({
    inputRange: [0, 0.3, 0.6, 1, 2],
    outputRange: [0, 30, DARKROOM_BUTTON_OFFSET_X * 0.3, DARKROOM_BUTTON_OFFSET_X, DARKROOM_BUTTON_OFFSET_X],
  });

  const photoOpacity = animatedValue.interpolate({
    inputRange: [0, 1, 1.5, 2],
    outputRange: [1, 1, 0.5, 0],
  });

  // Slight rotation during flight for more dynamic feel
  const photoRotate = animatedValue.interpolate({
    inputRange: [0, 0.3, 0.7, 1, 2],
    outputRange: ['0deg', '-5deg', '5deg', '0deg', '0deg'],
  });

  return (
    <View style={styles.container}>
      {/* Camera Preview Container - with rounded corners */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          flash={flash}
          zoom={zoom.cameraZoom}
        />
      </View>

      {/* Floating Controls Row - Flash (left), Zoom (center), Flip (right) - positioned above footer */}
      <View style={styles.floatingControls}>
        {/* Flash Button (far left) */}
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={toggleFlash}
        >
          <FlashIcon color="#FFFFFF" mode={flash} />
          {flash === 'auto' && <Text style={styles.flashLabel}>A</Text>}
        </TouchableOpacity>

        {/* Zoom Control Bar - centered */}
        <View style={styles.zoomBar}>
          {ZOOM_LEVELS.map((level) => (
            <TouchableOpacity
              key={level.value}
              style={[
                styles.zoomButton,
                zoom.value === level.value && styles.zoomButtonActive,
              ]}
              onPress={() => handleZoomChange(level)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.zoomButtonText,
                  zoom.value === level.value && styles.zoomButtonTextActive,
                ]}
              >
                {zoom.value === level.value ? `${level.value === 0.5 ? '.5' : level.value}x` : (level.value === 0.5 ? '.5' : String(level.value))}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Flip Camera Button (far right) */}
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={toggleCameraFacing}
        >
          <FlipCameraIcon color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Footer Bar - solid dark background */}
      <View style={styles.footerBar}>
        {/* Main Controls Row: Darkroom, Capture */}
        <View style={styles.footerControls}>
          {/* Darkroom Button */}
          <DarkroomButton
            count={darkroomCounts.totalCount}
            onPress={() => setIsBottomSheetVisible(true)}
            bounceAnim={badgeBounce}
          />

          {/* Capture Button (center) - 10% larger with spaced ring */}
          <TouchableOpacity
            style={[
              styles.captureButtonOuter,
              isCapturing && styles.captureButtonDisabled,
            ]}
            onPress={takePicture}
            disabled={isCapturing}
            activeOpacity={0.7}
          >
            <View style={styles.captureButton}>
              <View style={styles.captureButtonInner} />
            </View>
          </TouchableOpacity>

          {/* Spacer to balance the layout */}
          <View style={styles.circleButton} />
        </View>
      </View>

      {/* Flash Overlay (camera shutter effect) */}
      {showFlash && (
        <Animated.View
          style={[
            styles.flashOverlay,
            { opacity: flashOpacity },
          ]}
        />
      )}

      {/* Animated Photo Snapshot */}
      {capturedPhoto && (
        <Animated.View
          style={[
            styles.animatedPhoto,
            {
              transform: [
                { scale: photoScale },
                { translateY: photoTranslateY },
                { translateX: photoTranslateX },
                { rotate: photoRotate },
              ],
              opacity: photoOpacity,
            },
          ]}
        >
          <Image source={{ uri: capturedPhoto }} style={styles.photoSnapshot} />
        </Animated.View>
      )}

      {/* Darkroom Bottom Sheet */}
      <DarkroomBottomSheet
        visible={isBottomSheetVisible}
        revealedCount={darkroomCounts.revealedCount}
        developingCount={darkroomCounts.developingCount}
        onClose={() => {
          logger.debug('DarkroomButton: Bottom sheet closed');
          setIsBottomSheetVisible(false);
        }}
        onComplete={() => {
          logger.info('CameraScreen: Navigating to Darkroom after press-and-hold', {
            revealedCount: darkroomCounts.revealedCount,
            developingCount: darkroomCounts.developingCount,
            totalCount: darkroomCounts.totalCount,
          });
          setIsBottomSheetVisible(false);
          navigation.navigate('Darkroom');
        }}
      />
    </View>
  );
};

// Darkroom Button Component (moon icon with badge count)
const DarkroomButton = ({ count, onPress, bounceAnim }) => {
  const isDisabled = count === 0;

  const handlePress = () => {
    if (onPress) {
      logger.info('DarkroomButton: Opening bottom sheet', { count });
      onPress();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.darkroomButton, isDisabled && styles.darkroomButtonDisabled]}
      onPress={handlePress}
      disabled={isDisabled}
    >
      <View style={{ position: 'relative' }}>
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <Path
            d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        {count > 0 && (
          <Animated.View
            style={{
              position: 'absolute',
              top: -6,
              right: -8,
              backgroundColor: '#FF3B30',
              borderRadius: 10,
              minWidth: 18,
              height: 18,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 4,
              transform: [{ scale: bounceAnim || 1 }],
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' }}>
              {count > 99 ? '99+' : count}
            </Text>
          </Animated.View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  // Camera container - with rounded corners and margin
  cameraContainer: {
    position: 'absolute',
    top: CAMERA_PREVIEW_MARGIN,
    left: CAMERA_PREVIEW_MARGIN,
    right: CAMERA_PREVIEW_MARGIN,
    height: CAMERA_HEIGHT - CAMERA_PREVIEW_MARGIN * 2,
    borderRadius: CAMERA_BORDER_RADIUS,
    overflow: 'hidden',
  },
  // Camera - fills the container
  camera: {
    flex: 1,
  },
  // Floating controls row - positioned above footer, over camera preview
  floatingControls: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT + FOOTER_HEIGHT + FLOATING_BUTTON_OFFSET,
    left: CAMERA_PREVIEW_MARGIN,
    right: CAMERA_PREVIEW_MARGIN,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  // Floating button - 45px (10% smaller than 50px), for flash and flip
  floatingButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    width: FLOATING_BUTTON_SIZE,
    height: FLOATING_BUTTON_SIZE,
    borderRadius: FLOATING_BUTTON_SIZE / 2,
  },
  // Footer bar - absolute positioned, solid dark background, above tab bar
  footerBar: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT,
    left: 0,
    right: 0,
    height: FOOTER_HEIGHT,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  // Zoom control bar - centered in floating controls row
  zoomBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 25,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  zoomButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  zoomButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  zoomButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  zoomButtonTextActive: {
    color: '#FFFFFF',
  },
  // Circle button - 50px for flash and flip (10% smaller than original 56px)
  circleButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  // Permission screens
  permissionContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  // Darkroom button (in footer) - matches circle button size
  darkroomButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  darkroomButtonDisabled: {
    opacity: 0.4,
  },
  // Flash auto indicator (small letter on button)
  flashLabel: {
    position: 'absolute',
    bottom: 4,
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // Capture button - 88px (10% larger) with thin spaced ring
  captureButtonOuter: {
    width: 100, // 88px button + 6px gap on each side + 2px ring = 100px
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
  },
  // Animated photo
  animatedPhoto: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -150,
    marginTop: -200,
    width: 300,
    height: 400,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  photoSnapshot: {
    width: '100%',
    height: '100%',
  },
  // Flash overlay for camera shutter effect
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 100,
  },
});

export default CameraScreen;