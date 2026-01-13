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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { createPhoto, getDarkroomCounts } from '../services/firebase/photoService';
import logger from '../utils/logger';
import Svg, { Path } from 'react-native-svg';
import { DarkroomBottomSheet } from '../components';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Layout constants
const FOOTER_HEIGHT = 200;
const CAMERA_HEIGHT = SCREEN_HEIGHT - FOOTER_HEIGHT;
const FLOATING_CONTROL_OFFSET = 10; // Gap above footer edge

const CameraScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
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
  const cameraRef = useRef(null);
  const animatedValue = useRef(new Animated.Value(0)).current;

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

  const getFlashIcon = () => {
    if (flash === 'off') return '⚡️';
    if (flash === 'on') return '⚡';
    return '⚡️';
  };

  const getFlashLabel = () => {
    if (flash === 'off') return 'OFF';
    if (flash === 'on') return 'ON';
    return 'AUTO';
  };

  const playPhotoAnimation = (photoUri) => {
    setCapturedPhoto(photoUri);
    animatedValue.setValue(0);

    Animated.sequence([
      // Shrink and move to darkroom position (bottom tab bar)
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
  };

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing || !user) return;

    try {
      setIsCapturing(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });

      logger.debug('Photo captured', { uri: photo.uri });

      // Show photo animation flying to darkroom
      playPhotoAnimation(photo.uri);

      // Auto-save to darkroom (developing status)
      const result = await createPhoto(user.uid, photo.uri);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Immediately update badge count after successful photo creation
      logger.debug('CameraScreen: Refreshing badge count after photo capture');
      const updatedCounts = await getDarkroomCounts(user.uid);
      setDarkroomCounts(updatedCounts);
      logger.info('CameraScreen: Badge count updated', updatedCounts);
    } catch (error) {
      logger.error('Error saving photo', error);
    } finally {
      setIsCapturing(false);
    }
  };

  // Calculate animation interpolations
  const photoScale = animatedValue.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [1, 0.15, 0.15],
  });

  const photoTranslateY = animatedValue.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, SCREEN_HEIGHT * 0.7, SCREEN_HEIGHT * 0.7],
  });

  const photoTranslateX = animatedValue.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, SCREEN_WIDTH * 0.25, SCREEN_WIDTH * 0.25], // Move to darkroom tab position
  });

  const photoOpacity = animatedValue.interpolate({
    inputRange: [0, 1, 1.5, 2],
    outputRange: [1, 1, 0.5, 0],
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
        {/* Footer Controls: Darkroom, Capture, Debug */}
        <View style={styles.footerControls}>
          {/* Darkroom Button (left of capture) */}
          <DarkroomButton
            count={darkroomCounts.totalCount}
            onPress={() => setIsBottomSheetVisible(true)}
          />

          {/* Capture Button (center) */}
          <TouchableOpacity
            style={[
              styles.captureButton,
              isCapturing && styles.captureButtonDisabled,
            ]}
            onPress={takePicture}
            disabled={isCapturing}
          >
            {isCapturing ? (
              <ActivityIndicator size="large" color="#000000" />
            ) : (
              <View style={styles.captureButtonInner} />
            )}
          </TouchableOpacity>

          {/* Debug Button (right of capture) */}
          <TouchableOpacity
            style={[styles.footerControlButton, styles.debugButton]}
            onPress={() => {
              logger.info('CameraScreen: Debug - Direct navigation to Darkroom');
              navigation.navigate('Darkroom');
            }}
          >
            <Text style={styles.debugIcon}>🌙</Text>
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
          <Text style={styles.flashIcon}>{getFlashIcon()}</Text>
          <Text style={styles.flashLabel}>{getFlashLabel()}</Text>
        </TouchableOpacity>

        {/* Flip Camera Button (bottom right of camera area) */}
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={toggleCameraFacing}
        >
          <Text style={styles.controlIcon}>🔄</Text>
        </TouchableOpacity>
      </View>

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
const DarkroomButton = ({ count, onPress }) => {
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
          <View
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
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' }}>
              {count > 99 ? '99+' : count}
            </Text>
          </View>
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
  // Footer bar - absolute positioned, solid dark background
  footerBar: {
    position: 'absolute',
    bottom: 0,
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
  debugButton: {
    backgroundColor: 'rgba(139, 0, 139, 0.6)', // Purple tint for debug button
  },
  debugIcon: {
    fontSize: 24,
  },
  // Floating controls - positioned above footer edge
  floatingControls: {
    position: 'absolute',
    bottom: FOOTER_HEIGHT + FLOATING_CONTROL_OFFSET,
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
  flashIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  flashLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  controlIcon: {
    fontSize: 28,
  },
  // Capture button
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
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
});

export default CameraScreen;