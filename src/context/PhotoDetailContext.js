/**
 * PhotoDetailContext - State management for photo detail screen
 *
 * Manages photo detail state that needs to be shared between FeedScreen
 * and PhotoDetailScreen. Uses refs for callbacks to avoid re-renders
 * when callbacks change.
 *
 * Usage:
 * - FeedScreen registers callbacks via setCallbacks()
 * - FeedScreen opens photo detail via openPhotoDetail()
 * - PhotoDetailScreen reads state and calls callbacks from context
 * - Navigation handles actual screen presentation
 */
import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

const PhotoDetailContext = createContext({});

/**
 * Hook to access photo detail context
 * Must be used within PhotoDetailProvider
 */
export const usePhotoDetail = () => {
  const context = useContext(PhotoDetailContext);
  if (!context) {
    throw new Error('usePhotoDetail must be used within a PhotoDetailProvider');
  }
  return context;
};

/**
 * PhotoDetailProvider - Provides photo detail state to the app
 *
 * Wrap this around your navigation container or app root to enable
 * photo detail functionality throughout the app.
 */
export const PhotoDetailProvider = ({ children }) => {
  // Photo state
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState('feed'); // 'feed' | 'stories'
  const [isOwnStory, setIsOwnStory] = useState(false);
  const [hasNextFriend, setHasNextFriend] = useState(false);
  const [hasPreviousFriend, setHasPreviousFriend] = useState(false);
  const [initialShowComments, setInitialShowComments] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Track if photo detail should be shown (for navigation trigger)
  const [isActive, setIsActive] = useState(false);

  // Comments visibility - stored in context to persist across navigation
  const [showComments, setShowComments] = useState(false);

  // Callback refs - using refs to avoid re-renders when callbacks change
  const callbacksRef = useRef({
    onReactionToggle: null,
    onPhotoChange: null,
    onRequestNextFriend: null,
    onRequestPreviousFriend: null,
    onClose: null,
    onAvatarPress: null,
    onPhotoStateChanged: null, // Called when photo is archived/deleted/restored
  });

  /**
   * Register callbacks from FeedScreen
   * These will be called by PhotoDetailScreen when user interacts
   */
  const setCallbacks = useCallback(callbacks => {
    callbacksRef.current = {
      ...callbacksRef.current,
      ...callbacks,
    };
  }, []);

  /**
   * Get current callbacks - for PhotoDetailScreen to call
   */
  const getCallbacks = useCallback(() => callbacksRef.current, []);

  /**
   * Open photo detail with given params
   * Sets state and marks as active - caller should navigate after
   *
   * @param {Object} params
   * @param {Object} params.photo - Single photo (feed mode)
   * @param {Array} params.photos - Array of photos (stories mode)
   * @param {number} params.initialIndex - Starting index (stories mode)
   * @param {string} params.mode - 'feed' or 'stories'
   * @param {boolean} params.isOwnStory - Whether viewing own story
   * @param {boolean} params.hasNextFriend - Whether there's another friend after
   * @param {boolean} params.initialShowComments - Whether to show comments on open
   * @param {string} params.currentUserId - Current user's ID
   * @param {Object} params.callbacks - Callbacks to register
   */
  const openPhotoDetail = useCallback(
    params => {
      const {
        photo = null,
        photos: photosArray = [],
        initialIndex = 0,
        mode: newMode = 'feed',
        isOwnStory: ownStory = false,
        hasNextFriend: nextFriend = false,
        hasPreviousFriend: prevFriend = false,
        initialShowComments: showComments = false,
        currentUserId: userId = null,
        callbacks = {},
      } = params;

      // Set photo state
      setCurrentPhoto(photo);
      setPhotos(photosArray);
      setCurrentIndex(initialIndex);
      setMode(newMode);
      setIsOwnStory(ownStory);
      setHasNextFriend(nextFriend);
      setHasPreviousFriend(prevFriend);
      setInitialShowComments(showComments);
      setCurrentUserId(userId);

      // Register callbacks if provided
      if (Object.keys(callbacks).length > 0) {
        setCallbacks(callbacks);
      }

      // Mark as active
      setIsActive(true);
    },
    [setCallbacks]
  );

  /**
   * Close photo detail - clears state
   * Caller should navigate back after calling this
   */
  const closePhotoDetail = useCallback(() => {
    setIsActive(false);
    setShowComments(false); // Close comments when photo detail closes
    // Keep state briefly for animation, then clear
    setTimeout(() => {
      setCurrentPhoto(null);
      setPhotos([]);
      setCurrentIndex(0);
      setMode('feed');
      setIsOwnStory(false);
      setHasNextFriend(false);
      setHasPreviousFriend(false);
      setInitialShowComments(false);
    }, 300);
  }, []);

  /**
   * Update current photo/index - for stories navigation
   */
  const updateCurrentPhoto = useCallback((photo, index) => {
    setCurrentPhoto(photo);
    if (typeof index === 'number') {
      setCurrentIndex(index);
    }
  }, []);

  /**
   * Update a photo at a specific index - for real-time reaction updates
   * This allows FeedScreen to update a photo in the photos array
   * so PhotoDetailScreen sees the change immediately
   */
  const updatePhotoAtIndex = useCallback((index, updatedPhoto) => {
    setPhotos(prevPhotos => {
      const newPhotos = [...prevPhotos];
      newPhotos[index] = updatedPhoto;
      return newPhotos;
    });
  }, []);

  /**
   * Update hasNextFriend state
   */
  const updateHasNextFriend = useCallback(hasNext => {
    setHasNextFriend(hasNext);
  }, []);

  const updateHasPreviousFriend = useCallback(hasPrev => {
    setHasPreviousFriend(hasPrev);
  }, []);

  /**
   * Call onReactionToggle callback
   */
  const handleReactionToggle = useCallback((emoji, currentCount) => {
    const callbacks = callbacksRef.current;
    if (callbacks.onReactionToggle) {
      callbacks.onReactionToggle(emoji, currentCount);
    }
  }, []);

  /**
   * Call onPhotoChange callback
   */
  const handlePhotoChange = useCallback(
    (photo, index) => {
      const callbacks = callbacksRef.current;
      if (callbacks.onPhotoChange) {
        callbacks.onPhotoChange(photo, index);
      }
      // Also update internal state
      updateCurrentPhoto(photo, index);
    },
    [updateCurrentPhoto]
  );

  /**
   * Call onRequestNextFriend callback
   */
  const handleRequestNextFriend = useCallback(() => {
    const callbacks = callbacksRef.current;
    if (callbacks.onRequestNextFriend) {
      callbacks.onRequestNextFriend();
    }
  }, []);

  const handleRequestPreviousFriend = useCallback(() => {
    const callbacks = callbacksRef.current;
    if (callbacks.onRequestPreviousFriend) {
      callbacks.onRequestPreviousFriend();
    }
  }, []);

  /**
   * Call onClose callback
   */
  const handleClose = useCallback(() => {
    const callbacks = callbacksRef.current;
    if (callbacks.onClose) {
      callbacks.onClose();
    }
    closePhotoDetail();
  }, [closePhotoDetail]);

  /**
   * Call onAvatarPress callback
   */
  const handleAvatarPress = useCallback((userId, displayName) => {
    const callbacks = callbacksRef.current;
    if (callbacks.onAvatarPress) {
      callbacks.onAvatarPress(userId, displayName);
    }
  }, []);

  /**
   * Call onPhotoStateChanged callback - when photo is archived/deleted/restored
   * FeedScreen uses this to refresh feed and stories data
   */
  const handlePhotoStateChanged = useCallback(() => {
    const callbacks = callbacksRef.current;
    if (callbacks.onPhotoStateChanged) {
      callbacks.onPhotoStateChanged();
    }
  }, []);

  const value = {
    // State
    currentPhoto,
    photos,
    currentIndex,
    mode,
    isOwnStory,
    hasNextFriend,
    hasPreviousFriend,
    initialShowComments,
    currentUserId,
    isActive,
    showComments,

    // Methods
    openPhotoDetail,
    closePhotoDetail,
    setCallbacks,
    getCallbacks,
    updateCurrentPhoto,
    updatePhotoAtIndex,
    updateHasNextFriend,
    updateHasPreviousFriend,
    setShowComments,

    // Callback handlers (for PhotoDetailScreen to call)
    handleReactionToggle,
    handlePhotoChange,
    handleRequestNextFriend,
    handleRequestPreviousFriend,
    handleClose,
    handleAvatarPress,
    handlePhotoStateChanged,
  };

  return <PhotoDetailContext.Provider value={value}>{children}</PhotoDetailContext.Provider>;
};

export default PhotoDetailContext;
