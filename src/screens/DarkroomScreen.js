import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { getDevelopingPhotos, revealPhotos, triagePhoto } from '../services/firebase/photoService';
import { isDarkroomReadyToReveal, scheduleNextReveal } from '../services/firebase/darkroomService';
import { SwipeablePhotoCard } from '../components';
import { successNotification } from '../utils/haptics';
import logger from '../utils/logger';

const DarkroomScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cascading, setCascading] = useState(false); // UAT-012: Track when cards are cascading
  const [triageComplete, setTriageComplete] = useState(false); // Track triage completion for inline success
  const [pendingSuccess, setPendingSuccess] = useState(false); // UAT-001: Track when last photo triage is in progress
  // 18.1: Undo stack for batched triage - stores decisions locally until Done is tapped
  // Each entry: { photo: PhotoObject, action: 'archive'|'journal'|'delete', exitDirection: 'left'|'right'|'down' }
  const [undoStack, setUndoStack] = useState([]);
  const cardRef = useRef(null);
  const successFadeAnim = useRef(new Animated.Value(0)).current; // UAT-002: Fade-in animation for success state

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

        // Schedule next reveal time (0-15 minutes from now)
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

      // 18.1: Find the photo object to store in undo stack
      const photoToTriage = photos.find(p => p.id === photoId);
      if (!photoToTriage) {
        logger.error('DarkroomScreen: Photo not found for triage', { photoId });
        return;
      }

      // 18.1: Determine exit direction based on action
      const exitDirection = action === 'archive' ? 'left' : action === 'journal' ? 'right' : 'down';

      // 18.1: Push to undo stack instead of calling triagePhoto()
      // Firestore save is deferred until Done button is tapped (Plan 2)
      setUndoStack(prev => {
        const newStack = [...prev, { photo: photoToTriage, action, exitDirection }];
        logger.debug('DarkroomScreen: Decision pushed to undo stack', {
          photoId,
          action,
          exitDirection,
          stackSize: newStack.length,
        });
        return newStack;
      });

      // Check if this is the last photo
      const isLastPhoto = photos.length === 1;

      // UAT-001: Set pendingSuccess BEFORE removing photo to prevent empty state flash
      // This ensures the success state renders immediately when photos.length hits 0
      if (isLastPhoto) {
        setPendingSuccess(true);
        logger.info('DarkroomScreen: Last photo triaged, pendingSuccess set', { action });
      }

      // UAT-012: Remove photo immediately - the callback is fired AFTER the exit animation completes
      // (400ms EXIT_DURATION in SwipeablePhotoCard), so the card is already off screen
      // The cascade animation was triggered earlier, so stack cards are already in position
      // Remove photo from list (visual removal only - not saved to Firestore yet)
      setPhotos(prev => {
        const newPhotos = prev.filter(p => p.id !== photoId);
        logger.debug('DarkroomScreen: Photos updated', {
          oldCount: prev.length,
          newCount: newPhotos.length,
          removedId: photoId,
          nextPhotoId: newPhotos[0]?.id,
          isLastPhoto,
        });
        return newPhotos;
      });

      // Reset cascading state for next triage
      setCascading(false);

      // 18.1: Show success state when all photos triaged but DON'T trigger success haptic
      // Haptic feedback will be triggered when user taps Done (batch save in Plan 2)
      if (isLastPhoto) {
        // Delay to let the last card's exit animation complete, then finalize triageComplete
        setTimeout(() => {
          setTriageComplete(true);
          // 18.1: Removed successNotification() - no celebration until Done is tapped
          logger.info('DarkroomScreen: All photos triaged, awaiting Done tap');
        }, 300);
      }
    } catch (error) {
      logger.error('Error triaging photo', error);
    }
  };

  // Handle Done button press - use goBack() to match chevron and header swipe animations (slide down)
  // UAT-006: Changed from navigate() which slides right, to goBack() which respects the screen's open animation
  const handleDonePress = () => {
    logger.info('DarkroomScreen: User tapped Done button');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  // UAT-012: Callback when swipe exit animation starts (threshold crossed)
  // This triggers cascade animation on stack cards immediately
  const handleSwipeStart = () => {
    setCascading(true);
  };

  // Swipe handlers for SwipeablePhotoCard
  const handleArchiveSwipe = async () => {
    logger.info('DarkroomScreen: User swiped left to archive photo', { photoId: currentPhoto?.id });
    await handleTriage(currentPhoto.id, 'archive');
  };

  const handleJournalSwipe = async () => {
    logger.info('DarkroomScreen: User swiped right to journal photo', { photoId: currentPhoto?.id });
    await handleTriage(currentPhoto.id, 'journal');
  };

  const handleDeleteSwipe = async () => {
    logger.info('DarkroomScreen: User swiped down to delete photo', { photoId: currentPhoto?.id });
    await handleTriage(currentPhoto.id, 'delete');
  };

  // Button handlers - trigger card animations then let callback handle triage (UAT-003)
  // UAT-012: Set cascading=true immediately to start stack animation during exit
  const handleArchiveButton = () => {
    logger.info('DarkroomScreen: User tapped archive button', { photoId: currentPhoto?.id });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCascading(true); // Start cascade animation immediately
    cardRef.current?.triggerArchive();
  };

  const handleDeleteButton = () => {
    logger.info('DarkroomScreen: User tapped delete button', { photoId: currentPhoto?.id });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCascading(true); // Start cascade animation immediately
    cardRef.current?.triggerDelete();
  };

  const handleJournalButton = () => {
    logger.info('DarkroomScreen: User tapped journal button', { photoId: currentPhoto?.id });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCascading(true); // Start cascade animation immediately
    cardRef.current?.triggerJournal();
  };

  // 18.1: Handle Undo button - restore last decision from undo stack
  // Animation implementation will be added in Plan 2
  const handleUndo = () => {
    if (undoStack.length === 0) return;

    logger.info('DarkroomScreen: User tapped Undo button', { stackSize: undoStack.length });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Get the last decision from the stack
    const lastDecision = undoStack[undoStack.length - 1];

    // Remove from undo stack
    setUndoStack(prev => prev.slice(0, -1));

    // Restore photo to the front of the photos array
    setPhotos(prev => [lastDecision.photo, ...prev]);

    // Reset success state flags if we're undoing from the success screen
    setPendingSuccess(false);
    setTriageComplete(false);

    // Reset success fade animation so it can re-trigger if needed
    successFadeAnim.setValue(0);

    logger.debug('DarkroomScreen: Undo completed', {
      restoredPhotoId: lastDecision.photo.id,
      previousAction: lastDecision.action,
      newStackSize: undoStack.length - 1,
    });
  };

  // UAT-002: Trigger fade-in animation when success state is shown
  // NOTE: This useEffect must be before any early returns to comply with Rules of Hooks
  // 18.1: Updated condition - show success when photos are empty AND undo stack has entries
  useEffect(() => {
    if (photos.length === 0 && undoStack.length > 0) {
      Animated.timing(successFadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }
  }, [photos.length, undoStack.length, successFadeAnim]);

  if (loading) {
    return (
      <GestureHandlerRootView style={styles.gestureRootView}>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Loading darkroom...</Text>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  // 18.1: Inline success state - shows when all photos triaged (undo stack has entries)
  // This state shows the "All done!" screen but still requires Done tap to save
  // UAT-002: Polished UI - emoji text, bottom button with checkmark, fade-in animation
  if (photos.length === 0 && undoStack.length > 0) {
    return (
      <GestureHandlerRootView style={styles.gestureRootView}>
        <View style={styles.successContainer}>
          <SafeAreaView style={styles.successContainer} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => {
                  logger.info('DarkroomScreen: User tapped back button (success state)');
                  navigation.goBack();
                }}
                style={styles.backButton}
              >
                <View style={styles.downChevron} />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>Darkroom</Text>
                <Text style={styles.headerSubtitle}>All done!</Text>
              </View>
              {/* 18.1: Undo button in success state - allows undoing from completion */}
              <TouchableOpacity
                style={[
                  styles.undoButton,
                  undoStack.length === 0 && styles.undoButtonDisabled
                ]}
                onPress={handleUndo}
                disabled={undoStack.length === 0}
              >
                <Text style={styles.undoIcon}>↩</Text>
                <Text style={[
                  styles.undoText,
                  undoStack.length === 0 && styles.undoTextDisabled
                ]}>
                  Undo{undoStack.length > 0 ? ` (${undoStack.length})` : ''}
                </Text>
              </TouchableOpacity>
            </View>

            {/* UAT-002: Success content with fade-in animation, emoji text, bottom button */}
            <Animated.View style={[styles.successContentArea, { opacity: successFadeAnim }]}>
              {/* Centered title in upper 2/3 of screen */}
              <View style={styles.successTitleContainer}>
                <Text style={styles.successTitle}>✨ Hooray! ✨</Text>
              </View>

              {/* Done button at bottom with checkmark */}
              <TouchableOpacity
                style={styles.doneButtonBottom}
                onPress={handleDonePress}
                activeOpacity={0.8}
              >
                <Text style={styles.doneButtonText}>✓ Done</Text>
              </TouchableOpacity>
            </Animated.View>
          </SafeAreaView>
        </View>
      </GestureHandlerRootView>
    );
  }

  if (photos.length === 0) {
    return (
      <GestureHandlerRootView style={styles.gestureRootView}>
        <View style={styles.container}>
          <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => {
                  logger.info('DarkroomScreen: User tapped back button (empty state)');
                  navigation.goBack();
                }}
                style={styles.backButton}
              >
                <View style={styles.downChevron} />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>Darkroom</Text>
                <Text style={styles.headerSubtitle}>No photos ready</Text>
              </View>
              {/* Empty placeholder for layout balance in empty state */}
              <View style={styles.headerRightPlaceholder} />
            </View>

            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📸</Text>
              <Text style={styles.emptyTitle}>No Photos Ready</Text>
              <Text style={styles.emptyText}>
                Photos you take will develop here and be revealed when ready
              </Text>
            </View>
          </SafeAreaView>
        </View>
      </GestureHandlerRootView>
    );
  }

  // Debug: Log the photo data
  logger.debug('Current photo', { photoId: currentPhoto?.id, hasImageURL: !!currentPhoto?.imageURL });

  return (
    <GestureHandlerRootView style={styles.gestureRootView}>
      <View style={styles.container}>
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
            <View style={styles.downChevron} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Darkroom</Text>
            <Text style={styles.headerSubtitle}>
              {photos.length} {photos.length === 1 ? 'photo' : 'photos'} ready to review
            </Text>
          </View>
          {/* 18.1: Undo button - dimmed when empty, shows count when decisions exist */}
          <TouchableOpacity
            style={[
              styles.undoButton,
              undoStack.length === 0 && styles.undoButtonDisabled
            ]}
            onPress={handleUndo}
            disabled={undoStack.length === 0}
          >
            <Text style={styles.undoIcon}>↩</Text>
            <Text style={[
              styles.undoText,
              undoStack.length === 0 && styles.undoTextDisabled
            ]}>
              Undo{undoStack.length > 0 ? ` (${undoStack.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stacked Photo Cards (UAT-005) - render up to 3 cards */}
      <View style={styles.photoCardContainer}>
        {/* Render stack in reverse order so front card renders last (on top) */}
        {photos.slice(0, 3).reverse().map((photo, reverseIndex) => {
          // Convert reverse index back to stack index (0=front, 1=behind, 2=furthest)
          const stackIndex = 2 - reverseIndex - (3 - Math.min(photos.length, 3));
          const isActive = stackIndex === 0;

          return (
            <SwipeablePhotoCard
              ref={isActive ? cardRef : undefined}
              key={photo.id}
              photo={photo}
              stackIndex={stackIndex}
              isActive={isActive}
              cascading={cascading}
              onSwipeStart={isActive ? handleSwipeStart : undefined}
              onSwipeLeft={isActive ? handleArchiveSwipe : undefined}
              onSwipeRight={isActive ? handleJournalSwipe : undefined}
              onSwipeDown={isActive ? handleDeleteSwipe : undefined}
            />
          );
        })}
      </View>

      {/* Triage Button Bar */}
      <View style={styles.triageButtonBar}>
        {/* Archive Button (left) */}
        <TouchableOpacity
          style={styles.archiveButton}
          onPress={handleArchiveButton}
        >
          <Text style={styles.triageButtonIcon}>☐</Text>
          <Text style={styles.archiveButtonText}>Archive</Text>
        </TouchableOpacity>

        {/* Delete Button (center) */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteButton}
        >
          <Text style={styles.deleteButtonIcon}>✕</Text>
        </TouchableOpacity>

        {/* Journal Button (right) */}
        <TouchableOpacity
          style={styles.journalButton}
          onPress={handleJournalButton}
        >
          <Text style={styles.triageButtonIcon}>✓</Text>
          <Text style={styles.journalButtonText}>Journal</Text>
        </TouchableOpacity>
      </View>
        </SafeAreaView>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  // UAT-005: Transparent background for gesture handler so no second background shows during swipe
  gestureRootView: {
    flex: 1,
    backgroundColor: 'transparent',
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
  downChevron: {
    width: 12,
    height: 12,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    marginTop: -4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  // 18.1: Undo button styles
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  undoButtonDisabled: {
    opacity: 0.3,
  },
  undoIcon: {
    fontSize: 16,
    color: '#FFFFFF',
    marginRight: 4,
  },
  undoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  undoTextDisabled: {
    opacity: 0.5,
  },
  // Placeholder for empty state header to maintain layout balance
  headerRightPlaceholder: {
    width: 70, // Approximate width of undo button for consistent header centering
    height: 40,
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
    paddingVertical: 16,
    marginTop: 16,
    marginBottom: 16,
    // UAT-012: Black background prevents gray flash during cascade animation
    backgroundColor: '#000000',
  },
  triageButtonBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 8,
  },
  archiveButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8E8E93',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  deleteButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  journalButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  triageButtonIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginRight: 4,
  },
  deleteButtonIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  archiveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  journalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // UAT-002: Inline success state styles (polished)
  successContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  successContentArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  successTitleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80, // Push title slightly up from center
  },
  successTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  doneButtonBottom: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 24,
    alignSelf: 'center',
    marginBottom: 20,
  },
  doneButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

export default DarkroomScreen;