import { useState, useRef, useEffect, useCallback } from 'react';
import { Animated, Dimensions, Platform } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import * as ImageManipulator from 'expo-image-manipulator';

import { useAuth } from '../context/AuthContext';
import { createPhotoRecord } from '../services/supabase/photoService';
import { calculateBatchRevealAt } from '../services/supabase/darkroomService';
import { getPowerSyncDb } from '../lib/powersync/PowerSyncProvider';
import { addToQueue, initializeQueue } from '../services/uploadQueueService';
import logger from '../utils/logger';
import { lightImpact, mediumImpact } from '../utils/haptics';

const generateUUID = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

export const HOLD_THRESHOLD_MS = 500;
export const MAX_RECORDING_DURATION = 30;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export type ZoomLevel = {
  label: string;
  value: number;
  lens: string | null;
  cameraZoom: number;
};

export const ZOOM_LEVELS_BASE: ZoomLevel[] = [
  { label: '1', value: 1, lens: null, cameraZoom: 0 },
  { label: '2', value: 2, lens: null, cameraZoom: 0.17 },
  { label: '3', value: 3, lens: null, cameraZoom: 0.33 },
];

export const ULTRA_WIDE_LEVEL: ZoomLevel = {
  label: '0.5',
  value: 0.5,
  lens: 'ultra-wide',
  cameraZoom: 0,
};

export const TAB_BAR_HEIGHT: number = Platform.OS === 'ios' ? 65 : 54;
export const FOOTER_HEIGHT = 200;
export const CAMERA_HEIGHT: number = SCREEN_HEIGHT - FOOTER_HEIGHT - TAB_BAR_HEIGHT;
export const CAMERA_BORDER_RADIUS = 24;
export const FLOATING_BUTTON_SIZE = 45;
export const FLOATING_BUTTON_OFFSET = 8;

export const CARD_WIDTH = 63;
export const CARD_HEIGHT = 84;

export const BASE_ROTATION_PER_CARD = 6;
export const BASE_OFFSET_PER_CARD = 5;
export const SPREAD_ROTATION_MULTIPLIER = 2.5;
export const SPREAD_OFFSET_MULTIPLIER = 2;

type DarkroomCounts = {
  totalCount: number;
  developingCount: number;
  revealedCount: number;
};

type CameraBaseOptions = {
  mode?: 'normal' | 'snap';
  onSnapCapture?: ((media: { uri: string; mediaType: 'photo' | 'video' }) => void) | null;
};

type CameraFacing = 'front' | 'back';
type FlashMode = 'on' | 'off' | 'auto';
type CameraMode = 'video' | 'picture';

export type UseCameraBaseReturn = {
  user: { uid: string } | null;
  isSnapMode: boolean;
  permission: ReturnType<typeof useCameraPermissions>[0];
  requestPermission: ReturnType<typeof useCameraPermissions>[1];
  facing: CameraFacing;
  setFacing: React.Dispatch<React.SetStateAction<CameraFacing>>;
  flash: FlashMode;
  zoom: ZoomLevel;
  setZoom: React.Dispatch<React.SetStateAction<ZoomLevel>>;
  isCapturing: boolean;
  isRecording: boolean;
  cameraMode: CameraMode;
  recordingDuration: number;
  isFacingLockedRef: React.MutableRefObject<boolean>;
  handleCameraReady: () => void;
  darkroomCounts: DarkroomCounts;
  isBottomSheetVisible: boolean;
  showFlash: boolean;
  cameraRef: React.RefObject<CameraView | null>;
  flashOpacity: Animated.Value;
  cardScale: Animated.Value;
  cardFanSpread: Animated.Value;
  toggleFlash: () => void;
  playFlashEffect: () => void;
  playCardCaptureAnimation: () => void;
  takePicture: () => Promise<string | undefined>;
  handlePressIn: () => void;
  handlePressOut: () => Promise<void>;
  openBottomSheet: () => void;
  closeBottomSheet: () => void;
  handleBottomSheetComplete: () => void;
  MAX_RECORDING_DURATION: number;
};

const useCameraBase = ({ mode = 'normal', onSnapCapture = null }: CameraBaseOptions = {}): UseCameraBaseReturn => {
  const isSnapMode = mode === 'snap';
  const { user } = useAuth() as { user: { uid: string } | null };
  const navigation = useNavigation();
  const route = useRoute();

  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const [facing, setFacing] = useState<CameraFacing>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [zoom, setZoom] = useState<ZoomLevel>(ZOOM_LEVELS_BASE[0]);
  const [isCapturing, setIsCapturing] = useState(false);

  const [darkroomCounts, setDarkroomCounts] = useState<DarkroomCounts>({
    totalCount: 0,
    developingCount: 0,
    revealedCount: 0,
  });
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);
  const [showFlash, setShowFlash] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [cameraMode, setCameraMode] = useState<CameraMode>(Platform.OS === 'ios' ? 'video' : 'picture');
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFacingLockedRef = useRef(false);
  const recordingDurationRef = useRef(0);
  const stopRequestedRef = useRef(false);
  const cameraReadyRef = useRef(true);
  const cameraReadyResolverRef = useRef<(() => void) | null>(null);

  const cameraRef = useRef<CameraView | null>(null);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const cardFanSpread = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isSnapMode) {
      initializeQueue();
    }
  }, [isSnapMode]);

  useEffect(() => {
    if (!micPermission?.granted) {
      requestMicPermission();
    }
  }, [micPermission, requestMicPermission]);

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
        const counts: DarkroomCounts = {
          totalCount: developingCount + revealedCount,
          developingCount,
          revealedCount,
        };
        logger.debug('useCameraBase: Darkroom counts updated', counts);
        setDarkroomCounts(counts);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn('useCameraBase: Failed to load darkroom counts', { error: message });
      }
    };

    loadDarkroomCounts();

    const interval = setInterval(loadDarkroomCounts, 30000);
    return () => clearInterval(interval);
  }, [user]);

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
          const counts: DarkroomCounts = {
            totalCount: developingCount + revealedCount,
            developingCount,
            revealedCount,
          };
          logger.debug('useCameraBase: Darkroom counts after focus', counts);
          setDarkroomCounts(counts);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          logger.warn('useCameraBase: Failed to reload darkroom counts on focus', {
            error: message,
          });
        }
      };

      loadDarkroomCounts();
    }, [user])
  );

  useEffect(() => {
    logger.debug('useCameraBase: route.params changed', { params: route.params });
    if ((route.params as Record<string, unknown>)?.openDarkroom) {
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
              const counts: DarkroomCounts = {
                totalCount: developingCount + revealedCount,
                developingCount,
                revealedCount,
              };
              logger.debug('useCameraBase: Fresh counts from notification', counts);
              setDarkroomCounts(counts);
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : String(error);
              logger.warn('useCameraBase: Failed to refresh counts', { error: message });
            }
          }
        }
        setIsBottomSheetVisible(true);
      };

      refreshAndOpen();
      (navigation as { setParams: (params: Record<string, unknown>) => void }).setParams({ openDarkroom: undefined });
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

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const handleCameraReady = useCallback(() => {
    cameraReadyRef.current = true;
    if (cameraReadyResolverRef.current) {
      cameraReadyResolverRef.current();
      cameraReadyResolverRef.current = null;
    }
  }, []);

  const waitForCameraReady = useCallback(() => {
    if (cameraReadyRef.current) return Promise.resolve();
    return new Promise<void>(resolve => {
      cameraReadyResolverRef.current = resolve;
      setTimeout(() => {
        if (cameraReadyResolverRef.current) {
          cameraReadyResolverRef.current();
          cameraReadyResolverRef.current = null;
        }
      }, 3000);
    });
  }, []);

  const handleRecordingComplete = useCallback(
    async (result: { uri: string } | null) => {
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

      const videoId = generateUUID();
      const revealAt = await calculateBatchRevealAt(user!.uid);
      await createPhotoRecord(user!.uid, videoId, result.uri, revealAt, 'video');

      addToQueue(user!.uid, result.uri, 'video', duration, videoId);

      playCardCaptureAnimation();

      setDarkroomCounts(prev => ({
        ...prev,
        developingCount: prev.developingCount + 1,
        totalCount: prev.totalCount + 1,
      }));

      logger.info('useCameraBase: Video record created and queued for upload', { videoId });
    },
    [isSnapMode, onSnapCapture, user, playCardCaptureAnimation]
  );

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || !user) return;

    if (stopRequestedRef.current) {
      stopRequestedRef.current = false;
      return;
    }

    try {
      if (Platform.OS === 'android') {
        cameraReadyRef.current = false;
        setCameraMode('video');
        await waitForCameraReady();

        if (stopRequestedRef.current) {
          stopRequestedRef.current = false;
          setCameraMode('picture');
          return;
        }
      }

      lightImpact();

      setIsRecording(true);
      isFacingLockedRef.current = true;
      recordingDurationRef.current = 0;
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        recordingDurationRef.current += 1;
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      logger.info('useCameraBase: Starting video recording', {
        maxDuration: MAX_RECORDING_DURATION,
      });

      const result = await cameraRef.current.recordAsync({
        maxDuration: MAX_RECORDING_DURATION,
      });

      handleRecordingComplete(result as { uri: string } | null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('useCameraBase: Error during recording', { error: message });
    } finally {
      setIsRecording(false);
      isFacingLockedRef.current = false;
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (Platform.OS === 'android') {
        setCameraMode('picture');
      }
    }
  }, [user, handleRecordingComplete, waitForCameraReady]);

  const handlePressIn = useCallback(() => {
    if (isRecording) return;

    lightImpact();

    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      startRecording();
    }, HOLD_THRESHOLD_MS);
  }, [startRecording, isRecording]);

  const takePicture = useCallback(async (): Promise<string | undefined> => {
    if (!cameraRef.current || isCapturing || !user) return undefined;

    try {
      setIsCapturing(true);
      mediumImpact();

      playFlashEffect();

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      if (!photo) return undefined;

      logger.debug('useCameraBase: Photo captured', { uri: photo.uri, facing });

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
        } catch (flipError: unknown) {
          const message = flipError instanceof Error ? flipError.message : String(flipError);
          logger.warn('useCameraBase: Failed to flip front camera photo', {
            error: message,
          });
        }
      }

      if (isSnapMode) {
        logger.info('useCameraBase: Snap mode capture, returning URI directly');
        return photoUri;
      }

      const photoId = generateUUID();
      const revealAt = await calculateBatchRevealAt(user.uid);
      await createPhotoRecord(user.uid, photoId, photoUri, revealAt, 'photo');

      addToQueue(user.uid, photoUri, 'photo', null, photoId);

      playCardCaptureAnimation();

      setDarkroomCounts(prev => ({
        ...prev,
        developingCount: prev.developingCount + 1,
        totalCount: prev.totalCount + 1,
      }));

      logger.info('useCameraBase: Photo record created and queued for upload', { photoId });
      return undefined;
    } catch (error: unknown) {
      logger.error('useCameraBase: Error capturing photo', error as Record<string, unknown>);
      return undefined;
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, user, facing, playFlashEffect, playCardCaptureAnimation, isSnapMode]);

  const handlePressOut = useCallback(async () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;

      if (isSnapMode && onSnapCapture) {
        const photoUri = await takePicture();
        if (photoUri) {
          onSnapCapture({ uri: photoUri, mediaType: 'photo' });
        }
      } else {
        takePicture();
      }
      return;
    }

    if (isRecording && cameraRef.current) {
      lightImpact();
      try {
        cameraRef.current.stopRecording();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn('useCameraBase: Error stopping recording', { error: message });
      }
    } else {
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
    (navigation as { navigate: (screen: string) => void }).navigate('Darkroom');
  }, [darkroomCounts, navigation]);

  return {
    user,
    isSnapMode,
    permission,
    requestPermission,
    facing,
    setFacing,
    flash,
    zoom,
    setZoom,
    isCapturing,
    isRecording,
    cameraMode,
    recordingDuration,
    isFacingLockedRef,
    handleCameraReady,
    darkroomCounts,
    isBottomSheetVisible,
    showFlash,
    cameraRef,
    flashOpacity,
    cardScale,
    cardFanSpread,
    toggleFlash,
    playFlashEffect,
    playCardCaptureAnimation,
    takePicture,
    handlePressIn,
    handlePressOut,
    openBottomSheet,
    closeBottomSheet,
    handleBottomSheetComplete,
    MAX_RECORDING_DURATION,
  };
};

export default useCameraBase;
