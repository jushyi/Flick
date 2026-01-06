import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../context/AuthContext';
import { getDailyPhotoCount } from '../services/firebase/userService';
import { useFocusEffect } from '@react-navigation/native';

const CameraScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [isCapturing, setIsCapturing] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);
  const cameraRef = useRef(null);

  // Load daily photo count when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadDailyCount();
    }, [user])
  );

  const loadDailyCount = async () => {
    if (!user) return;

    try {
      const result = await getDailyPhotoCount(user.uid);
      if (result.success) {
        setDailyCount(result.count);
      }
    } catch (error) {
      console.error('Error loading daily count:', error);
    }
  };

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

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return;

    // Check daily limit
    if (dailyCount >= 36) {
      Alert.alert(
        'Daily Limit Reached',
        'You have used all 36 shots for today. Come back tomorrow for a new roll!'
      );
      return;
    }

    try {
      setIsCapturing(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });

      console.log('Photo captured:', photo.uri);

      // Navigate to preview screen
      navigation.navigate('PhotoPreview', { photoUri: photo.uri });

      setDailyCount(prev => prev + 1);
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

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

          <View style={styles.shotCounter}>
            <Text style={styles.shotCountText}>
              {dailyCount} / 36
            </Text>
            <Text style={styles.shotCountLabel}>shots today</Text>
          </View>

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
  shotCounter: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  shotCountText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  shotCountLabel: {
    fontSize: 10,
    color: '#CCCCCC',
    marginTop: 2,
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
});

export default CameraScreen;