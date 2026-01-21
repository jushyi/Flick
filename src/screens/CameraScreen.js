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
import Svg, { Path } from 'react-native-svg';
import { DarkroomBottomSheet } from '../components';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Layout constants
const TAB_BAR_HEIGHT = 65; // Bottom tab navigator height (includes safe area)
const FOOTER_HEIGHT = 280; // Covers ~1/3 of screen for iOS-native camera feel
const CAMERA_HEIGHT = SCREEN_HEIGHT - FOOTER_HEIGHT - TAB_BAR_HEIGHT;
const CAMERA_PREVIEW_MARGIN = 16; // Breathing room around camera preview
const CAMERA_BORDER_RADIUS = 24; // Rounded corners for camera preview

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
      {/* Camera View - no children, absolute positioned */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
      />

      {/* Footer Bar - solid dark background */}
      <View style={styles.footerBar}>
        {/* Footer Controls: Darkroom button (left) and Capture button (center) */}
        <View style={styles.footerControls}>
          {/* Darkroom Button (left of capture) */}
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
        </View>
      </View>

      {/* Floating Controls Overlay - positioned above footer */}
      <View style={styles.floatingControls}>
        {/* Flash Button (bottom left of camera area) */}
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={toggleFlash}
        >
          <FlashIcon color="#FFFFFF" mode={flash} />
          {flash === 'auto' && <Text style={styles.flashLabel}>AUTO</Text>}
        </TouchableOpacity>

        {/* Flip Camera Button (bottom right of camera area) */}
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={toggleCameraFacing}
        >
          <FlipCameraIcon color="#FFFFFF" />
        </TouchableOpacity>
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
  // Camera - absolute positioned, upper portion of screen
  camera: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: CAMERA_HEIGHT,
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
    gap: 40,
    paddingBottom: 20,
  },
  footerControlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  // Floating controls - positioned above footer edge (accounting for tab bar)
  floatingControls: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT + FOOTER_HEIGHT + FLOATING_CONTROL_OFFSET,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  floatingButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 70,
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
  // Darkroom button (in footer)
  darkroomButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  darkroomButtonDisabled: {
    opacity: 0.4,
  },
  // Flash control
  flashLabel: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 4,
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