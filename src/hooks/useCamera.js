/**
 * useCamera hook
 *
 * Extracted from CameraScreen.js as part of three-way separation refactoring.
 * Contains all camera state, effects, handlers, and animation logic.
 *
 * Features:
 * - Camera permission state management
 * - Camera facing, flash, zoom controls
 * - iOS ultra-wide lens detection and switching
 * - Darkroom counts loading and polling
 * - Photo capture with queue integration
 * - Flash effect and card stack capture animations
 * - Bottom sheet visibility state
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Animated, Platform, Dimensions } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getDarkroomCounts } from '../services/firebase/photoService';
import { addToQueue, initializeQueue } from '../services/uploadQueueService';
import logger from '../utils/logger';
import { lightImpact, mediumImpact } from '../utils/haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Zoom level configuration
// expo-camera zoom is 0-1 range where 0 is baseline (1x) and 1 is max zoom
// Base zoom levels (always available)
const ZOOM_LEVELS_BASE = [
  { label: '1', value: 1, lens: null, cameraZoom: 0 }, // Baseline (true 1x, no zoom)
  { label: '2', value: 2, lens: null, cameraZoom: 0.17 }, // 2x zoom
  { label: '3', value: 3, lens: null, cameraZoom: 0.33 }, // 3x telephoto
];

// Ultra-wide lens level (iOS only, when device supports it)
// Lens string from iOS AVFoundation - will be matched against actual values from device
const ULTRA_WIDE_LEVEL = {
  label: '0.5',
  value: 0.5,
  lens: 'ultra-wide', // Marker - actual lens string comes from availableLenses
  cameraZoom: 0, // Ultra-wide uses native lens, not digital zoom
};

// Layout constants (exported for component use)
export const TAB_BAR_HEIGHT = 65; // Bottom tab navigator height (includes safe area)
export const FOOTER_HEIGHT = 200; // Covers ~1/4 of screen for iOS-native camera feel
export const CAMERA_HEIGHT = SCREEN_HEIGHT - FOOTER_HEIGHT - TAB_BAR_HEIGHT;
export const CAMERA_BORDER_RADIUS = 24; // Rounded corners for camera preview
export const FLOATING_BUTTON_SIZE = 45; // Flash, flip buttons (10% smaller, floating above footer)
export const FLOATING_BUTTON_OFFSET = 8; // Distance above footer edge

// Card dimensions for darkroom button (4:3 aspect ratio like a photo)
export const CARD_WIDTH = 63; // ~95% of capture button size (84 * 0.75 for 4:3 aspect)
export const CARD_HEIGHT = 84; // ~95% of capture button diameter (88 * 0.95)

// Card fanning configuration
export const BASE_ROTATION_PER_CARD = 6; // degrees - back cards rotate right (positive)
export const BASE_OFFSET_PER_CARD = 5; // pixels - back cards offset right (positive)
export const SPREAD_ROTATION_MULTIPLIER = 2.5; // rotation increases by this factor
export const SPREAD_OFFSET_MULTIPLIER = 2; // offset increases by this factor

/**
 * Custom hook for camera screen logic
 *
 * @returns {object} - Camera state, handlers, animations, and refs
 */
const useCamera = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();

  // Camera state
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [zoom, setZoom] = useState(ZOOM_LEVELS_BASE[0]); // Default to 1x
  const [isCapturing, setIsCapturing] = useState(false);

  // Darkroom state
  const [darkroomCounts, setDarkroomCounts] = useState({
    totalCount: 0,
    developingCount: 0,
    revealedCount: 0,
  });
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);

  // Flash effect state
  const [showFlash, setShowFlash] = useState(false);

  // Ultra-wide lens state (iOS only)
  const [availableLenses, setAvailableLenses] = useState([]);
  const [selectedLens, setSelectedLens] = useState(null);
  const [hasUltraWide, setHasUltraWide] = useState(false);

  // Refs
  const cameraRef = useRef(null);

  // Animation values
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const cardFanSpread = useRef(new Animated.Value(0)).current;

  // Get wide-angle lens string (typically "Back Camera") for base zoom levels
  const wideAngleLens = useMemo(() => {
    if (Platform.OS !== 'ios' || facing !== 'back' || availableLenses.length === 0) {
      return null;
    }
    // Look for standard wide-angle camera
    return availableLenses.find(lens => lens.toLowerCase() === 'back camera') || null;
  }, [availableLenses, facing]);

  // Get front camera lens string (typically "Front TrueDepth Camera") for front zoom levels
  const frontCameraLens = useMemo(() => {
    if (Platform.OS !== 'ios' || facing !== 'front' || availableLenses.length === 0) {
      return null;
    }
    return availableLenses.find(lens => lens.toLowerCase().includes('front')) || null;
  }, [availableLenses, facing]);

  // Build dynamic zoom levels based on device capabilities (iOS lens detection)
  const zoomLevels = useMemo(() => {
    // Front camera on iOS: use detected lens for true 0.5x (full sensor width)
    if (Platform.OS === 'ios' && facing === 'front') {
      return [
        { label: '0.5', value: 0.5, lens: frontCameraLens, cameraZoom: 0 }, // Full sensor (widest)
        { label: '1', value: 1, lens: frontCameraLens, cameraZoom: 0.05 }, // Standard selfie framing
        { label: '2', value: 2, lens: frontCameraLens, cameraZoom: 0.17 }, // 2x digital zoom
        { label: '3', value: 3, lens: frontCameraLens, cameraZoom: 0.33 }, // 3x digital zoom
      ];
    }

    // Build base levels with explicit wide-angle lens (on iOS) or null (on Android)
    const baseLevels = ZOOM_LEVELS_BASE.map(level => ({
      ...level,
      lens: wideAngleLens, // Explicit lens instead of null
    }));

    // Add 0.5x only on iOS with ultra-wide support, on back camera
    if (Platform.OS === 'ios' && hasUltraWide && facing === 'back') {
      const ultraWideLens = availableLenses.find(
        lens =>
          lens.toLowerCase().includes('ultra wide') || lens.toLowerCase().includes('ultrawide')
      );
      logger.debug('useCamera: Building zoom levels with ultra-wide', {
        ultraWideLens,
        wideAngleLens,
        facing,
      });
      return [{ ...ULTRA_WIDE_LEVEL, lens: ultraWideLens }, ...baseLevels];
    }
    return baseLevels;
  }, [hasUltraWide, facing, availableLenses, wideAngleLens, frontCameraLens]);

  // Fallback: Try to get lenses via async method when camera ref is available
  useEffect(() => {
    const checkLensesAsync = async () => {
      if (Platform.OS === 'ios' && cameraRef.current && !hasUltraWide && facing === 'back') {
        try {
          const lenses = await cameraRef.current.getAvailableLensesAsync();
          logger.info('useCamera: Got lenses via async method', { lenses });
          if (lenses && lenses.length > 0) {
            setAvailableLenses(lenses);
            const hasUW = lenses.some(
              lens =>
                lens.toLowerCase().includes('ultra wide') ||
                lens.toLowerCase().includes('ultrawide')
            );
            setHasUltraWide(hasUW);
            if (hasUW) {
              logger.info('useCamera: Ultra-wide lens detected via async method');
            }
          }
        } catch (error) {
          logger.debug('useCamera: getAvailableLensesAsync not available or failed', {
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
      logger.debug('useCamera: Darkroom counts updated', counts);
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
        logger.info('useCamera: Reloading darkroom counts on focus');
        const counts = await getDarkroomCounts(user.uid);
        logger.debug('useCamera: Darkroom counts after focus', counts);
        setDarkroomCounts(counts);
      };

      loadDarkroomCounts();
    }, [user])
  );

  // Handle openDarkroom param from notification deep link
  useEffect(() => {
    logger.debug('useCamera: route.params changed', { params: route.params });
    if (route.params?.openDarkroom) {
      logger.info('useCamera: Opening darkroom from notification deep link');

      // Refresh darkroom counts first to get latest status (revealed vs developing)
      // This prevents showing stale "developing" state when photos have been revealed
      const refreshAndOpen = async () => {
        if (user) {
          logger.info('useCamera: Refreshing darkroom counts before opening sheet');
          const counts = await getDarkroomCounts(user.uid);
          logger.debug('useCamera: Fresh counts from notification', counts);
          setDarkroomCounts(counts);
        }
        setIsBottomSheetVisible(true);
      };

      refreshAndOpen();

      // Clear the param to prevent re-opening on subsequent renders
      navigation.setParams({ openDarkroom: undefined });
    }
  }, [route.params, navigation, user]);

  // Debug: Log lens changes to verify switching works
  useEffect(() => {
    logger.info('useCamera: selectedLens changed', { selectedLens });
  }, [selectedLens]);

  // Set the correct lens when availableLenses becomes available (iOS only)
  // This ensures the camera uses the standard wide-angle lens (1x) on launch, not ultra-wide
  useEffect(() => {
    if (Platform.OS === 'ios' && wideAngleLens && !selectedLens && facing === 'back') {
      logger.info('useCamera: Setting initial lens to wide-angle on mount', { wideAngleLens });
      setSelectedLens(wideAngleLens);
    }
  }, [wideAngleLens, selectedLens, facing]);

  // Set the front camera lens when detected (same pattern as back camera)
  useEffect(() => {
    if (Platform.OS === 'ios' && frontCameraLens && !selectedLens && facing === 'front') {
      logger.info('useCamera: Setting initial lens to front camera', { frontCameraLens });
      setSelectedLens(frontCameraLens);
    }
  }, [frontCameraLens, selectedLens, facing]);

  // Handlers

  const toggleCameraFacing = useCallback(() => {
    lightImpact();
    const newFacing = facing === 'back' ? 'front' : 'back';

    if (Platform.OS === 'ios') {
      if (newFacing === 'front') {
        // Clear lens — front camera initial lens effect will set it when detected
        setSelectedLens(null);
        // Map current zoom value to front camera level (lens will be set by effect)
        const frontZoomMap = { 0.5: 0, 1: 0.05, 2: 0.17, 3: 0.33 };
        const cameraZoom = frontZoomMap[zoom.value] ?? 0.05;
        setZoom({ label: String(zoom.value), value: zoom.value, lens: null, cameraZoom });
      } else {
        // Switching to back camera
        if (zoom.value === 0.5) {
          if (hasUltraWide) {
            const uwLens = availableLenses.find(
              l => l.toLowerCase().includes('ultra wide') || l.toLowerCase().includes('ultrawide')
            );
            setSelectedLens(uwLens || null);
            setZoom({ ...ULTRA_WIDE_LEVEL, lens: uwLens });
          } else {
            // No ultra-wide on back, reset to 1x
            setZoom({ ...ZOOM_LEVELS_BASE[0], lens: wideAngleLens });
            setSelectedLens(wideAngleLens);
          }
        } else {
          const baseLevel =
            ZOOM_LEVELS_BASE.find(l => l.value === zoom.value) || ZOOM_LEVELS_BASE[0];
          setZoom({ ...baseLevel, lens: wideAngleLens });
          setSelectedLens(wideAngleLens);
        }
      }
    }

    setFacing(newFacing);
  }, [facing, zoom.value, hasUltraWide, availableLenses, wideAngleLens]);

  const toggleFlash = useCallback(() => {
    lightImpact();
    setFlash(current => {
      if (current === 'on') return 'off';
      if (current === 'off') return 'auto';
      return 'on';
    });
  }, []);

  const handleZoomChange = useCallback(
    zoomLevel => {
      if (zoomLevel.value !== zoom.value) {
        lightImpact();
        setZoom(zoomLevel);
        // Set lens for ultra-wide, null for standard zoom (iOS only)
        if (Platform.OS === 'ios') {
          setSelectedLens(zoomLevel.lens || null);
        }
        logger.info('useCamera: Zoom level changed', {
          from: zoom.value,
          to: zoomLevel.value,
          lens: zoomLevel.lens,
          selectedLens: zoomLevel.lens || null,
        });
      }
    },
    [zoom.value]
  );

  // Play flash effect on capture (simulates camera shutter)
  const playFlashEffect = useCallback(() => {
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
  }, [flashOpacity]);

  // Play card stack capture animation - cards fan out and enlarge, then snap back
  const playCardCaptureAnimation = useCallback(() => {
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
  }, [cardScale, cardFanSpread]);

  const takePicture = useCallback(async () => {
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

      logger.debug('useCamera: Photo captured', { uri: photo.uri });

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

      logger.info('useCamera: Photo queued for background upload');
    } catch (error) {
      logger.error('useCamera: Error capturing photo', error);
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, user, playFlashEffect, playCardCaptureAnimation]);

  // Handle available lenses change (iOS only, from CameraView callback)
  const handleAvailableLensesChanged = useCallback(event => {
    // iOS only: Detect available lenses including ultra-wide
    if (Platform.OS === 'ios' && event?.lenses) {
      logger.info('useCamera: onAvailableLensesChanged fired', {
        lenses: event.lenses,
        count: event.lenses.length,
      });
      setAvailableLenses(event.lenses);
      // Check for ultra-wide: "Back Ultra Wide Camera" or "builtInUltraWideCamera"
      const hasUW = event.lenses.some(
        lens =>
          lens.toLowerCase().includes('ultra wide') || lens.toLowerCase().includes('ultrawide')
      );
      setHasUltraWide(hasUW);
      logger.info('useCamera: Ultra-wide detection result', {
        hasUltraWide: hasUW,
        lenses: event.lenses,
      });
    }
  }, []);

  // Bottom sheet handlers
  const openBottomSheet = useCallback(() => {
    setIsBottomSheetVisible(true);
  }, []);

  const closeBottomSheet = useCallback(() => {
    logger.debug('useCamera: Bottom sheet closed');
    setIsBottomSheetVisible(false);
  }, []);

  const handleBottomSheetComplete = useCallback(() => {
    logger.info('useCamera: Navigating to Darkroom after press-and-hold', {
      revealedCount: darkroomCounts.revealedCount,
      developingCount: darkroomCounts.developingCount,
      totalCount: darkroomCounts.totalCount,
    });
    setIsBottomSheetVisible(false);
    navigation.navigate('Darkroom');
  }, [darkroomCounts, navigation]);

  return {
    // User
    user,

    // Camera permissions
    permission,
    requestPermission,

    // Camera state
    facing,
    flash,
    zoom,
    isCapturing,
    zoomLevels,
    selectedLens,

    // Darkroom state
    darkroomCounts,
    isBottomSheetVisible,

    // Flash effect state
    showFlash,

    // Refs
    cameraRef,

    // Animation values
    flashOpacity,
    cardScale,
    cardFanSpread,

    // Handlers
    toggleCameraFacing,
    toggleFlash,
    handleZoomChange,
    takePicture,
    handleAvailableLensesChanged,

    // Bottom sheet handlers
    openBottomSheet,
    closeBottomSheet,
    handleBottomSheetComplete,
  };
};

export default useCamera;
