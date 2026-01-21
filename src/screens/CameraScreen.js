import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../context/AuthContext';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { getDarkroomCounts } from '../services/firebase/photoService';
import { addToQueue, initializeQueue } from '../services/uploadQueueService';
import logger from '../utils/logger';
import { lightImpact, mediumImpact } from '../utils/haptics';
import Svg, { Path } from 'react-native-svg';
import { DarkroomBottomSheet } from '../components';

// Zoom level configuration
// expo-camera zoom is 0-1 range where 0 is baseline (1x) and 1 is max zoom
// Base zoom levels (always available)
const ZOOM_LEVELS_BASE = [
  { label: '1', value: 1, lens: null, cameraZoom: 0 },         // Baseline (true 1x, no zoom)
  { label: '2', value: 2, lens: null, cameraZoom: 0.17 },      // 2x zoom
  { label: '3', value: 3, lens: null, cameraZoom: 0.33 },      // 3x telephoto
];

// Ultra-wide lens level (iOS only, when device supports it)
// Lens string from iOS AVFoundation - will be matched against actual values from device
const ULTRA_WIDE_LEVEL = {
  label: '0.5',
  value: 0.5,
  lens: 'ultra-wide', // Marker - actual lens string comes from availableLenses
  cameraZoom: 0, // Ultra-wide uses native lens, not digital zoom
};

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

// Flip camera icon SVG component - clean rotation arrows design
const FlipCameraIcon = ({ color = '#FFFFFF' }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Top arrow - curves right and down */}
    <Path
      d="M17 1l4 4-4 4"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M3 11V9a4 4 0 0 1 4-4h14"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Bottom arrow - curves left and up */}
    <Path
      d="M7 23l-4-4 4-4"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M21 13v2a4 4 0 0 1-4 4H3"
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
  const [zoom, setZoom] = useState(ZOOM_LEVELS_BASE[0]); // Default to 1x
  const [isCapturing, setIsCapturing] = useState(false);
  const [darkroomCounts, setDarkroomCounts] = useState({
    totalCount: 0,
    developingCount: 0,
    revealedCount: 0,
  });
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  // Ultra-wide lens state (iOS only)
  const [availableLenses, setAvailableLenses] = useState([]);
  const [selectedLens, setSelectedLens] = useState(null);
  const [hasUltraWide, setHasUltraWide] = useState(false);
  const cameraRef = useRef(null);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  // Animation values for card stack capture feedback
  const cardScale = useRef(new Animated.Value(1)).current;
  const cardFanSpread = useRef(new Animated.Value(0)).current; // 0 = normal, 1 = fanned out

  // Get wide-angle lens string (typically "Back Camera") for base zoom levels
  const wideAngleLens = useMemo(() => {
    if (Platform.OS !== 'ios' || facing !== 'back' || availableLenses.length === 0) {
      return null;
    }
    // Look for standard wide-angle camera
    return availableLenses.find(lens =>
      lens.toLowerCase() === 'back camera'
    ) || null;
  }, [availableLenses, facing]);

  // Build dynamic zoom levels based on device capabilities (iOS ultra-wide support)
  const zoomLevels = useMemo(() => {
    // Only show 0.5x on iOS, with ultra-wide support, on back camera
    if (Platform.OS === 'ios' && hasUltraWide && facing === 'back') {
      // Find the actual ultra-wide lens string from availableLenses
      // iOS lens names: "Back Ultra Wide Camera" or "builtInUltraWideCamera"
      const ultraWideLens = availableLenses.find(lens =>
        lens.toLowerCase().includes('ultra wide') ||
        lens.toLowerCase().includes('ultrawide')
      );
      logger.debug('CameraScreen: Building zoom levels with ultra-wide', {
        ultraWideLens,
        facing,
        availableLenses,
      });
      return [
        { ...ULTRA_WIDE_LEVEL, lens: ultraWideLens },
        ...ZOOM_LEVELS_BASE,
      ];
    }
    return ZOOM_LEVELS_BASE;
  }, [hasUltraWide, facing, availableLenses]);

  // Fallback: Try to get lenses via async method when camera ref is available
  useEffect(() => {
    const checkLensesAsync = async () => {
      if (Platform.OS === 'ios' && cameraRef.current && !hasUltraWide && facing === 'back') {
        try {
          const lenses = await cameraRef.current.getAvailableLensesAsync();
          logger.info('CameraScreen: Got lenses via async method', { lenses });
          if (lenses && lenses.length > 0) {
            setAvailableLenses(lenses);
            const hasUW = lenses.some(lens =>
              lens.toLowerCase().includes('ultra wide') ||
              lens.toLowerCase().includes('ultrawide')
            );
            setHasUltraWide(hasUW);
            if (hasUW) {
              logger.info('CameraScreen: Ultra-wide lens detected via async method');
            }
          }
        } catch (error) {
          logger.debug('CameraScreen: getAvailableLensesAsync not available or failed', {
            error: error.message,
          });
        }
      }
    };

    // Small delay to ensure camera is mounted
    const timeoutId = setTimeout(checkLensesAsync, 500);
    return () => clearTimeout(timeoutId);
  }, [facing, hasUltraWide]);

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
    lightImpact();
    setFacing(current => {
      const newFacing = current === 'back' ? 'front' : 'back';
      // Reset ultra-wide lens when switching to front camera (no ultra-wide on front)
      if (newFacing === 'front' && Platform.OS === 'ios') {
        setSelectedLens(null);
        // If currently on 0.5x, reset to 1x
        if (zoom.value === 0.5) {
          setZoom(ZOOM_LEVELS_BASE[0]); // Reset to 1x
          logger.debug('CameraScreen: Reset zoom to 1x (front camera has no ultra-wide)');
        }
      }
      return newFacing;
    });
  };

  const toggleFlash = () => {
    lightImpact();
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
      // Set lens for ultra-wide, null for standard zoom (iOS only)
      if (Platform.OS === 'ios') {
        setSelectedLens(zoomLevel.lens || null);
      }
      logger.debug('CameraScreen: Zoom level changed', {
        zoom: zoomLevel.value,
        lens: zoomLevel.lens,
      });
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

  // Play card stack capture animation - cards fan out and enlarge, then snap back
  const playCardCaptureAnimation = () => {
    // Reset values
    cardScale.setValue(1);
    cardFanSpread.setValue(0);

    // Animate: quick fan out + scale up, then immediate snap back
    Animated.parallel([
      // Scale: 1 -> 1.2 -> 1 (quick expand, immediate return)
      Animated.sequence([
        Animated.timing(cardScale, {
          toValue: 1.2,
          duration: 120, // Quick expand
          useNativeDriver: true,
        }),
        Animated.timing(cardScale, {
          toValue: 1,
          duration: 100, // Immediate snap back
          useNativeDriver: true,
        }),
      ]),
      // Fan spread: 0 -> 1 -> 0 (quick fan, immediate return)
      Animated.sequence([
        Animated.timing(cardFanSpread, {
          toValue: 1,
          duration: 120, // Quick fan out
          useNativeDriver: true,
        }),
        Animated.timing(cardFanSpread, {
          toValue: 0,
          duration: 100, // Immediate snap back
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing || !user) return;

    try {
      setIsCapturing(true);
      // Second stage: medium haptic on release (like full shutter click)
      mediumImpact();

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

      // Play card stack animation (fan out + scale)
      playCardCaptureAnimation();

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
          onAvailableLensesChanged={(event) => {
            // iOS only: Detect available lenses including ultra-wide
            if (Platform.OS === 'ios' && event?.lenses) {
              logger.info('CameraScreen: onAvailableLensesChanged fired', {
                lenses: event.lenses,
                count: event.lenses.length,
              });
              setAvailableLenses(event.lenses);
              // Check for ultra-wide: "Back Ultra Wide Camera" or "builtInUltraWideCamera"
              const hasUW = event.lenses.some(lens =>
                lens.toLowerCase().includes('ultra wide') ||
                lens.toLowerCase().includes('ultrawide')
              );
              setHasUltraWide(hasUW);
              logger.info('CameraScreen: Ultra-wide detection result', {
                hasUltraWide: hasUW,
                lenses: event.lenses,
              });
            }
          }}
          {...(Platform.OS === 'ios' && selectedLens && { selectedLens })}
        />
        {/* Flash Overlay (camera shutter effect) - contained within camera preview */}
        {showFlash && (
          <Animated.View
            style={[
              styles.flashOverlay,
              { opacity: flashOpacity },
            ]}
          />
        )}
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
          {zoomLevels.map((level) => {
            const isSelected = zoom.value === level.value;
            return (
              <TouchableOpacity
                key={level.value}
                style={[
                  styles.zoomButton,
                  isSelected && styles.zoomButtonActive,
                ]}
                onPress={() => handleZoomChange(level)}
                activeOpacity={0.7}
              >
                <View style={styles.zoomLabelContainer}>
                  <Text
                    style={[
                      styles.zoomButtonText,
                      isSelected && styles.zoomButtonTextActive,
                    ]}
                  >
                    {level.label}
                  </Text>
                  {isSelected && (
                    <Text style={[styles.zoomButtonText, styles.zoomButtonTextActive, styles.zoomSuffix]}>
                      x
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
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
          {/* Darkroom Card Stack Button */}
          <DarkroomCardButton
            count={darkroomCounts.totalCount}
            onPress={() => setIsBottomSheetVisible(true)}
            scaleAnim={cardScale}
            fanSpreadAnim={cardFanSpread}
          />

          {/* Capture Button (center) - 10% larger with spaced ring, two-stage haptic */}
          <Pressable
            style={({ pressed }) => [
              styles.captureButtonOuter,
              isCapturing && styles.captureButtonDisabled,
              pressed && styles.captureButtonPressed,
            ]}
            onPressIn={() => {
              // First stage: light haptic on finger down (like half-press shutter)
              lightImpact();
            }}
            onPressOut={takePicture}
            disabled={isCapturing}
          >
            <View style={styles.captureButton}>
              <View style={styles.captureButtonInner} />
            </View>
          </Pressable>

          {/* Invisible spacer to balance darkroom button and center capture button */}
          <View style={styles.footerSpacer} />
        </View>
      </View>

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

// Card dimensions for darkroom button (4:3 aspect ratio like a photo)
const CARD_WIDTH = 63; // ~95% of capture button size (84 * 0.75 for 4:3 aspect)
const CARD_HEIGHT = 84; // ~95% of capture button diameter (88 * 0.95)

// Base fanning values (at rest state)
// Back cards fan RIGHT, top card leans LEFT to keep stack visually centered
const BASE_ROTATION_PER_CARD = 6; // degrees - back cards rotate right (positive)
const BASE_OFFSET_PER_CARD = 5; // pixels - back cards offset right (positive)
// Animation spread multiplier (how much more fanning during animation)
const SPREAD_ROTATION_MULTIPLIER = 2.5; // rotation increases by this factor
const SPREAD_OFFSET_MULTIPLIER = 2; // offset increases by this factor

// DarkroomCardButton Component - photo card stack design with capture animation
const DarkroomCardButton = ({ count, onPress, scaleAnim, fanSpreadAnim }) => {
  const isDisabled = count === 0;

  // Determine number of cards to show (1-4 max)
  const cardCount = Math.min(Math.max(count, 1), 4);

  const handlePress = () => {
    if (onPress) {
      logger.info('DarkroomCardButton: Opening bottom sheet', { count });
      onPress();
    }
  };

  // Render stack of cards with animated transforms
  const renderCards = () => {
    const cards = [];

    // Calculate center compensation - shifts entire stack left so it stays visually centered
    // The more cards, the more we need to shift left to compensate for right-fanning
    const centerCompensation = ((cardCount - 1) * BASE_OFFSET_PER_CARD) / 2;
    const rotationCompensation = ((cardCount - 1) * BASE_ROTATION_PER_CARD) / 2;

    for (let i = 0; i < cardCount; i++) {
      const isTopCard = i === cardCount - 1;

      // Calculate position from top (0 = top, higher = further back)
      const positionFromTop = cardCount - 1 - i;

      // Base rotation and offset (at rest)
      // Back cards fan RIGHT, but we subtract compensation to keep stack centered
      const baseRotation = (positionFromTop * BASE_ROTATION_PER_CARD) - rotationCompensation;
      const baseOffset = (positionFromTop * BASE_OFFSET_PER_CARD) - centerCompensation;

      // Single card has no fanning
      if (cardCount === 1) {
        cards.push(
          <Animated.View
            key={i}
            style={[
              styles.darkroomCard,
              {
                position: 'absolute',
                transform: scaleAnim ? [{ scale: scaleAnim }] : [],
                zIndex: 1,
              },
            ]}
          >
            <Text style={styles.darkroomCardText}>
              {count > 99 ? '99+' : count}
            </Text>
          </Animated.View>
        );
        continue;
      }

      // Animated rotation interpolation: base + (spread * multiplier)
      const animatedRotation = fanSpreadAnim
        ? fanSpreadAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [
              `${baseRotation}deg`,
              `${baseRotation * SPREAD_ROTATION_MULTIPLIER}deg`,
            ],
          })
        : `${baseRotation}deg`;

      // Animated offset interpolation
      const animatedOffset = fanSpreadAnim
        ? fanSpreadAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [baseOffset, baseOffset * SPREAD_OFFSET_MULTIPLIER],
          })
        : baseOffset;

      // Animated Y offset - cards move up during spread
      const animatedTranslateY = fanSpreadAnim
        ? fanSpreadAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -positionFromTop * 4], // Cards rise upward during animation
          })
        : 0;

      cards.push(
        <Animated.View
          key={i}
          style={[
            styles.darkroomCard,
            {
              position: 'absolute',
              transform: [
                { rotate: animatedRotation },
                { translateX: animatedOffset },
                { translateY: animatedTranslateY },
                ...(scaleAnim ? [{ scale: scaleAnim }] : []),
              ],
              zIndex: i + 1, // Higher index = on top
            },
          ]}
        >
          {/* Only show count on top card */}
          {isTopCard && (
            <Text style={styles.darkroomCardText}>
              {count > 99 ? '99+' : count}
            </Text>
          )}
        </Animated.View>
      );
    }

    return cards;
  };

  return (
    <TouchableOpacity
      style={[
        styles.darkroomCardContainer,
        isDisabled && styles.darkroomCardDisabled,
      ]}
      onPress={handlePress}
      disabled={isDisabled}
    >
      {renderCards()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  // Camera container - edge-to-edge with rounded bottom corners only
  cameraContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: CAMERA_HEIGHT,
    borderBottomLeftRadius: CAMERA_BORDER_RADIUS,
    borderBottomRightRadius: CAMERA_BORDER_RADIUS,
    overflow: 'hidden',
    borderWidth: 0, // Explicitly remove any border
    backgroundColor: '#000000', // Match container background to prevent outline artifacts
  },
  // Camera - fills the container
  camera: {
    flex: 1,
  },
  // Floating controls row - positioned above footer, over camera preview
  floatingControls: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT + FOOTER_HEIGHT + FLOATING_BUTTON_OFFSET,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
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
  // Footer bar - absolute positioned, black background (matches nav bar), above tab bar
  footerBar: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT,
    left: 0,
    right: 0,
    height: FOOTER_HEIGHT,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
    paddingHorizontal: 40,
    width: '100%',
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
  zoomLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  zoomButtonTextActive: {
    color: '#FFFFFF',
  },
  zoomSuffix: {
    fontSize: 12, // Slightly smaller for the 'x'
    marginLeft: 1,
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
  // Darkroom card stack container - holds fanned cards
  darkroomCardContainer: {
    width: CARD_WIDTH + 20, // Extra space for fanning offset (increased for larger cards)
    height: CARD_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  darkroomCardDisabled: {
    opacity: 0.4,
  },
  // Individual card in the stack
  darkroomCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    // Card shadow for depth
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  // Number displayed inside the top card
  darkroomCardText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Invisible spacer to balance darkroom button and center capture button
  footerSpacer: {
    width: CARD_WIDTH + 20, // Match container width
    height: CARD_HEIGHT,
    opacity: 0,
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
  captureButtonPressed: {
    opacity: 0.7,
  },
  captureButtonInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
  },
  // Flash overlay for camera shutter effect - contained within camera preview
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: CAMERA_BORDER_RADIUS,
    borderBottomRightRadius: CAMERA_BORDER_RADIUS,
    zIndex: 100,
  },
});

export default CameraScreen;