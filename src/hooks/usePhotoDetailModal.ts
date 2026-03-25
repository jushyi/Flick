import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Animated, PanResponder, Dimensions, Easing } from 'react-native';
import type { GestureResponderEvent, PanResponderInstance } from 'react-native';
import { Image } from 'expo-image';

import { Gesture } from 'react-native-gesture-handler';
import type { GestureType } from 'react-native-gesture-handler';
import {
  withTiming,
  withSpring,
  Easing as ReanimatedEasing,
  runOnJS,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { reactionHaptic } from '../utils/haptics';
import logger from '../utils/logger';
import { getCuratedEmojis } from '../utils/emojiRotation';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type SourceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
};

type SourceTransform = {
  scale: number;
  translateX: number;
  translateY: number;
  borderRadius: number;
};

type PhotoUser = {
  username?: string;
  displayName?: string;
  profilePhotoURL?: string;
  nameColor?: string;
};

type PhotoLike = {
  id?: string;
  imageURL?: string;
  capturedAt?: string;
  reactions?: Record<string, Record<string, number>>;
  user?: PhotoUser;
  mediaType?: 'photo' | 'video';
  [key: string]: unknown;
};

type EmojiObject = {
  emoji: string;
};

type UsePhotoDetailModalParams = {
  mode?: 'feed' | 'stories';
  photo?: PhotoLike | null;
  photos?: PhotoLike[];
  initialIndex?: number;
  onPhotoChange?: (photo: PhotoLike, index: number) => void;
  visible: boolean;
  onClose: () => void;
  onReactionToggle: (emoji: string, currentCount: number) => void;
  currentUserId?: string;
  onFriendTransition?: () => boolean;
  onPreviousFriendTransition?: () => boolean;
  onSwipeUp?: () => void;
  sourceRect?: SourceRect | null;
  cubeProgress?: SharedValue<number>;
  onPrepareSwipeTransition?: (direction: 'forward' | 'backward') => boolean;
  onCommitSwipeTransition?: () => void;
  onCancelSwipeTransition?: () => void;
  onGetNextFriendPhotoURL?: () => string | null;
};

type UsePhotoDetailModalReturn = {
  mode: 'feed' | 'stories';
  showProgressBar: boolean;
  currentPhoto: PhotoLike | null;
  imageURL: string | undefined;
  capturedAt: string | undefined;
  displayName: string | undefined;
  username: string | undefined;
  profilePhotoURL: string | undefined;
  nameColor: string | undefined;
  currentIndex: number;
  totalPhotos: number;
  handleTapNavigation: (event: GestureResponderEvent) => void;
  goPrev: () => boolean;
  goNext: () => boolean;
  translateY: Animated.Value;
  opacity: Animated.Value;
  panResponder: PanResponderInstance;
  openProgress: Animated.Value;
  dismissScale: Animated.Value;
  suckTranslateX: Animated.Value;
  animatedBorderRadius: Animated.Value;
  sourceTransform: SourceTransform | null;
  groupedReactions: Record<string, number>;
  orderedEmojis: string[];
  curatedEmojis: string[];
  getUserReactionCount: (emoji: string) => number;
  handleEmojiPress: (emoji: string) => void;
  customEmoji: string | null;
  setCustomEmoji: React.Dispatch<React.SetStateAction<string | null>>;
  showEmojiPicker: boolean;
  setShowEmojiPicker: React.Dispatch<React.SetStateAction<boolean>>;
  handleOpenEmojiPicker: () => void;
  handleEmojiPickerSelect: (emojiObject: EmojiObject) => void;
  handleCustomEmojiConfirm: () => void;
  newlyAddedEmoji: string | null;
  handleClose: () => void;
  updateCommentsVisible: (isVisible: boolean) => void;
  horizontalGesture: GestureType;
  startLoadTimer: () => void;
  clearLoadTimer: () => void;
  handleVideoPlayToEnd: () => void;
  handleVideoTimeUpdate: (params: { currentTime: number; duration: number }) => void;
  videoProgress: number;
};

export const usePhotoDetailModal = ({
  mode = 'feed',
  photo,
  photos = [],
  initialIndex = 0,
  onPhotoChange,
  visible,
  onClose,
  onReactionToggle,
  currentUserId,
  onFriendTransition,
  onPreviousFriendTransition,
  onSwipeUp,
  sourceRect,
  cubeProgress,
  onPrepareSwipeTransition,
  onCommitSwipeTransition,
  onCancelSwipeTransition,
  onGetNextFriendPhotoURL,
}: UsePhotoDetailModalParams): UsePhotoDetailModalReturn => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const [prevPhotosKey, setPrevPhotosKey] = useState(photos);
  if (photos !== prevPhotosKey) {
    setPrevPhotosKey(photos);
    const validIndex = Math.min(Math.max(0, initialIndex), Math.max(0, photos.length - 1));
    setCurrentIndex(validIndex);
  }

  const [frozenOrder, setFrozenOrder] = useState<string[] | null>(null);
  const sortTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [customEmoji, setCustomEmoji] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeCustomEmojis, setActiveCustomEmojis] = useState<string[]>([]);
  const [newlyAddedEmoji, setNewlyAddedEmoji] = useState<string | null>(null);

  const [videoProgress, setVideoProgress] = useState(0);
  const videoProgressRef = useRef(0);

  const LOAD_FAILURE_TIMEOUT = 5000;
  const loadFailureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastTapTimeRef = useRef(0);
  const MIN_DISPLAY_TIME = 30;

  const queuedTapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queuedTapDirectionRef = useRef<'next' | 'prev' | null>(null);

  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const openProgress = useRef(new Animated.Value(0)).current;
  const dismissScale = useRef(new Animated.Value(1)).current;
  const suckTranslateX = useRef(new Animated.Value(0)).current;
  const animatedBorderRadius = useRef(new Animated.Value(0)).current;

  const sourceRectRef = useRef(sourceRect);
  sourceRectRef.current = sourceRect;

  const sourceTransform = useMemo((): SourceTransform | null => {
    if (!sourceRect) return null;
    const scaleX = sourceRect.width / SCREEN_WIDTH;
    const scaleY = sourceRect.height / SCREEN_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    const sourceCenterX = sourceRect.x + sourceRect.width / 2;
    const sourceCenterY = sourceRect.y + sourceRect.height / 2;
    return {
      scale,
      translateX: sourceCenterX - SCREEN_WIDTH / 2,
      translateY: sourceCenterY - SCREEN_HEIGHT / 2,
      borderRadius: sourceRect.borderRadius || 0,
    };
  }, [sourceRect]);

  const hasAnimatedOpen = useRef(false);
  useEffect(() => {
    if (!visible) {
      hasAnimatedOpen.current = false;
      return;
    }
    if (hasAnimatedOpen.current) return;

    if (sourceTransform) {
      hasAnimatedOpen.current = true;
      openProgress.setValue(0);
      opacity.setValue(0);
      dismissScale.setValue(1);
      suckTranslateX.setValue(0);
      translateY.setValue(0);

      Animated.parallel([
        Animated.spring(openProgress, {
          toValue: 1,
          tension: 180,
          friction: 16,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    const rafId = requestAnimationFrame(() => {
      if (!hasAnimatedOpen.current) {
        hasAnimatedOpen.current = true;
        openProgress.setValue(1);
        opacity.setValue(1);
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [visible, sourceTransform]);

  useEffect(() => {
    if (visible && mode === 'stories') {
      const validIndex = Math.min(Math.max(0, initialIndex), Math.max(0, photos.length - 1));
      setCurrentIndex(validIndex);
      logger.debug('usePhotoDetailModal: Stories mode opened', {
        photoCount: photos.length,
        startingIndex: validIndex,
      });
    }
  }, [visible, initialIndex, photos.length, mode]);

  useEffect(() => {
    if (!visible || mode !== 'stories' || photos.length === 0) return;

    const startIdx = initialIndex + 1;
    const endIdx = Math.min(startIdx + 3, photos.length);
    const urlsToPrefetch: string[] = [];

    for (let i = startIdx; i < endIdx; i++) {
      if (photos[i]?.imageURL) {
        urlsToPrefetch.push(photos[i].imageURL!);
      }
    }

    if (urlsToPrefetch.length > 0) {
      Image.prefetch(urlsToPrefetch, 'memory-disk').catch(() => {});
      logger.debug('usePhotoDetailModal: Batch prefetched initial story photos', {
        initialIndex,
        count: urlsToPrefetch.length,
      });
    }
  }, [visible, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== 'stories' || !visible || photos.length === 0) return;

    const urlsToPrefetch: string[] = [];

    for (let i = 1; i <= 3; i++) {
      if (currentIndex + i < photos.length && photos[currentIndex + i]?.imageURL) {
        urlsToPrefetch.push(photos[currentIndex + i].imageURL!);
      }
    }

    if (urlsToPrefetch.length > 0) {
      Image.prefetch(urlsToPrefetch, 'memory-disk').catch(() => {});
    }
  }, [mode, visible, currentIndex, photos]);

  useEffect(() => {
    if (mode !== 'stories' || !visible) return;
    if (currentIndex >= photos.length - 2 && onGetNextFriendPhotoURL) {
      const nextURL = onGetNextFriendPhotoURL();
      if (nextURL) {
        Image.prefetch(nextURL, 'memory-disk').catch(() => {});
        logger.debug('usePhotoDetailModal: Prefetched next friend first photo');
      }
    }
  }, [mode, visible, currentIndex, photos.length, onGetNextFriendPhotoURL]);

  const currentPhoto = useMemo((): PhotoLike | null => {
    if (mode === 'stories') {
      if (photos.length === 0) return null;
      const safeIndex = Math.min(currentIndex, photos.length - 1);
      return photos[safeIndex] || null;
    }
    return photo || null;
  }, [mode, photo, photos, currentIndex]);

  const curatedEmojis = useMemo(() => {
    return getCuratedEmojis(currentPhoto?.id, 5);
  }, [currentPhoto?.id]);

  const [prevPhotoId, setPrevPhotoId] = useState(currentPhoto?.id);
  if (currentPhoto?.id && currentPhoto.id !== prevPhotoId) {
    setPrevPhotoId(currentPhoto.id);
    setFrozenOrder(null);
    setCustomEmoji(null);
    setVideoProgress(0);
    videoProgressRef.current = 0;
  }

  useEffect(() => {
    if (currentPhoto?.id) {
      const photoReactions = currentPhoto?.reactions || {};
      const reactionEmojis = new Set<string>();
      Object.values(photoReactions).forEach(userReactions => {
        if (typeof userReactions === 'object') {
          Object.keys(userReactions).forEach(emoji => reactionEmojis.add(emoji));
        }
      });
      const existingEmojis = [...reactionEmojis].filter(emoji => !curatedEmojis.includes(emoji));
      setActiveCustomEmojis(existingEmojis);
    }
  }, [currentPhoto?.id, currentPhoto?.reactions, curatedEmojis]);

  const { imageURL, capturedAt, reactions = {}, user: photoUser = {} } = currentPhoto || {};
  const { username, displayName, profilePhotoURL, nameColor } = photoUser as PhotoUser;

  const groupedReactions = useMemo((): Record<string, number> => {
    const photoReactions = currentPhoto?.reactions || {};
    const grouped: Record<string, number> = {};
    Object.entries(photoReactions).forEach(([_userId, userReactions]) => {
      if (typeof userReactions === 'object') {
        Object.entries(userReactions as Record<string, number>).forEach(([emoji, count]) => {
          if (!grouped[emoji]) {
            grouped[emoji] = 0;
          }
          grouped[emoji] += count;
        });
      }
    });
    return grouped;
  }, [currentPhoto]);

  const getUserReactionCount = useCallback(
    (emoji: string): number => {
      const photoReactions = currentPhoto?.reactions || {};
      if (!currentUserId || !photoReactions[currentUserId]) return 0;
      return photoReactions[currentUserId][emoji] || 0;
    },
    [currentUserId, currentPhoto]
  );

  const handleEmojiPress = useCallback(
    (emoji: string) => {
      reactionHaptic();
      const currentCount = getUserReactionCount(emoji);
      onReactionToggle(emoji, currentCount);

      if (!frozenOrder) {
        const customToAdd = activeCustomEmojis.filter(e => !curatedEmojis.includes(e));
        const allEmojis = [...customToAdd, ...curatedEmojis];
        const allEmojiData = allEmojis.map(e => ({
          emoji: e,
          totalCount: groupedReactions[e] || 0,
        }));
        const currentSortedOrder = [...allEmojiData]
          .sort((a, b) => b.totalCount - a.totalCount)
          .map(item => item.emoji);
        setFrozenOrder(currentSortedOrder);
      }

      if (sortTimerRef.current) {
        clearTimeout(sortTimerRef.current);
      }

      sortTimerRef.current = setTimeout(() => {
        setFrozenOrder(null);
      }, 3000);

      setNewlyAddedEmoji(emoji);
      setTimeout(() => {
        setNewlyAddedEmoji(null);
      }, 2000);
    },
    [
      getUserReactionCount,
      onReactionToggle,
      frozenOrder,
      groupedReactions,
      curatedEmojis,
      activeCustomEmojis,
    ]
  );

  const orderedEmojis = useMemo((): string[] => {
    const customToAdd = activeCustomEmojis.filter(e => !curatedEmojis.includes(e));

    const allEmojis = [...customToAdd, ...curatedEmojis];
    const allEmojiData = allEmojis.map(emoji => ({
      emoji,
      totalCount: groupedReactions[emoji] || 0,
    }));

    const sortedAll = [...allEmojiData]
      .sort((a, b) => b.totalCount - a.totalCount)
      .map(item => item.emoji);

    if (frozenOrder) {
      const validFrozen = frozenOrder.filter(e => allEmojis.includes(e));
      const newEmojis = sortedAll.filter(e => !frozenOrder.includes(e));
      return [...validFrozen, ...newEmojis];
    }

    return sortedAll;
  }, [frozenOrder, groupedReactions, curatedEmojis, activeCustomEmojis]);

  const handleOpenEmojiPicker = useCallback(() => {
    setShowEmojiPicker(true);
  }, []);

  const handleEmojiPickerSelect = useCallback(
    (emojiObject: EmojiObject) => {
      const selectedEmoji = emojiObject.emoji;
      setShowEmojiPicker(false);

      reactionHaptic();
      const currentCount = getUserReactionCount(selectedEmoji);
      onReactionToggle(selectedEmoji, currentCount);

      if (!activeCustomEmojis.includes(selectedEmoji) && !curatedEmojis.includes(selectedEmoji)) {
        setActiveCustomEmojis(prev => [selectedEmoji, ...prev]);
      }

      setNewlyAddedEmoji(selectedEmoji);
      setTimeout(() => {
        setNewlyAddedEmoji(null);
      }, 2000);
    },
    [getUserReactionCount, onReactionToggle, activeCustomEmojis, curatedEmojis]
  );

  const handleCustomEmojiConfirm = useCallback(() => {
    if (customEmoji) {
      reactionHaptic();
      const currentCount = getUserReactionCount(customEmoji);
      onReactionToggle(customEmoji, currentCount);

      if (!activeCustomEmojis.includes(customEmoji) && !curatedEmojis.includes(customEmoji)) {
        setActiveCustomEmojis(prev => [customEmoji, ...prev]);
        setNewlyAddedEmoji(customEmoji);
        setTimeout(() => {
          setNewlyAddedEmoji(null);
        }, 600);
      }

      setCustomEmoji(null);
    }
  }, [customEmoji, getUserReactionCount, onReactionToggle, activeCustomEmojis, curatedEmojis]);

  const clearQueuedTap = useCallback(() => {
    if (queuedTapRef.current) {
      clearTimeout(queuedTapRef.current);
      queuedTapRef.current = null;
      queuedTapDirectionRef.current = null;
    }
  }, []);

  const goPrev = useCallback((): boolean => {
    if (mode !== 'stories') return false;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;
    if (timeSinceLastTap < MIN_DISPLAY_TIME) {
      clearQueuedTap();
      const remaining = MIN_DISPLAY_TIME - timeSinceLastTap;
      queuedTapDirectionRef.current = 'prev';
      queuedTapRef.current = setTimeout(() => {
        queuedTapRef.current = null;
        queuedTapDirectionRef.current = null;
        goPrev();
      }, remaining);
      return true;
    }
    lastTapTimeRef.current = now;
    clearQueuedTap();

    if (currentIndex === 0) {
      logger.debug('usePhotoDetailModal: At first photo');
      return false;
    }

    const newIndex = currentIndex - 1;
    logger.debug('usePhotoDetailModal: Navigate previous', { newIndex });
    setCurrentIndex(newIndex);
    if (onPhotoChange && photos[newIndex]) {
      onPhotoChange(photos[newIndex], newIndex);
    }
    return true;
  }, [mode, currentIndex, photos, onPhotoChange, clearQueuedTap]);

  const goNext = useCallback((): boolean => {
    if (mode !== 'stories') return false;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;
    if (timeSinceLastTap < MIN_DISPLAY_TIME) {
      clearQueuedTap();
      const remaining = MIN_DISPLAY_TIME - timeSinceLastTap;
      queuedTapDirectionRef.current = 'next';
      queuedTapRef.current = setTimeout(() => {
        queuedTapRef.current = null;
        queuedTapDirectionRef.current = null;
        goNext();
      }, remaining);
      return true;
    }
    lastTapTimeRef.current = now;
    clearQueuedTap();

    if (currentIndex >= photos.length - 1) {
      logger.debug('usePhotoDetailModal: At last photo');
      if (onFriendTransition) {
        const transitioned = onFriendTransition();
        if (transitioned) {
          logger.debug('usePhotoDetailModal: Transitioning to next friend');
          return true;
        }
      }
      return false;
    }

    const newIndex = currentIndex + 1;
    logger.debug('usePhotoDetailModal: Navigate next', { newIndex });
    setCurrentIndex(newIndex);
    if (onPhotoChange && photos[newIndex]) {
      onPhotoChange(photos[newIndex], newIndex);
    }
    return true;
  }, [mode, currentIndex, photos, onPhotoChange, onFriendTransition, clearQueuedTap]);

  const clearLoadTimer = useCallback(() => {
    if (loadFailureTimeoutRef.current) {
      clearTimeout(loadFailureTimeoutRef.current);
      loadFailureTimeoutRef.current = null;
    }
  }, []);

  const startLoadTimer = useCallback(() => {
    clearLoadTimer();
    if (mode !== 'stories') return;
    if (currentPhoto?.mediaType === 'video') return;
    loadFailureTimeoutRef.current = setTimeout(() => {
      logger.warn('usePhotoDetailModal: Image load timeout, auto-skipping', {
        photoId: currentPhoto?.id,
      });
      goNext();
    }, LOAD_FAILURE_TIMEOUT);
  }, [clearLoadTimer, mode, goNext, currentPhoto?.id, currentPhoto?.mediaType]);

  const handleVideoPlayToEnd = useCallback(() => {
    if (mode !== 'stories') return;
    if (videoProgressRef.current < 0.1) {
      logger.debug('usePhotoDetailModal: Ignoring premature playToEnd', {
        progress: videoProgressRef.current,
      });
      return;
    }
    logger.info('usePhotoDetailModal: Video play-to-end, auto-advancing');
    goNext();
  }, [mode, goNext]);

  const handleVideoTimeUpdate = useCallback(({ currentTime, duration }: { currentTime: number; duration: number }) => {
    if (duration > 0) {
      const prog = currentTime / duration;
      setVideoProgress(prog);
      videoProgressRef.current = prog;
    } else {
      setVideoProgress(0);
      videoProgressRef.current = 0;
    }
  }, []);

  const closeWithAnimation = useCallback(() => {
    clearQueuedTap();
    const source = sourceRectRef.current;
    const transform = source
      ? {
          scale: Math.min(source.width / SCREEN_WIDTH, source.height / SCREEN_HEIGHT),
          translateX: source.x + source.width / 2 - SCREEN_WIDTH / 2,
          translateY: source.y + source.height / 2 - SCREEN_HEIGHT / 2,
          borderRadius: source.borderRadius || 0,
        }
      : null;

    const resetAll = () => {
      setTimeout(() => {
        translateY.setValue(0);
        opacity.setValue(0);
        openProgress.setValue(0);
        dismissScale.setValue(1);
        suckTranslateX.setValue(0);
      }, 100);
    };

    if (!transform) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onClose();
        resetAll();
      });
      return;
    }

    const suckDuration = 200;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: transform.translateY,
        duration: suckDuration,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(suckTranslateX, {
        toValue: transform.translateX,
        duration: suckDuration,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dismissScale, {
        toValue: transform.scale,
        duration: suckDuration,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: suckDuration,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      resetAll();
    });
  }, [translateY, opacity, openProgress, dismissScale, suckTranslateX, onClose, clearQueuedTap]);

  const handleTapNavigation = useCallback(
    (event: GestureResponderEvent) => {
      if (mode !== 'stories') return;

      const { locationX } = event.nativeEvent;

      if (locationX < SCREEN_WIDTH * 0.3) {
        if (!goPrev()) {
          if (onPreviousFriendTransition) {
            const transitioned = onPreviousFriendTransition();
            if (transitioned) {
              return;
            }
          }
          closeWithAnimation();
        }
      } else if (locationX > SCREEN_WIDTH * 0.7) {
        if (!goNext()) {
          closeWithAnimation();
        }
      }
    },
    [mode, goPrev, goNext, closeWithAnimation, onPreviousFriendTransition]
  );

  const springBack = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(opacity, {
        toValue: 1,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(dismissScale, {
        toValue: 1,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, opacity, dismissScale]);

  const onSwipeUpRef = useRef(onSwipeUp);
  useEffect(() => {
    onSwipeUpRef.current = onSwipeUp;
  }, [onSwipeUp]);

  const onFriendTransitionRef = useRef(onFriendTransition);
  useEffect(() => {
    onFriendTransitionRef.current = onFriendTransition;
  }, [onFriendTransition]);

  const onPreviousFriendTransitionRef = useRef(onPreviousFriendTransition);
  useEffect(() => {
    onPreviousFriendTransitionRef.current = onPreviousFriendTransition;
  }, [onPreviousFriendTransition]);

  const cubeProgressRef = useRef(cubeProgress);
  useEffect(() => {
    cubeProgressRef.current = cubeProgress;
  }, [cubeProgress]);

  const onPrepareSwipeTransitionRef = useRef(onPrepareSwipeTransition);
  useEffect(() => {
    onPrepareSwipeTransitionRef.current = onPrepareSwipeTransition;
  }, [onPrepareSwipeTransition]);

  const onCommitSwipeTransitionRef = useRef(onCommitSwipeTransition);
  useEffect(() => {
    onCommitSwipeTransitionRef.current = onCommitSwipeTransition;
  }, [onCommitSwipeTransition]);

  const onCancelSwipeTransitionRef = useRef(onCancelSwipeTransition);
  useEffect(() => {
    onCancelSwipeTransitionRef.current = onCancelSwipeTransition;
  }, [onCancelSwipeTransition]);

  const isHorizontalSwipeActiveRef = useRef(false);
  const swipeDirectionRef = useRef<'forward' | 'backward' | null>(null);

  const verticalDirectionRef = useRef<'down' | 'up' | null>(null);

  const [_commentsVisible, setCommentsVisible] = useState(false);
  const commentsVisibleRef = useRef(false);

  const updateCommentsVisible = useCallback((isVisible: boolean) => {
    commentsVisibleRef.current = isVisible;
    setCommentsVisible(isVisible);
  }, []);

  const prepareHorizontalSwipe = useCallback((direction: 'forward' | 'backward', _absDx: number) => {
    const hasCallback =
      direction === 'forward'
        ? onFriendTransitionRef.current
        : onPreviousFriendTransitionRef.current;
    if (!hasCallback || !onPrepareSwipeTransitionRef.current) return;

    const prepared = onPrepareSwipeTransitionRef.current(direction);
    if (!prepared) return;

    isHorizontalSwipeActiveRef.current = true;
    swipeDirectionRef.current = direction;
  }, []);

  const completeHorizontalSwipe = useCallback((dx: number, vx: number) => {
    if (!isHorizontalSwipeActiveRef.current) return;

    const signedDx = swipeDirectionRef.current === 'forward' ? -dx : dx;
    const clampedDx = Math.max(0, signedDx);

    const signedVx = swipeDirectionRef.current === 'forward' ? -vx : vx;
    const forwardVx = Math.max(0, signedVx);

    const COMMIT_DISTANCE_THRESHOLD = SCREEN_WIDTH * 0.25;
    const COMMIT_VELOCITY_THRESHOLD = 0.4;
    const shouldCommit =
      clampedDx > COMMIT_DISTANCE_THRESHOLD || forwardVx > COMMIT_VELOCITY_THRESHOLD;

    if (shouldCommit && cubeProgressRef.current) {
      cubeProgressRef.current.value = withTiming(
        1,
        {
          duration: 150,
          easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
        },
        finished => {
          'worklet';
          if (finished) {
            runOnJS(function commitTransition() {
              onCommitSwipeTransitionRef.current?.();
            })();
          }
        }
      );
    } else if (cubeProgressRef.current) {
      cubeProgressRef.current.value = withSpring(
        0,
        {
          damping: 18,
          stiffness: 200,
        },
        finished => {
          'worklet';
          if (finished) {
            runOnJS(function cancelTransition() {
              onCancelSwipeTransitionRef.current?.();
            })();
          }
        }
      );
    }

    isHorizontalSwipeActiveRef.current = false;
    swipeDirectionRef.current = null;
  }, []);

  const horizontalGesture = useMemo(() => {
    return Gesture.Pan()
      .activeOffsetX([-15, 15])
      .failOffsetY([-10, 10])
      .onStart(() => {
        'worklet';
      })
      .onUpdate(event => {
        'worklet';
        const { translationX } = event;

        if (!isHorizontalSwipeActiveRef.current) {
          const direction = translationX < 0 ? 'forward' : 'backward';
          runOnJS(prepareHorizontalSwipe)(direction, Math.abs(translationX));
          return;
        }

        const signedDx = swipeDirectionRef.current === 'forward' ? -translationX : translationX;
        const adjustedDx = Math.max(0, signedDx - 15);
        const progress = Math.min(1, adjustedDx / SCREEN_WIDTH);
        if (cubeProgressRef.current) {
          cubeProgressRef.current.value = progress;
        }
      })
      .onEnd(event => {
        'worklet';
        if (!isHorizontalSwipeActiveRef.current) return;
        runOnJS(completeHorizontalSwipe)(event.translationX, event.velocityX);
      })
      .onFinalize(() => {
        'worklet';
        if (isHorizontalSwipeActiveRef.current) {
          runOnJS(completeHorizontalSwipe)(0, 0);
        }
      });
  }, [prepareHorizontalSwipe, completeHorizontalSwipe]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        return false;
      },
      onStartShouldSetPanResponderCapture: () => {
        return false;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (commentsVisibleRef.current) return false;

        const touchY = evt.nativeEvent.pageY;
        const footerThreshold = SCREEN_HEIGHT - 100;
        if (touchY >= footerThreshold) return false;

        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        if (isVerticalSwipe) {
          const isDownward = gestureState.dy > 5;
          const isUpward = gestureState.dy < -10;
          return isDownward || isUpward;
        }

        return false;
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        if (commentsVisibleRef.current) return false;

        const touchY = evt.nativeEvent.pageY;
        const footerThreshold = SCREEN_HEIGHT - 100;
        if (touchY >= footerThreshold) return false;

        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        if (isVerticalSwipe) {
          const isDownward = gestureState.dy > 5;
          const isUpward = gestureState.dy < -10;
          return isDownward || isUpward;
        }

        return false;
      },
      onPanResponderMove: (_, gestureState) => {
        const { dy } = gestureState;

        if (verticalDirectionRef.current === null) {
          verticalDirectionRef.current = dy > 0 ? 'down' : 'up';
        }

        if (verticalDirectionRef.current === 'down') {
          const clampedDy = Math.max(0, dy);
          translateY.setValue(clampedDy);
          const dragRatio = Math.min(1, clampedDy / SCREEN_HEIGHT);
          dismissScale.setValue(1 - dragRatio * 0.15);
          const fadeAmount = Math.max(0, 1 - dragRatio * 0.8);
          opacity.setValue(fadeAmount);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dy, vy } = gestureState;
        const gestureDir = verticalDirectionRef.current;

        verticalDirectionRef.current = null;

        if (gestureDir === 'up' && (dy < -50 || vy < -0.5)) {
          if (onSwipeUpRef.current) {
            onSwipeUpRef.current();
          }
          return;
        }

        if (gestureDir === 'down') {
          const dismissThreshold = SCREEN_HEIGHT / 3;
          if (dy > dismissThreshold || vy > 0.5) {
            closeWithAnimation();
          } else {
            springBack();
          }
          return;
        }

        springBack();
      },
      onPanResponderTerminate: () => {
        verticalDirectionRef.current = null;
      },
    })
  ).current;

  useEffect(() => {
    return () => {
      if (sortTimerRef.current) {
        clearTimeout(sortTimerRef.current);
      }
      clearQueuedTap();
      clearLoadTimer();
    };
  }, [clearQueuedTap, clearLoadTimer]);

  return {
    mode,
    showProgressBar: mode === 'stories',
    currentPhoto,
    imageURL,
    capturedAt,
    displayName,
    username,
    profilePhotoURL,
    nameColor,
    currentIndex,
    totalPhotos: photos.length,
    handleTapNavigation,
    goPrev,
    goNext,
    translateY,
    opacity,
    panResponder,
    openProgress,
    dismissScale,
    suckTranslateX,
    animatedBorderRadius,
    sourceTransform,
    groupedReactions,
    orderedEmojis,
    curatedEmojis,
    getUserReactionCount,
    handleEmojiPress,
    customEmoji,
    setCustomEmoji,
    showEmojiPicker,
    setShowEmojiPicker,
    handleOpenEmojiPicker,
    handleEmojiPickerSelect,
    handleCustomEmojiConfirm,
    newlyAddedEmoji,
    handleClose: closeWithAnimation,
    updateCommentsVisible,
    horizontalGesture,
    startLoadTimer,
    clearLoadTimer,
    handleVideoPlayToEnd,
    handleVideoTimeUpdate,
    videoProgress,
  };
};
