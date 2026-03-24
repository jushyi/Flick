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
import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import * as ImageManipulator from 'expo-image-manipulator';

import { useAuth } from '../context/AuthContext';
import { createPhotoRecord } from '../services/supabase/photoService';
import { calculateBatchRevealAt } from '../services/supabase/darkroomService';
import { getPowerSyncDb } from '../lib/powersync/PowerSyncProvider';
import { addToQueue, initializeQueue } from '../services/uploadQueueService';
import logger from '../utils/logger';
import { lightImpact, mediumImpact } from '../utils/haptics';

// Generate UUID v4 (same pattern as uploadQueueService)
const generateUUID = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

// Recording constants
export const HOLD_THRESHOLD_MS = 500;
export const MAX_RECORDING_DURATION = 30; // seconds

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
const useCameraBase = ({ mode = 'normal', onSnapCapture = null } = {}) => {
  const isSnapMode = mode === 'snap';
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();

  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

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

  // Video recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  // Android can't take photos in video mode — use picture mode by default, switch for recording
  // iOS supports both in video mode, so stay in video mode always
  const [cameraMode, setCameraMode] = useState(Platform.OS === 'ios' ? 'video' : 'picture');
  const holdTimerRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const isFacingLockedRef = useRef(false);
  const recordingDurationRef = useRef(0); // Ref mirror for async access
  const stopRequestedRef = useRef(false);
  const cameraReadyRef = useRef(true);
  const cameraReadyResolverRef = useRef(null);

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

  // Request microphone permission eagerly so first recording doesn't fail
  useEffect(() => {
    if (!micPermission?.granted) {
      requestMicPermission();
    }
  }, [micPermission, requestMicPermission]);

  // Load darkroom counts from PowerSync local SQLite on mount and poll every 30s
  useEffect(() => {
    if (!user) return;

    const loadDarkroomCounts = async () => {
      const db = getPowerSyncDb();
      if (!db) return;

      try {
        const [devResult, revResult] = await Promise.all([
          db.get(
            "SELECT COUNT(*) as count FROM photos WHERE user_id = ? AND status = 'developing' AND deleted_at IS NULL",
            [user.uid]
          ),
          db.get(
            "SELECT COUNT(*) as count FROM photos WHERE user_id = ? AND status = 'revealed' AND deleted_at IS NULL",
            [user.uid]
          ),
        ]);

        const developingCount = devResult?.count ?? 0;
        const revealedCount = revResult?.count ?? 0;
        const counts = {
          totalCount: developingCount + revealedCount,
          developingCount,
          revealedCount,
        };
        logger.debug('useCameraBase: Darkroom counts updated', counts);
        setDarkroomCounts(counts);
      } catch (error) {
        logger.warn('useCameraBase: Failed to load darkroom counts', { error: error.message });
      }
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
        const db = getPowerSyncDb();
        if (!db) return;

        try {
          logger.info('useCameraBase: Reloading darkroom counts on focus');
          const [devResult, revResult] = await Promise.all([
            db.get(
              "SELECT COUNT(*) as count FROM photos WHERE user_id = ? AND status = 'developing' AND deleted_at IS NULL",
              [user.uid]
            ),
            db.get(
              "SELECT COUNT(*) as count FROM photos WHERE user_id = ? AND status = 'revealed' AND deleted_at IS NULL",
              [user.uid]
            ),
          ]);

          const developingCount = devResult?.count ?? 0;
          const revealedCount = revResult?.count ?? 0;
          const counts = {
            totalCount: developingCount + revealedCount,
            developingCount,
            revealedCount,
          };
          logger.debug('useCameraBase: Darkroom counts after focus', counts);
          setDarkroomCounts(counts);
        } catch (error) {
          logger.warn('useCameraBase: Failed to reload darkroom counts on focus', {
            error: error.message,
          });
        }
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
          const db = getPowerSyncDb();
          if (db) {
            try {
              const [devResult, revResult] = await Promise.all([
                db.get(
                  "SELECT COUNT(*) as count FROM photos WHERE user_id = ? AND status = 'developing' AND deleted_at IS NULL",
                  [user.uid]
                ),
                db.get(
                  "SELECT COUNT(*) as count FROM photos WHERE user_id = ? AND status = 'revealed' AND deleted_at IS NULL",
                  [user.uid]
                ),
              ]);
              const developingCount = devResult?.count ?? 0;
              const revealedCount = revResult?.count ?? 0;
              const counts = {
                totalCount: developingCount + revealedCount,
                developingCount,
                revealedCount,
              };
              logger.debug('useCameraBase: Fresh counts from notification', counts);
              setDarkroomCounts(counts);
            } catch (error) {
              logger.warn('useCameraBase: Failed to refresh counts', { error: error.message });
            }
          }
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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  // Camera ready callback (needed for Android mode switches)
  const handleCameraReady = useCallback(() => {
    cameraReadyRef.current = true;
    if (cameraReadyResolverRef.current) {
      cameraReadyResolverRef.current();
      cameraReadyResolverRef.current = null;
    }
  }, []);

  const waitForCameraReady = useCallback(() => {
    if (cameraReadyRef.current) return Promise.resolve();
    return new Promise(resolve => {
      cameraReadyResolverRef.current = resolve;
      setTimeout(() => {
        if (cameraReadyResolverRef.current) {
          cameraReadyResolverRef.current();
          cameraReadyResolverRef.current = null;
        }
      }, 3000);
    });
  }, []);

  // Handle completed video recording
  const handleRecordingComplete = useCallback(
    async result => {
      if (!result?.uri) {
        logger.warn('useCameraBase: recordAsync resolved with no URI');
        return;
      }

      const duration = recordingDurationRef.current;
      logger.info('useCameraBase: Recording complete', { uri: result.uri, duration });

      if (isSnapMode && onSnapCapture) {
        onSnapCapture({ uri: result.uri, mediaType: 'video' });
        return;
      }

      // Create video record in PowerSync local SQLite (immediate darkroom visibility)
      const videoId = generateUUID();
      const revealAt = await calculateBatchRevealAt(user.uid);
      await createPhotoRecord(user.uid, videoId, result.uri, revealAt, 'video');

      // Normal mode: queue for background upload — passes videoId for post-upload URL update
      addToQueue(user.uid, result.uri, 'video', duration, videoId);

      // Play card stack animation (same as photo)
      playCardCaptureAnimation();

      // Optimistically update badge count (+1 developing)
      setDarkroomCounts(prev => ({
        ...prev,
        developingCount: prev.developingCount + 1,
        totalCount: prev.totalCount + 1,
      }));

      logger.info('useCameraBase: Video record created and queued for upload', { videoId });
    },
    [isSnapMode, onSnapCapture, user, playCardCaptureAnimation]
  );

  // Start recording video
  const startRecording = useCallback(async () => {
    if (!cameraRef.current || !user) return;

    // Check if stop was already requested (user released before we got here)
    if (stopRequestedRef.current) {
      stopRequestedRef.current = false;
      return;
    }

    try {
      // Android: switch to video mode and wait for camera reconfiguration
      if (Platform.OS === 'android') {
        cameraReadyRef.current = false;
        setCameraMode('video');
        await waitForCameraReady();

        // Re-check stop requested after async wait
        if (stopRequestedRef.current) {
          stopRequestedRef.current = false;
          setCameraMode('picture');
          return;
        }
      }

      // Haptic feedback for recording start
      lightImpact();

      setIsRecording(true);
      isFacingLockedRef.current = true;
      recordingDurationRef.current = 0;
      setRecordingDuration(0);

      // Start duration tracker (every 1 second)
      recordingTimerRef.current = setInterval(() => {
        recordingDurationRef.current += 1;
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      logger.info('useCameraBase: Starting video recording', {
        maxDuration: MAX_RECORDING_DURATION,
      });

      // recordAsync returns a promise that resolves when recording stops
      const result = await cameraRef.current.recordAsync({
        maxDuration: MAX_RECORDING_DURATION,
      });

      // Recording finished (user stopped or maxDuration reached)
      handleRecordingComplete(result);
    } catch (error) {
      logger.error('useCameraBase: Error during recording', { error: error.message });
    } finally {
      // Clean up recording state
      setIsRecording(false);
      isFacingLockedRef.current = false;
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      // Android: switch back to picture mode
      if (Platform.OS === 'android') {
        setCameraMode('picture');
      }
    }
  }, [user, handleRecordingComplete, waitForCameraReady]);

  // Handle press in (start hold timer)
  const handlePressIn = useCallback(() => {
    // Ignore new presses while recording (prevents multi-touch interference)
    if (isRecording) return;

    lightImpact(); // Immediate tactile feedback

    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      startRecording();
    }, HOLD_THRESHOLD_MS);
  }, [startRecording, isRecording]);

  // Take a photo (used by handlePressOut for tap-to-capture)
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

      logger.debug('useCameraBase: Photo captured', { uri: photo.uri, facing });

      // Front camera photos come out mirrored — flip horizontally to correct
      let photoUri = photo.uri;
      if (facing === 'front') {
        try {
          const flipped = await ImageManipulator.manipulateAsync(
            photo.uri,
            [{ flip: ImageManipulator.FlipType.Horizontal }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
          );
          photoUri = flipped.uri;
          logger.debug('useCameraBase: Front camera photo flipped', { uri: photoUri });
        } catch (flipError) {
          logger.warn('useCameraBase: Failed to flip front camera photo', {
            error: flipError.message,
          });
        }
      }

      // In snap mode, return photo URI directly without queueing
      if (isSnapMode) {
        logger.info('useCameraBase: Snap mode capture, returning URI directly');
        return photoUri;
      }

      // Create photo record in PowerSync local SQLite (immediate darkroom visibility)
      const photoId = generateUUID();
      const revealAt = await calculateBatchRevealAt(user.uid);
      await createPhotoRecord(user.uid, photoId, photoUri, revealAt, 'photo');

      // Queue for background upload (non-blocking) — passes photoId for post-upload URL update
      addToQueue(user.uid, photoUri, 'photo', null, photoId);

      // Play card stack animation (fan out + scale)
      playCardCaptureAnimation();

      // Optimistically update badge count (+1 developing)
      setDarkroomCounts(prev => ({
        ...prev,
        developingCount: prev.developingCount + 1,
        totalCount: prev.totalCount + 1,
      }));

      logger.info('useCameraBase: Photo record created and queued for upload', { photoId });
    } catch (error) {
      logger.error('useCameraBase: Error capturing photo', error);
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, user, facing, playFlashEffect, playCardCaptureAnimation, isSnapMode]);

  // Handle press out (stop recording or take photo)
  const handlePressOut = useCallback(async () => {
    // If hold timer is still pending, it was a tap — take a photo
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;

      if (isSnapMode && onSnapCapture) {
        // Snap mode photo: capture and call callback
        const photoUri = await takePicture();
        if (photoUri) {
          onSnapCapture({ uri: photoUri, mediaType: 'photo' });
        }
      } else {
        // Normal mode photo
        takePicture();
      }
      return;
    }

    // If recording, stop it
    if (isRecording && cameraRef.current) {
      lightImpact(); // Recording-stop haptic
      try {
        cameraRef.current.stopRecording();
      } catch (error) {
        logger.warn('useCameraBase: Error stopping recording', { error: error.message });
      }
    } else {
      // Recording hasn't started yet (startRecording still pending)
      // Signal it to abort when it runs
      stopRequestedRef.current = true;
    }
  }, [isSnapMode, onSnapCapture, isRecording, takePicture]);

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

    // Video recording state
    isRecording,
    cameraMode,
    recordingDuration,
    isFacingLockedRef,
    handleCameraReady,

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
    handlePressIn,
    handlePressOut,

    // Bottom sheet handlers
    openBottomSheet,
    closeBottomSheet,
    handleBottomSheetComplete,

    // Constants (for UI components)
    MAX_RECORDING_DURATION,
  };
};

export default useCameraBase;
