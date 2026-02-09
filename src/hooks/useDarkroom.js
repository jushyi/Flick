/**
 * useDarkroom hook
 *
 * Extracted from DarkroomScreen.js as part of three-way separation refactoring.
 * Contains all darkroom state, effects, handlers, and computed values.
 *
 * Features:
 * - Loading developing/revealed photos on focus
 * - Darkroom reveal logic (check ready, reveal photos, schedule next)
 * - Photo triage with undo stack (archive, journal, delete)
 * - Batch save on Done tap
 * - Hidden photo tracking for cascade animations
 * - Success state transitions with fade animation
 * - Delete button pulse animation
 * - Image prefetching for smooth card transitions
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Animated, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import { useAuth } from '../context/AuthContext';
import {
  getDevelopingPhotos,
  revealPhotos,
  batchTriagePhotos,
} from '../services/firebase/photoService';
import {
  isDarkroomReadyToReveal,
  scheduleNextReveal,
  recordTriageCompletion,
} from '../services/firebase/darkroomService';
import { successNotification } from '../utils/haptics';
import { playSuccessSound } from '../utils/soundUtils';
import logger from '../utils/logger';

/**
 * Custom hook for darkroom screen logic
 *
 * @returns {object} - Darkroom state, handlers, refs, and computed values
 */
const useDarkroom = () => {
  const { user } = useAuth();
  const navigation = useNavigation();

  // Core state
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triageComplete, setTriageComplete] = useState(false);
  const [pendingSuccess, setPendingSuccess] = useState(false);

  // Undo stack for batched triage - stores decisions locally until Done is tapped
  // Each entry: { photo: PhotoObject, action: 'archive'|'journal'|'delete', exitDirection: 'left'|'right'|'down', tags: string[] }
  const [undoStack, setUndoStack] = useState([]);
  const [undoingPhoto, setUndoingPhoto] = useState(null);
  const [saving, setSaving] = useState(false);

  // Track hidden photos instead of removing from array to prevent black flash
  const [hiddenPhotoIds, setHiddenPhotoIds] = useState(new Set());

  // Photo tagging state - tracks tags per photo locally until Done is tapped
  // { [photoId]: string[] } mapping photoId to array of tagged friend user IDs
  const [photoTags, setPhotoTags] = useState({});
  const [tagModalVisible, setTagModalVisible] = useState(false);

  // Refs
  const cardRef = useRef(null);
  const successFadeAnim = useRef(new Animated.Value(0)).current;
  const prevVisiblePhotoIdsRef = useRef(new Set());
  const deleteButtonScale = useRef(new Animated.Value(1)).current;

  // Computed values
  // Visible photos (not hidden) for rendering
  const visiblePhotos = photos.filter(p => !hiddenPhotoIds.has(p.id));

  // Compute which photos in the visible stack are newly visible (for fade-in)
  const currentVisibleIds = new Set(visiblePhotos.slice(0, 3).map(p => p.id));
  const newlyVisibleIds = new Set();
  currentVisibleIds.forEach(id => {
    if (!prevVisiblePhotoIdsRef.current.has(id)) {
      newlyVisibleIds.add(id);
    }
  });
  // Update ref for next render
  prevVisiblePhotoIdsRef.current = currentVisibleIds;

  // Current photo being displayed
  const currentPhoto = visiblePhotos[0];

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

      logger.debug('useDarkroom: Loading photos', { userId: user.uid });

      // Check if darkroom is ready to reveal photos
      const isReady = await isDarkroomReadyToReveal(user.uid);
      logger.info('useDarkroom: Darkroom ready status', { isReady });

      if (isReady) {
        logger.info('useDarkroom: Revealing photos');
        // Reveal ALL developing photos
        const revealResult = await revealPhotos(user.uid);
        logger.info('useDarkroom: Photos revealed', {
          count: revealResult.count,
          success: revealResult.success,
          error: revealResult.error,
        });

        // Schedule next reveal time (0-15 minutes from now)
        await scheduleNextReveal(user.uid);
        logger.debug('useDarkroom: Next reveal scheduled');
      } else {
        logger.warn('useDarkroom: Darkroom not ready to reveal - photos still developing');
      }

      // Load all developing/revealed photos
      const result = await getDevelopingPhotos(user.uid);
      logger.info('useDarkroom: getDevelopingPhotos result', {
        success: result.success,
        photoCount: result.photos?.length,
        error: result.error,
      });

      if (result.success && result.photos) {
        // Log all photos with their statuses
        logger.debug('useDarkroom: All photos', {
          photos: result.photos.map(p => ({
            id: p.id,
            status: p.status,
            photoState: p.photoState,
          })),
        });

        // Filter for revealed photos only
        const revealedPhotos = result.photos.filter(photo => photo.status === 'revealed');
        logger.info('useDarkroom: Filtered revealed photos', {
          totalPhotos: result.photos.length,
          revealedCount: revealedPhotos.length,
          developingCount: result.photos.filter(p => p.status === 'developing').length,
        });
        setPhotos(revealedPhotos);
        // Clear hidden state when photos reload to prevent stale state
        setHiddenPhotoIds(new Set());
        // Also clear undo stack and tags since these are fresh photos
        setUndoStack([]);
        setPhotoTags({});
      } else {
        logger.warn('useDarkroom: Failed to get photos or no photos returned');
        setPhotos([]);
        setHiddenPhotoIds(new Set());
        setUndoStack([]);
        setPhotoTags({});
      }
    } catch (error) {
      logger.error('useDarkroom: Error loading developing photos', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle triage action for a photo.
   * Pushes decision to undo stack and hides the photo.
   * @param {string} photoId - ID of the photo to triage
   * @param {string} action - Triage action ('archive', 'journal', or 'delete')
   * @returns {Promise<void>}
   */
  const handleTriage = async (photoId, action) => {
    try {
      logger.debug('useDarkroom: Starting triage', {
        photoId,
        action,
        currentCount: visiblePhotos.length,
      });

      // Find the photo object to store in undo stack
      const photoToTriage = photos.find(p => p.id === photoId);
      if (!photoToTriage) {
        logger.error('useDarkroom: Photo not found for triage', { photoId });
        return;
      }

      // Determine exit direction based on action
      const exitDirection = action === 'archive' ? 'left' : action === 'journal' ? 'right' : 'down';

      // Capture current tags for this photo (for undo restoration)
      const currentTags = photoTags[photoId] || [];

      // Push to undo stack instead of calling triagePhoto()
      setUndoStack(prev => {
        const newStack = [
          ...prev,
          { photo: photoToTriage, action, exitDirection, tags: currentTags },
        ];
        logger.debug('useDarkroom: Decision pushed to undo stack', {
          photoId,
          action,
          exitDirection,
          tagCount: currentTags.length,
          stackSize: newStack.length,
        });
        return newStack;
      });

      // Check if this is the last visible photo
      const isLastPhoto = visiblePhotos.length === 1;

      // Set pendingSuccess BEFORE hiding photo to prevent empty state flash
      if (isLastPhoto) {
        setPendingSuccess(true);
        logger.info('useDarkroom: Last photo triaged, pendingSuccess set', { action });
      }

      // Only hide photo if not already hidden by onExitClearance
      if (!hiddenPhotoIds.has(photoId)) {
        setHiddenPhotoIds(prev => {
          const newHidden = new Set(prev);
          newHidden.add(photoId);
          logger.debug('useDarkroom: Photo hidden (from handleTriage)', {
            photoId,
            hiddenCount: newHidden.size,
            remainingVisible: photos.length - newHidden.size,
            isLastPhoto,
          });
          return newHidden;
        });
      } else {
        logger.debug('useDarkroom: Photo already hidden by clearance callback', { photoId });
      }

      // Show success state when all photos triaged
      if (isLastPhoto) {
        setTimeout(() => {
          setTriageComplete(true);
          logger.info('useDarkroom: All photos triaged, awaiting Done tap');
        }, 300);
      }
    } catch (error) {
      logger.error('useDarkroom: Error triaging photo', error);
    }
  };

  /**
   * Handle Done button press.
   * Batch saves all triage decisions to Firestore and closes the darkroom.
   * @returns {Promise<void>}
   */
  const handleDone = async () => {
    if (saving) return;

    logger.info('useDarkroom: User tapped Done button', {
      photosRemaining: photos.length,
      decisionsToSave: undoStack.length,
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // If no decisions made, just close
    if (undoStack.length === 0) {
      navigation.goBack();
      return;
    }

    setSaving(true);

    // Build decisions array from undo stack
    const decisions = undoStack.map(entry => ({
      photoId: entry.photo.id,
      action: entry.action,
    }));

    // Batch save to Firestore (pass photoTags for tagged photo notifications)
    const result = await batchTriagePhotos(decisions, photoTags);

    if (!result.success) {
      logger.error('useDarkroom: Batch save failed', { error: result.error });
      setSaving(false);
      Alert.alert('Save Failed', 'Could not save your decisions. Please try again.');
      return;
    }

    // Record triage completion if any photos were journaled (triggers story notifications)
    if (result.journaledCount > 0) {
      logger.debug('useDarkroom: Recording triage completion for story notifications', {
        journaledCount: result.journaledCount,
      });
      await recordTriageCompletion(user.uid, result.journaledCount);
    }

    // Success - close immediately
    successNotification();
    navigation.goBack();
  };

  /**
   * Handle early exit clearance.
   * Hides photo immediately to trigger cascade animation while card is still exiting.
   * @param {string} photoId - ID of the photo that has cleared
   * @returns {void}
   */
  const handleExitClearance = useCallback(
    photoId => {
      logger.debug('useDarkroom: Exit clearance reached, triggering early cascade', { photoId });

      if (!hiddenPhotoIds.has(photoId)) {
        setHiddenPhotoIds(prev => {
          const newHidden = new Set(prev);
          newHidden.add(photoId);
          return newHidden;
        });
      }
    },
    [hiddenPhotoIds]
  );

  /**
   * Handle left swipe to archive current photo.
   * @returns {Promise<void>}
   */
  const handleArchiveSwipe = useCallback(async () => {
    if (!currentPhoto) return;
    logger.info('useDarkroom: User swiped left to archive photo', { photoId: currentPhoto.id });
    await handleTriage(currentPhoto.id, 'archive');
  }, [currentPhoto, handleTriage]);

  /**
   * Handle right swipe to journal current photo.
   * @returns {Promise<void>}
   */
  const handleJournalSwipe = useCallback(async () => {
    if (!currentPhoto) return;
    logger.info('useDarkroom: User swiped right to journal photo', { photoId: currentPhoto.id });
    await handleTriage(currentPhoto.id, 'journal');
  }, [currentPhoto, handleTriage]);

  /**
   * Handle delete action for current photo.
   * @returns {Promise<void>}
   */
  const handleDeleteSwipe = useCallback(async () => {
    if (!currentPhoto) return;
    logger.info('useDarkroom: User swiped down to delete photo', { photoId: currentPhoto.id });
    await handleTriage(currentPhoto.id, 'delete');
  }, [currentPhoto, handleTriage]);

  /**
   * Handle archive button press.
   * Triggers card archive animation.
   * @returns {void}
   */
  const handleArchiveButton = useCallback(() => {
    if (!currentPhoto) return;
    logger.info('useDarkroom: User tapped archive button', { photoId: currentPhoto.id });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cardRef.current?.triggerArchive();
  }, [currentPhoto]);

  /**
   * Handle delete button press.
   * Triggers card delete suction animation.
   * @returns {void}
   */
  const handleDeleteButton = useCallback(() => {
    if (!currentPhoto) return;
    logger.info('useDarkroom: User tapped delete button', { photoId: currentPhoto.id });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cardRef.current?.triggerDelete();
  }, [currentPhoto]);

  /**
   * Handle journal button press.
   * Triggers card journal animation.
   * @returns {void}
   */
  const handleJournalButton = useCallback(() => {
    if (!currentPhoto) return;
    logger.info('useDarkroom: User tapped journal button', { photoId: currentPhoto.id });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cardRef.current?.triggerJournal();
  }, [currentPhoto]);

  /**
   * Trigger delete button pulse animation.
   * Visual feedback when delete suction animation completes.
   * @returns {void}
   */
  const handleDeletePulse = useCallback(() => {
    Animated.sequence([
      Animated.timing(deleteButtonScale, {
        toValue: 1.15,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(deleteButtonScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [deleteButtonScale]);

  /**
   * Handle undo button press.
   * Restores the last triaged photo with entry animation.
   * @returns {void}
   */
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || undoingPhoto) return;

    logger.info('useDarkroom: User tapped Undo button', { stackSize: undoStack.length });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Get the last decision from the stack
    const lastDecision = undoStack[undoStack.length - 1];

    // Set up entry animation
    setUndoingPhoto({
      photo: lastDecision.photo,
      enterFrom: lastDecision.exitDirection,
    });

    // Remove from undo stack
    setUndoStack(prev => prev.slice(0, -1));

    // Unhide the photo
    setHiddenPhotoIds(prev => {
      const next = new Set(prev);
      next.delete(lastDecision.photo.id);
      return next;
    });

    // Restore tags for undone photo
    if (lastDecision.tags && lastDecision.tags.length > 0) {
      setPhotoTags(prev => ({
        ...prev,
        [lastDecision.photo.id]: lastDecision.tags,
      }));
    }

    // Clear undo animation state after animation completes
    setTimeout(() => {
      setUndoingPhoto(null);
    }, 450);

    // Reset success state flags if undoing from success screen
    setPendingSuccess(false);
    setTriageComplete(false);

    // Reset success fade animation
    successFadeAnim.setValue(0);

    logger.debug('useDarkroom: Undo completed', {
      restoredPhotoId: lastDecision.photo.id,
      previousAction: lastDecision.action,
      enterFrom: lastDecision.exitDirection,
      newStackSize: undoStack.length - 1,
    });
  }, [undoStack, undoingPhoto, successFadeAnim]);

  /**
   * Update tags for a specific photo.
   * @param {string} photoId - Photo ID to tag
   * @param {string[]} selectedFriendIds - Array of friend user IDs to tag
   */
  const handleTagFriends = useCallback((photoId, selectedFriendIds) => {
    if (!photoId) return;
    setPhotoTags(prev => {
      const next = { ...prev };
      if (selectedFriendIds.length === 0) {
        delete next[photoId];
      } else {
        next[photoId] = selectedFriendIds;
      }
      logger.debug('useDarkroom: Updated photo tags', {
        photoId,
        tagCount: selectedFriendIds.length,
      });
      return next;
    });
  }, []);

  /**
   * Get current tags for a photo.
   * @param {string} photoId - Photo ID
   * @returns {string[]} Array of tagged friend user IDs
   */
  const getTagsForPhoto = useCallback(
    photoId => {
      return photoTags[photoId] || [];
    },
    [photoTags]
  );

  /**
   * Open the tag friends modal (only if a current photo exists).
   */
  const handleOpenTagModal = useCallback(() => {
    if (!currentPhoto) return;
    setTagModalVisible(true);
  }, [currentPhoto]);

  /**
   * Close the tag friends modal.
   */
  const handleCloseTagModal = useCallback(() => {
    setTagModalVisible(false);
  }, []);

  // Handle back button press
  const handleBackPress = useCallback(() => {
    logger.info('useDarkroom: User tapped back button');
    navigation.goBack();
  }, [navigation]);

  // Trigger fade-in animation when success state is shown
  useEffect(() => {
    if (visiblePhotos.length === 0 && undoStack.length > 0) {
      Animated.timing(successFadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();

      // Play success sound in sync with animation
      playSuccessSound();
    }
  }, [visiblePhotos.length, undoStack.length, successFadeAnim]);

  // Prefetch visible stack card images for smooth animations
  useEffect(() => {
    const prefetchStackImages = async () => {
      if (photos.length === 0) return;

      // Get first 4 visible photos
      const visiblePhotosForPrefetch = photos.filter(p => !hiddenPhotoIds.has(p.id)).slice(0, 4);
      const urls = visiblePhotosForPrefetch.map(p => p.imageURL).filter(Boolean);

      if (urls.length === 0) return;

      try {
        await ExpoImage.prefetch(urls, 'memory-disk');
        logger.debug('useDarkroom: Prefetched stack images', { count: urls.length });
      } catch (error) {
        logger.warn('useDarkroom: Failed to prefetch some images', { error: error?.message });
      }
    };

    prefetchStackImages();
  }, [photos, hiddenPhotoIds]);

  return {
    // State
    photos,
    visiblePhotos,
    loading,
    triageComplete,
    pendingSuccess,
    undoStack,
    undoingPhoto,
    saving,
    hiddenPhotoIds,
    currentPhoto,
    newlyVisibleIds,
    photoTags,
    tagModalVisible,

    // Refs
    cardRef,
    successFadeAnim,
    deleteButtonScale,

    // Handlers
    handleTriage,
    handleDone,
    handleExitClearance,
    handleArchiveSwipe,
    handleJournalSwipe,
    handleDeleteSwipe,
    handleArchiveButton,
    handleDeleteButton,
    handleJournalButton,
    handleDeletePulse,
    handleUndo,
    handleBackPress,
    handleTagFriends,
    getTagsForPhoto,
    handleOpenTagModal,
    handleCloseTagModal,
  };
};

export default useDarkroom;
