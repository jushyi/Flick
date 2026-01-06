import { useState, useRef } from 'react';
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
import { createPhoto } from '../services/firebase/photoService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CameraScreen = () => {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const cameraRef = useRef(null);
  const animatedValue = useRef(new Animated.Value(0)).current;

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

      console.log('Photo captured:', photo.uri);

      // Show photo animation flying to darkroom
      playPhotoAnimation(photo.uri);

      // Auto-save to darkroom (developing status)
      const result = await createPhoto(user.uid, photo.uri);

      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error saving photo:', error);
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
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
      >
        {/* Top Controls */}
        <View style={styles.topControls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={toggleFlash}
          >
            <Text style={styles.flashIcon}>{getFlashIcon()}</Text>
            <Text style={styles.flashLabel}>{getFlashLabel()}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={toggleCameraFacing}
          >
            <Text style={styles.controlIcon}>🔄</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          <View style={styles.captureButtonContainer}>
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
          </View>
        </View>
      </CameraView>

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
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
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  controlButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 70,
  },
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
    fontSize: 32,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
  },
  captureButtonContainer: {
    alignItems: 'center',
  },
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