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
import { Animated, Alert, Keyboard, Platform } from 'react-native';

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import { useSharedValue } from 'react-native-reanimated';
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
  clearRevealCache,
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
  const { user, userProfile } = useAuth();
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

  // Photo caption state - tracks captions per photo locally until Done is tapped
  // { [photoId]: string } mapping photoId to caption text (max 100 chars)
  const [photoCaptions, setPhotoCaptions] = useState({});

  // Keyboard tracking
  // SharedValues for gesture worklets (zero re-renders)
  const keyboardVisible = useSharedValue(false);
  const keyboardHeight = useSharedValue(0);
  // React state for conditional rendering (e.g. hiding triage bar)
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

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

      const isReady = await isDarkroomReadyToReveal(user.uid);
      logger.info('useDarkroom: Darkroom ready status', { isReady });

      if (isReady) {
        logger.info('useDarkroom: Revealing photos (scheduled reveal time reached)');
        // Reveal ALL developing photos
        const revealResult = await revealPhotos(user.uid);
        logger.info('useDarkroom: Photos revealed', {
          count: revealResult.count,
          success: revealResult.success,
          error: revealResult.error,
        });

        // Schedule next reveal time (0-15 minutes from now)
        await scheduleNextReveal(user.uid);
        clearRevealCache(); // Invalidate cache after reveal so next check fetches updated nextRevealAt
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
        logger.debug('useDarkroom: All photos', {
          photos: result.photos.map(p => ({
            id: p.id,
            status: p.status,
            photoState: p.photoState,
          })),
        });

        // Catch-up mechanism: If ANY photos are revealed AND there are developing photos,
        // auto-reveal all developing photos to add them to this triage session
        const revealedPhotos = result.photos.filter(photo => photo.status === 'revealed');
        const developingPhotos = result.photos.filter(photo => photo.status === 'developing');

        if (revealedPhotos.length > 0 && developingPhotos.length > 0) {
          logger.info('useDarkroom: Catch-up reveal triggered', {
            revealedCount: revealedPhotos.length,
            developingCount: developingPhotos.length,
            reason: 'User opened darkroom with revealed photos, auto-revealing remaining photos',
          });

          // Reveal the developing photos
          const catchUpResult = await revealPhotos(user.uid);
          logger.info('useDarkroom: Catch-up reveal complete', {
            count: catchUpResult.count,
            success: catchUpResult.success,
          });

          // Re-fetch photos to get updated statuses
          const updatedResult = await getDevelopingPhotos(user.uid);
          if (updatedResult.success && updatedResult.photos) {
            const allRevealed = updatedResult.photos.filter(photo => photo.status === 'revealed');
            logger.info('useDarkroom: After catch-up reveal', {
              totalRevealed: allRevealed.length,
            });
            setPhotos(allRevealed);
          } else {
            setPhotos(revealedPhotos);
          }
        } else {
          logger.info('useDarkroom: No catch-up needed', {
            revealedCount: revealedPhotos.length,
            developingCount: developingPhotos.length,
          });
          setPhotos(revealedPhotos);
        }

        // Clear hidden state when photos reload to prevent stale state
        setHiddenPhotoIds(new Set());
        // Also clear undo stack, tags, and captions since these are fresh photos
        setUndoStack([]);
        setPhotoTags({});
        setPhotoCaptions({});
      } else {
        logger.warn('useDarkroom: Failed to get photos or no photos returned');
        setPhotos([]);
        setHiddenPhotoIds(new Set());
        setUndoStack([]);
        setPhotoTags({});
        setPhotoCaptions({});
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

      const photoToTriage = photos.find(p => p.id === photoId);
      if (!photoToTriage) {
        logger.error('useDarkroom: Photo not found for triage', { photoId });
        return;
      }

      // Determine exit direction based on action (vertical: archive=down, journal=up)
      const exitDirection = action === 'archive' ? 'down' : action === 'journal' ? 'up' : 'delete';

      // Capture current tags and caption for this photo (for undo restoration)
      const currentTags = photoTags[photoId] || [];
      const currentCaption = photoCaptions[photoId] || '';

      // Push to undo stack instead of calling triagePhoto()
      setUndoStack(prev => {
        const newStack = [
          ...prev,
          {
            photo: photoToTriage,
            action,
            exitDirection,
            tags: currentTags,
            caption: currentCaption,
          },
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

    const decisions = undoStack.map(entry => ({
      photoId: entry.photo.id,
      action: entry.action,
    }));

    // Batch save to Firestore (pass photoTags for tagged photo notifications, photoCaptions for captions)
    const result = await batchTriagePhotos(decisions, photoTags, photoCaptions);

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
        // If this is the last visible photo, set pendingSuccess immediately so the
        // success container mounts (at 0 opacity) before the blank state can flash.
        if (visiblePhotos.length === 1) {
          setPendingSuccess(true);
        }
        setHiddenPhotoIds(prev => {
          const newHidden = new Set(prev);
          newHidden.add(photoId);
          return newHidden;
        });
      }
    },
    [hiddenPhotoIds, visiblePhotos]
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

    // Restore caption for undone photo
    if (lastDecision.caption) {
      setPhotoCaptions(prev => ({
        ...prev,
        [lastDecision.photo.id]: lastDecision.caption,
      }));
    }

    // Clear undo animation state after animation completes
    setTimeout(() => {
      setUndoingPhoto(null);
    }, 450);

    // Reset success state flags if undoing from success screen
    setPendingSuccess(false);
    setTriageComplete(false);

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
   * Update caption for a specific photo.
   * @param {string} photoId - Photo ID to caption
   * @param {string} caption - Caption text (max 100 characters)
   */
  const handleCaptionChange = useCallback((photoId, caption) => {
    if (!photoId) return;
    setPhotoCaptions(prev => {
      const next = { ...prev };
      if (!caption || caption.length === 0) {
        delete next[photoId];
      } else {
        next[photoId] = caption.slice(0, 100);
      }
      return next;
    });
  }, []);

  /**
   * Get current caption for a photo.
   * @param {string} photoId - Photo ID
   * @returns {string} Caption text or empty string
   */
  const getCaptionForPhoto = useCallback(photoId => photoCaptions[photoId] || '', [photoCaptions]);

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

  // Track keyboard visibility + height
  // SharedValues drive animations/gestures; React state drives conditional rendering
  // iOS: keyboardWillShow/Hide fires before animation for smoother sync
  // Android: only keyboardDidShow/Hide is reliable
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, e => {
      keyboardVisible.value = true;
      keyboardHeight.value = e.endCoordinates.height;
      setIsKeyboardOpen(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardVisible.value = false;
      keyboardHeight.value = 0;
      setIsKeyboardOpen(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardVisible, keyboardHeight]);

  // Trigger fade-in animation when success state is shown
  useEffect(() => {
    if (visiblePhotos.length === 0 && undoStack.length > 0) {
      Animated.timing(successFadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();

      // Pass user's sound preference (default: false)
      const effectsEnabled = userProfile?.soundPreferences?.effectsEnabled ?? false;
      playSuccessSound(effectsEnabled);
    }
  }, [
    visiblePhotos.length,
    undoStack.length,
    successFadeAnim,
    userProfile?.soundPreferences?.effectsEnabled,
  ]);

  // Prefetch visible stack card images for smooth animations
  useEffect(() => {
    const prefetchStackImages = async () => {
      if (photos.length === 0) return;

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
    photoCaptions,
    tagModalVisible,

    // Refs / SharedValues
    cardRef,
    successFadeAnim,
    deleteButtonScale,
    keyboardVisible,
    keyboardHeight,
    isKeyboardOpen,

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
    handleCaptionChange,
    getCaptionForPhoto,
    handleOpenTagModal,
    handleCloseTagModal,
  };
};

export default useDarkroom;
