/**
 * useCameraBase — shared camera logic
 *
 * Contains all platform-independent state, effects, and handlers.
 * Consumed by useCamera.ios.js and useCamera.android.js.
 *
 * Platform-specific lens detection and zoom level logic lives in:
 *   useCamera.ios.js    — iOS ultra-wide detection via AVFoundation lens strings
 *   useCamera.android.js — Android wide-angle detection via CameraX IDs
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Animated, Dimensions, Platform } from 'react-native';
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
// Base zoom levels (always available on any camera)
export const ZOOM_LEVELS_BASE = [
  { label: '1', value: 1, lens: null, cameraZoom: 0 }, // Baseline (true 1x, no zoom)
  { label: '2', value: 2, lens: null, cameraZoom: 0.17 }, // 2x zoom
  { label: '3', value: 3, lens: null, cameraZoom: 0.33 }, // 3x telephoto
];

// Ultra-wide lens level — actual lens string/ID is filled in per platform
export const ULTRA_WIDE_LEVEL = {
  label: '0.5',
  value: 0.5,
  lens: 'ultra-wide', // Marker — actual lens string/ID comes from platform detection
  cameraZoom: 0, // Ultra-wide uses native lens switch, not digital zoom
};

// Layout constants (exported for component use)
export const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 65 : 54; // Bottom tab navigator height
export const FOOTER_HEIGHT = 200; // Covers ~1/4 of screen for native camera feel
export const CAMERA_HEIGHT = SCREEN_HEIGHT - FOOTER_HEIGHT - TAB_BAR_HEIGHT;
export const CAMERA_BORDER_RADIUS = 24; // Rounded corners for camera preview
export const FLOATING_BUTTON_SIZE = 45; // Flash, flip buttons
export const FLOATING_BUTTON_OFFSET = 8; // Distance above footer edge

// Card dimensions for darkroom button (4:3 aspect ratio like a photo)
export const CARD_WIDTH = 63;
export const CARD_HEIGHT = 84;

// Card fanning configuration
export const BASE_ROTATION_PER_CARD = 6; // degrees
export const BASE_OFFSET_PER_CARD = 5; // pixels
export const SPREAD_ROTATION_MULTIPLIER = 2.5;
export const SPREAD_OFFSET_MULTIPLIER = 2;

/**
 * Shared camera base hook
 *
 * Provides all non-lens state, effects, and handlers. Platform-specific hooks
 * call this and layer their lens detection / zoom level logic on top.
 *
 * Exposes setFacing and setZoom so platform hooks can manage state transitions
 * during camera flips and zoom changes.
 */
const useCameraBase = ({ mode = 'normal' } = {}) => {
  const isSnapMode = mode === 'snap';
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

  const cameraRef = useRef(null);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const cardFanSpread = useRef(new Animated.Value(0)).current;

  // Initialize upload queue on app start (skip in snap mode)
  useEffect(() => {
    if (!isSnapMode) {
      initializeQueue();
    }
  }, [isSnapMode]);

  // Load darkroom counts on mount and poll every 30s
  useEffect(() => {
    if (!user) return;

    const loadDarkroomCounts = async () => {
      const counts = await getDarkroomCounts(user.uid);
      logger.debug('useCameraBase: Darkroom counts updated', counts);
      setDarkroomCounts(counts);
    };

    loadDarkroomCounts();

    const interval = setInterval(loadDarkroomCounts, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Reload counts when screen comes into focus (after returning from Darkroom)
  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      const loadDarkroomCounts = async () => {
        logger.info('useCameraBase: Reloading darkroom counts on focus');
        const counts = await getDarkroomCounts(user.uid);
        logger.debug('useCameraBase: Darkroom counts after focus', counts);
        setDarkroomCounts(counts);
      };

      loadDarkroomCounts();
    }, [user])
  );

  // Handle openDarkroom param from notification deep link
  useEffect(() => {
    logger.debug('useCameraBase: route.params changed', { params: route.params });
    if (route.params?.openDarkroom) {
      logger.info('useCameraBase: Opening darkroom from notification deep link');

      const refreshAndOpen = async () => {
        if (user) {
          logger.info('useCameraBase: Refreshing darkroom counts before opening sheet');
          const counts = await getDarkroomCounts(user.uid);
          logger.debug('useCameraBase: Fresh counts from notification', counts);
          setDarkroomCounts(counts);
        }
        setIsBottomSheetVisible(true);
      };

      refreshAndOpen();
      navigation.setParams({ openDarkroom: undefined });
    }
  }, [route.params, navigation, user]);

  const toggleFlash = useCallback(() => {
    lightImpact();
    setFlash(current => {
      if (current === 'on') return 'off';
      if (current === 'off') return 'auto';
      return 'on';
    });
  }, []);

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

  // Play card stack capture animation — cards fan out and enlarge, then snap back
  const playCardCaptureAnimation = useCallback(() => {
    cardScale.setValue(1);
    cardFanSpread.setValue(0);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(cardScale, {
          toValue: 1.2,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(cardScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(cardFanSpread, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(cardFanSpread, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [cardScale, cardFanSpread]);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current || isCapturing || !user) return;

    try {
      setIsCapturing(true);
      mediumImpact();

      // Instant feedback: flash fires immediately on tap
      playFlashEffect();

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      logger.debug('useCameraBase: Photo captured', { uri: photo.uri });

      // In snap mode, return photo URI directly without queueing
      if (isSnapMode) {
        logger.info('useCameraBase: Snap mode capture, returning URI directly');
        return photo.uri;
      }

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

      logger.info('useCameraBase: Photo queued for background upload');
    } catch (error) {
      logger.error('useCameraBase: Error capturing photo', error);
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, user, playFlashEffect, playCardCaptureAnimation, isSnapMode]);

  const openBottomSheet = useCallback(() => {
    setIsBottomSheetVisible(true);
  }, []);

  const closeBottomSheet = useCallback(() => {
    logger.debug('useCameraBase: Bottom sheet closed');
    setIsBottomSheetVisible(false);
  }, []);

  const handleBottomSheetComplete = useCallback(() => {
    logger.info('useCameraBase: Navigating to Darkroom after press-and-hold', {
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

    // Mode
    isSnapMode,

    // Camera permissions
    permission,
    requestPermission,

    // Camera state (setters exposed for platform hooks)
    facing,
    setFacing,
    flash,
    zoom,
    setZoom,
    isCapturing,

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
    toggleFlash,
    playFlashEffect,
    playCardCaptureAnimation,
    takePicture,

    // Bottom sheet handlers
    openBottomSheet,
    closeBottomSheet,
    handleBottomSheetComplete,
  };
};

export default useCameraBase;
