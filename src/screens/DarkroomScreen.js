import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getDevelopingPhotos, revealPhotos, triagePhoto } from '../services/firebase/photoService';
import { isDarkroomReadyToReveal, scheduleNextReveal } from '../services/firebase/darkroomService';
import { SwipeablePhotoCard } from '../components';
import logger from '../utils/logger';

const DarkroomScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
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

      logger.debug('DarkroomScreen: Loading photos', { userId: user.uid });

      // Check if darkroom is ready to reveal photos
      const isReady = await isDarkroomReadyToReveal(user.uid);
      logger.info('DarkroomScreen: Darkroom ready status', { isReady });

      if (isReady) {
        logger.info('DarkroomScreen: Revealing photos');
        // Reveal ALL developing photos
        const revealResult = await revealPhotos(user.uid);
        logger.info('DarkroomScreen: Photos revealed', {
          count: revealResult.count,
          success: revealResult.success,
          error: revealResult.error
        });

        // Schedule next reveal time (0-2 hours from now)
        await scheduleNextReveal(user.uid);
        logger.debug('DarkroomScreen: Next reveal scheduled');
      } else {
        logger.warn('DarkroomScreen: Darkroom not ready to reveal - photos still developing');
      }

      // Load all developing/revealed photos
      const result = await getDevelopingPhotos(user.uid);
      logger.info('DarkroomScreen: getDevelopingPhotos result', {
        success: result.success,
        photoCount: result.photos?.length,
        error: result.error
      });

      if (result.success && result.photos) {
        // Log all photos with their statuses
        logger.debug('DarkroomScreen: All photos', {
          photos: result.photos.map(p => ({ id: p.id, status: p.status, photoState: p.photoState }))
        });

        // Filter for revealed photos only
        const revealedPhotos = result.photos.filter(
          photo => photo.status === 'revealed'
        );
        logger.info('DarkroomScreen: Filtered revealed photos', {
          totalPhotos: result.photos.length,
          revealedCount: revealedPhotos.length,
          developingCount: result.photos.filter(p => p.status === 'developing').length
        });
        setPhotos(revealedPhotos);
      } else {
        logger.warn('DarkroomScreen: Failed to get photos or no photos returned');
        setPhotos([]);
      }
    } catch (error) {
      logger.error('DarkroomScreen: Error loading developing photos', error);
    } finally {
      setLoading(false);
    }
  };

  // Always show first photo in the list
  const currentPhoto = photos[0];

  const handleTriage = async (photoId, action) => {
    try {
      logger.debug('DarkroomScreen: Starting triage', { photoId, action, currentCount: photos.length });

      const result = await triagePhoto(photoId, action);
      logger.debug('DarkroomScreen: Triage result', { success: result.success, error: result.error });

      if (!result.success) {
        throw new Error(result.error);
      }

      // Remove photo from list
      setPhotos(prev => {
        const newPhotos = prev.filter(p => p.id !== photoId);
        logger.debug('DarkroomScreen: Photos updated', {
          oldCount: prev.length,
          newCount: newPhotos.length,
          removedId: photoId,
          nextPhotoId: newPhotos[0]?.id
        });
        return newPhotos;
      });

      // Show confirmation
      const actionText = action === 'journal' ? 'journaled' : action === 'archive' ? 'archived' : 'deleted';
      Alert.alert('Success', `Photo ${actionText} successfully!`);
    } catch (error) {
      logger.error('Error triaging photo', error);
      Alert.alert('Error', 'Failed to process photo. Please try again.');
    }
  };

  // Swipe handlers for SwipeablePhotoCard
  const handleArchive = async () => {
    logger.info('User swiped left (right to left) to archive photo', { photoId: currentPhoto?.id });
    await handleTriage(currentPhoto.id, 'archive');
  };

  const handleJournal = async () => {
    logger.info('User swiped right (left to right) to journal photo', { photoId: currentPhoto?.id });
    await handleTriage(currentPhoto.id, 'journal');
  };

  if (loading) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Loading darkroom...</Text>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  if (photos.length === 0) {
    return (
      <GestureHandlerRootView style={styles.container}>
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
      </GestureHandlerRootView>
    );
  }

  // Debug: Log the photo data
  logger.debug('Current photo', { photoId: currentPhoto?.id, hasImageURL: !!currentPhoto?.imageURL });

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            logger.info('DarkroomScreen: User tapped back button');
            navigation.goBack();
          }}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
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

      {/* Swipeable Photo Card */}
      <View style={styles.photoCardContainer}>
        <SwipeablePhotoCard
          photo={currentPhoto}
          onSwipeLeft={handleJournal}
          onSwipeRight={handleArchive}
        />
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
    </GestureHandlerRootView>
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  backButtonText: {
    fontSize: 32,
    fontWeight: '300',
    color: '#FFFFFF',
    marginTop: -4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  debugButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderRadius: 20,
  },
  debugButtonIcon: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
  },
  photoCardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
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