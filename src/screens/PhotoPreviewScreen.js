import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { createPhoto } from '../services/firebase/photoService';
import { incrementDailyPhotoCount } from '../services/firebase/userService';

const PhotoPreviewScreen = ({ route, navigation }) => {
  const { photoUri } = route.params;
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  const handleRetake = () => {
    navigation.goBack();
  };

  const handlePost = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to post photos');
      return;
    }

    setIsUploading(true);

    try {
      // Create photo (includes compression, upload, and Firestore document)
      const result = await createPhoto(user.uid, photoUri);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Increment user's daily photo count
      await incrementDailyPhotoCount(user.uid);

      // Success!
      Alert.alert(
        'Photo Uploading',
        'Your photo will develop over the next 1-3 hours!',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('MainTabs', { screen: 'Feed' }),
          },
        ]
      );
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.imageContainer}>
        <Image source={{ uri: photoUri }} style={styles.image} resizeMode="contain" />
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Photo Captured!</Text>
        <Text style={styles.infoText}>
          Your photo will develop in 1-3 hours and appear in your feed
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.retakeButton]}
          onPress={handleRetake}
          disabled={isUploading}
        >
          <Text style={styles.retakeButtonText}>Retake</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.postButton, isUploading && styles.buttonDisabled]}
          onPress={handlePost}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.postButtonText}>Post Photo</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: '#000000',
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  retakeButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  retakeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  postButton: {
    backgroundColor: '#FFFFFF',
  },
  postButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default PhotoPreviewScreen;