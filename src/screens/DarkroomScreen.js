import { useState, useCallback } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getDevelopingPhotos, revealPhotos, triagePhoto } from '../services/firebase/photoService';
import { isDarkroomReadyToReveal, scheduleNextReveal } from '../services/firebase/darkroomService';
import { debugDarkroom } from '../utils/debugDarkroom';

const DarkroomScreen = () => {
  const { user } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load developing photos when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadDevelopingPhotos();
    }, [user])
  );

  const loadDevelopingPhotos = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // DEBUG: Check darkroom status
      console.log('=== DARKROOM SCREEN: Loading ===');
      await debugDarkroom(user.uid);

      // Check if darkroom is ready to reveal photos
      const isReady = await isDarkroomReadyToReveal(user.uid);
      console.log('Is darkroom ready to reveal?', isReady);

      if (isReady) {
        console.log('Revealing photos...');
        // Reveal ALL developing photos
        const revealResult = await revealPhotos(user.uid);
        console.log(`Revealed ${revealResult.count} photos`);

        // Schedule next reveal time (0-2 hours from now)
        await scheduleNextReveal(user.uid);
        console.log('Next reveal scheduled');
      }

      // Load all developing/revealed photos
      const result = await getDevelopingPhotos(user.uid);
      console.log('getDevelopingPhotos result:', result);

      if (result.success) {
        // Filter for revealed photos only
        const revealedPhotos = result.photos.filter(
          photo => photo.status === 'revealed'
        );
        console.log('Revealed photos to display:', revealedPhotos.length);
        setPhotos(revealedPhotos);
      }
    } catch (error) {
      console.error('Error loading developing photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTriage = async (photoId, action) => {
    try {
      const result = await triagePhoto(photoId, action);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Remove photo from list
      setPhotos(prev => prev.filter(p => p.id !== photoId));

      // Show confirmation
      const actionText = action === 'journal' ? 'journaled' : action === 'archive' ? 'archived' : 'deleted';
      Alert.alert('Success', `Photo ${actionText} successfully!`);
    } catch (error) {
      console.error('Error triaging photo:', error);
      Alert.alert('Error', 'Failed to process photo. Please try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading darkroom...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (photos.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📸</Text>
          <Text style={styles.emptyTitle}>No Photos Ready</Text>
          <Text style={styles.emptyText}>
            Photos you take will develop here and be revealed when ready
          </Text>
          <TouchableOpacity
            onPress={() => debugDarkroom(user.uid)}
            style={styles.debugButtonLarge}
          >
            <Text style={styles.debugButtonText}>🐛 Debug Darkroom</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentPhoto = photos[0]; // Always show first photo in the list

  // Debug: Log the photo data
  console.log('Current photo:', currentPhoto);
  console.log('Image URL:', currentPhoto?.imageURL);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Darkroom</Text>
          <Text style={styles.headerSubtitle}>
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'} ready to review
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => debugDarkroom(user.uid)}
          style={styles.debugButton}
        >
          <Text style={styles.debugButtonIcon}>🐛</Text>
        </TouchableOpacity>
      </View>

      {/* Photo Display */}
      <View style={styles.photoCard}>
        {currentPhoto?.imageURL ? (
          <Image
            source={{ uri: currentPhoto.imageURL }}
            style={styles.photoImage}
            resizeMode="cover"
            onError={(error) => console.log('Image load error:', error.nativeEvent.error)}
            onLoad={() => console.log('Image loaded successfully')}
          />
        ) : (
          <View style={styles.loadingImageContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Loading photo...</Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {/* Archive Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.archiveButton]}
          onPress={() => handleTriage(currentPhoto.id, 'archive')}
        >
          <Text style={styles.actionButtonIcon}>📦</Text>
          <Text style={styles.actionButtonText}>Archive</Text>
          <Text style={styles.actionButtonSubtext}>Keep private</Text>
        </TouchableOpacity>

        {/* Journal Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.journalButton]}
          onPress={() => handleTriage(currentPhoto.id, 'journal')}
        >
          <Text style={styles.actionButtonIcon}>📖</Text>
          <Text style={styles.actionButtonText}>Journal</Text>
          <Text style={styles.actionButtonSubtext}>Share to feed</Text>
        </TouchableOpacity>
      </View>

      {/* Delete Button */}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => {
          Alert.alert(
            'Delete Photo',
            'Are you sure you want to permanently delete this photo?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => handleTriage(currentPhoto.id, 'delete'),
              },
            ]
          );
        }}
      >
        <Text style={styles.deleteButtonText}>🗑️ Delete Photo</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#CCCCCC',
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 24,
  },
  debugButtonLarge: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.5)',
  },
  debugButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  debugButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderRadius: 8,
  },
  debugButtonIcon: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#CCCCCC',
  },
  photoCard: {
    flex: 1,
    margin: 24,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  loadingImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
  },
  archiveButton: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderColor: 'rgba(255, 149, 0, 0.5)',
  },
  journalButton: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderColor: 'rgba(52, 199, 89, 0.5)',
  },
  actionButtonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  actionButtonSubtext: {
    fontSize: 12,
    color: '#CCCCCC',
  },
  deleteButton: {
    marginHorizontal: 24,
    marginBottom: 16,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.5)',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
});

export default DarkroomScreen;