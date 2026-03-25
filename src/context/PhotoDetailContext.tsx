import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';

import type { FeedPhoto } from '@/types/services';

type PhotoDetailMode = 'feed' | 'stories';

interface SourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
}

interface PhotoDetailCallbacks {
  onReactionToggle?: (emoji: string, currentCount: number) => void;
  onPhotoChange?: (photo: FeedPhoto, index: number) => void;
  onRequestNextFriend?: () => void;
  onRequestPreviousFriend?: () => void;
  onCancelFriendTransition?: () => void;
  onClose?: () => void;
  onAvatarPress?: (userId: string, displayName: string) => void;
  onPhotoStateChanged?: () => void;
  onCommentCountChange?: (count: number) => void;
}

interface OpenPhotoDetailParams {
  photo?: FeedPhoto | null;
  photos?: FeedPhoto[];
  initialIndex?: number;
  mode?: PhotoDetailMode;
  isOwnStory?: boolean;
  hasNextFriend?: boolean;
  hasPreviousFriend?: boolean;
  initialShowComments?: boolean;
  targetCommentId?: string | null;
  currentUserId?: string | null;
  callbacks?: PhotoDetailCallbacks;
  sourceRect?: SourceRect | null;
}

interface PhotoDetailContextValue {
  currentPhoto: FeedPhoto | null;
  photos: FeedPhoto[];
  currentIndex: number;
  mode: PhotoDetailMode;
  isOwnStory: boolean;
  hasNextFriend: boolean;
  hasPreviousFriend: boolean;
  initialShowComments: boolean;
  targetCommentId: string | null;
  currentUserId: string | null;
  isActive: boolean;
  showComments: boolean;
  sourceRect: SourceRect | null;
  openPhotoDetail: (params: OpenPhotoDetailParams) => void;
  closePhotoDetail: () => void;
  setCallbacks: (callbacks: PhotoDetailCallbacks) => void;
  getCallbacks: () => PhotoDetailCallbacks;
  updateCurrentPhoto: (photo: FeedPhoto, index?: number) => void;
  updatePhotoAtIndex: (index: number, updatedPhoto: FeedPhoto) => void;
  updateHasNextFriend: (hasNext: boolean) => void;
  updateHasPreviousFriend: (hasPrev: boolean) => void;
  setShowComments: (show: boolean) => void;
  handleReactionToggle: (emoji: string, currentCount: number) => void;
  handlePhotoChange: (photo: FeedPhoto, index: number) => void;
  handleRequestNextFriend: () => void;
  handleRequestPreviousFriend: () => void;
  handleCancelFriendTransition: () => void;
  handleClose: () => void;
  handleAvatarPress: (userId: string, displayName: string) => void;
  handlePhotoStateChanged: () => void;
}

interface PhotoDetailActionsValue {
  openPhotoDetail: (params: OpenPhotoDetailParams) => void;
  setCallbacks: (callbacks: PhotoDetailCallbacks) => void;
  updatePhotoAtIndex: (index: number, updatedPhoto: FeedPhoto) => void;
  updateCurrentPhoto: (photo: FeedPhoto, index?: number) => void;
}

const PhotoDetailContext = createContext<PhotoDetailContextValue | undefined>(undefined);
const PhotoDetailActionsContext = createContext<PhotoDetailActionsValue | undefined>(undefined);

export const usePhotoDetail = (): PhotoDetailContextValue => {
  const context = useContext(PhotoDetailContext);
  if (!context) {
    throw new Error('usePhotoDetail must be used within a PhotoDetailProvider');
  }
  return context;
};

export const usePhotoDetailActions = (): PhotoDetailActionsValue => {
  const context = useContext(PhotoDetailActionsContext);
  if (!context) {
    throw new Error('usePhotoDetailActions must be used within a PhotoDetailProvider');
  }
  return context;
};

interface PhotoDetailProviderProps {
  children: ReactNode;
}

export const PhotoDetailProvider = ({ children }: PhotoDetailProviderProps): React.JSX.Element => {
  const [currentPhoto, setCurrentPhoto] = useState<FeedPhoto | null>(null);
  const [photos, setPhotos] = useState<FeedPhoto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<PhotoDetailMode>('feed');
  const [isOwnStory, setIsOwnStory] = useState(false);
  const [hasNextFriend, setHasNextFriend] = useState(false);
  const [hasPreviousFriend, setHasPreviousFriend] = useState(false);
  const [initialShowComments, setInitialShowComments] = useState(false);
  const [targetCommentId, setTargetCommentId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [sourceRect, setSourceRect] = useState<SourceRect | null>(null);

  const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
    };
  }, []);

  const callbacksRef = useRef<PhotoDetailCallbacks>({
    onReactionToggle: undefined,
    onPhotoChange: undefined,
    onRequestNextFriend: undefined,
    onRequestPreviousFriend: undefined,
    onCancelFriendTransition: undefined,
    onClose: undefined,
    onAvatarPress: undefined,
    onPhotoStateChanged: undefined,
    onCommentCountChange: undefined,
  });

  const setCallbacks = useCallback((callbacks: PhotoDetailCallbacks) => {
    callbacksRef.current = { ...callbacksRef.current, ...callbacks };
  }, []);

  const getCallbacks = useCallback((): PhotoDetailCallbacks => callbacksRef.current, []);

  const openPhotoDetail = useCallback(
    (params: OpenPhotoDetailParams) => {
      const {
        photo = null,
        photos: photosArray = [],
        initialIndex = 0,
        mode: newMode = 'feed',
        isOwnStory: ownStory = false,
        hasNextFriend: nextFriend = false,
        hasPreviousFriend: prevFriend = false,
        initialShowComments: showCommentsInit = false,
        targetCommentId: targetComment = null,
        currentUserId: userId = null,
        callbacks = {},
        sourceRect: newSourceRect = null,
      } = params;

      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }

      setCurrentPhoto(photo ?? null);
      setPhotos(photosArray);
      setCurrentIndex(initialIndex);
      setMode(newMode);
      setIsOwnStory(ownStory);
      setHasNextFriend(nextFriend);
      setHasPreviousFriend(prevFriend);
      setInitialShowComments(showCommentsInit);
      setTargetCommentId(targetComment);
      setCurrentUserId(userId);
      setSourceRect(newSourceRect);

      if (Object.keys(callbacks).length > 0) {
        setCallbacks(callbacks);
      }

      setIsActive(true);
    },
    [setCallbacks]
  );

  const closePhotoDetail = useCallback(() => {
    setIsActive(false);
    setShowComments(false);
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
    }
    cleanupTimeoutRef.current = setTimeout(() => {
      cleanupTimeoutRef.current = null;
      setCurrentPhoto(null);
      setPhotos([]);
      setCurrentIndex(0);
      setMode('feed');
      setIsOwnStory(false);
      setHasNextFriend(false);
      setHasPreviousFriend(false);
      setInitialShowComments(false);
      setTargetCommentId(null);
      setSourceRect(null);
    }, 300);
  }, []);

  const updateCurrentPhoto = useCallback((photo: FeedPhoto, index?: number) => {
    setCurrentPhoto(photo);
    if (typeof index === 'number') {
      setCurrentIndex(index);
    }
  }, []);

  const updatePhotoAtIndex = useCallback((index: number, updatedPhoto: FeedPhoto) => {
    setPhotos(prevPhotos => {
      const newPhotos = [...prevPhotos];
      newPhotos[index] = updatedPhoto;
      return newPhotos;
    });
  }, []);

  const updateHasNextFriend = useCallback((hasNext: boolean) => {
    setHasNextFriend(hasNext);
  }, []);

  const updateHasPreviousFriend = useCallback((hasPrev: boolean) => {
    setHasPreviousFriend(hasPrev);
  }, []);

  const handleReactionToggle = useCallback((emoji: string, currentCount: number) => {
    const callbacks = callbacksRef.current;
    if (callbacks.onReactionToggle) callbacks.onReactionToggle(emoji, currentCount);
  }, []);

  const handlePhotoChange = useCallback(
    (photo: FeedPhoto, index: number) => {
      const callbacks = callbacksRef.current;
      if (callbacks.onPhotoChange) callbacks.onPhotoChange(photo, index);
      updateCurrentPhoto(photo, index);
    },
    [updateCurrentPhoto]
  );

  const handleRequestNextFriend = useCallback(() => {
    const callbacks = callbacksRef.current;
    if (callbacks.onRequestNextFriend) callbacks.onRequestNextFriend();
  }, []);

  const handleRequestPreviousFriend = useCallback(() => {
    const callbacks = callbacksRef.current;
    if (callbacks.onRequestPreviousFriend) callbacks.onRequestPreviousFriend();
  }, []);

  const handleCancelFriendTransition = useCallback(() => {
    const callbacks = callbacksRef.current;
    if (callbacks.onCancelFriendTransition) callbacks.onCancelFriendTransition();
  }, []);

  const handleClose = useCallback(() => {
    const callbacks = callbacksRef.current;
    if (callbacks.onClose) callbacks.onClose();
    closePhotoDetail();
  }, [closePhotoDetail]);

  const handleAvatarPress = useCallback((userId: string, displayName: string) => {
    const callbacks = callbacksRef.current;
    if (callbacks.onAvatarPress) callbacks.onAvatarPress(userId, displayName);
  }, []);

  const handlePhotoStateChanged = useCallback(() => {
    const callbacks = callbacksRef.current;
    if (callbacks.onPhotoStateChanged) callbacks.onPhotoStateChanged();
  }, []);

  const actionsValue: PhotoDetailActionsValue = useMemo(
    () => ({
      openPhotoDetail,
      setCallbacks,
      updatePhotoAtIndex,
      updateCurrentPhoto,
    }),
    [openPhotoDetail, setCallbacks, updatePhotoAtIndex, updateCurrentPhoto]
  );

  const value: PhotoDetailContextValue = {
    currentPhoto,
    photos,
    currentIndex,
    mode,
    isOwnStory,
    hasNextFriend,
    hasPreviousFriend,
    initialShowComments,
    targetCommentId,
    currentUserId,
    isActive,
    showComments,
    sourceRect,
    openPhotoDetail,
    closePhotoDetail,
    setCallbacks,
    getCallbacks,
    updateCurrentPhoto,
    updatePhotoAtIndex,
    updateHasNextFriend,
    updateHasPreviousFriend,
    setShowComments,
    handleReactionToggle,
    handlePhotoChange,
    handleRequestNextFriend,
    handleRequestPreviousFriend,
    handleCancelFriendTransition,
    handleClose,
    handleAvatarPress,
    handlePhotoStateChanged,
  };

  return (
    <PhotoDetailActionsContext.Provider value={actionsValue}>
      <PhotoDetailContext.Provider value={value}>{children}</PhotoDetailContext.Provider>
    </PhotoDetailActionsContext.Provider>
  );
};

export default PhotoDetailContext;
