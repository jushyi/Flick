/**
 * PhotoDetailModal - Full-screen photo viewer with inline emoji reactions
 *
 * Features:
 * - Full-screen photo display
 * - Swipe-down-to-dismiss gesture
 * - Profile header
 * - Inline horizontal emoji picker in footer
 * - Multiple reactions per user with counts
 * - Stories mode: progress bar, tap navigation, multi-photo
 * - 3D cube rotation for friend-to-friend transitions
 */
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import PixelIcon from './PixelIcon';
import EmojiPicker from 'rn-emoji-keyboard';
import { getTimeAgo } from '../utils/timeUtils';
import { usePhotoDetailModal } from '../hooks/usePhotoDetailModal';
import { styles } from '../styles/PhotoDetailModal.styles';
import CommentsBottomSheet from './comments/CommentsBottomSheet';
import CommentPreview from './comments/CommentPreview';
import { getPreviewComments } from '../services/firebase/commentService';
import { colors } from '../constants/colors';

// Progress bar constants - matches photo marginHorizontal (8px)
const PROGRESS_BAR_HORIZONTAL_PADDING = 8;
const PROGRESS_BAR_GAP = 2;
const MIN_SEGMENT_WIDTH = 4;
const MAX_VISIBLE_SEGMENTS = 20;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * PhotoDetailModal Component
 *
 * @param {string} mode - View mode: 'feed' (default) or 'stories'
 * @param {boolean} visible - Modal visibility state
 * @param {object} photo - Photo object with user data and reactions (feed mode)
 * @param {array} photos - Array of photos (stories mode)
 * @param {number} initialIndex - Starting photo index (stories mode)
 * @param {function} onPhotoChange - Callback when photo changes (stories mode)
 * @param {function} onClose - Callback to close modal
 * @param {function} onReactionToggle - Callback when emoji is toggled (emoji, currentCount)
 * @param {string} currentUserId - Current user's ID
 * @param {function} onRequestNextFriend - Callback for friend-to-friend transition (stories mode)
 * @param {boolean} hasNextFriend - Whether there's another friend's stories after this
 * @param {boolean} isOwnStory - Whether viewing user's own story (disables reactions)
 * @param {function} onAvatarPress - Callback when avatar is tapped (userId, username) -> navigate to profile
 */
const PhotoDetailModal = ({
  mode = 'feed',
  visible,
  photo,
  photos = [],
  initialIndex = 0,
  onPhotoChange,
  onClose,
  onReactionToggle,
  currentUserId,
  onRequestNextFriend,
  hasNextFriend = false,
  initialShowComments = false,
  isOwnStory = false,
  onAvatarPress,
}) => {
  // Cube transition animation for friend-to-friend
  const cubeRotation = useRef(new Animated.Value(0)).current;
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Comments state
  const [showComments, setShowComments] = useState(false);
  const [previewComments, setPreviewComments] = useState([]);

  // Progress bar scroll ref for auto-scrolling
  const progressScrollRef = useRef(null);

  // Emoji scroll ref for auto-scrolling when new emoji added
  const emojiScrollRef = useRef(null);

  // Highlight fade animation for newly added emoji (1 second fade)
  const highlightOpacity = useRef(new Animated.Value(1)).current;

  // Track previous visibility for initialShowComments logic
  const wasVisible = useRef(false);

  // Reset cube rotation and comments when modal opens
  // Only apply initialShowComments on FALSE -> TRUE transition
  useEffect(() => {
    if (visible && !wasVisible.current) {
      // Only on initial open (false -> true transition)
      cubeRotation.setValue(0);
      setIsTransitioning(false);
      setShowComments(initialShowComments);
    } else if (!visible) {
      // Reset transition state when closing
      setIsTransitioning(false);
    }
    wasVisible.current = visible;
  }, [visible, initialShowComments]);

  /**
   * Handle friend-to-friend transition with cube animation
   */
  const handleFriendTransition = useCallback(() => {
    if (!hasNextFriend || !onRequestNextFriend || isTransitioning) return false;

    setIsTransitioning(true);

    // Animate cube rotation out (0 -> -90 degrees)
    Animated.timing(cubeRotation, {
      toValue: -90,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      // Trigger friend change callback
      onRequestNextFriend();
      // Reset rotation for incoming friend (from 90 -> 0)
      cubeRotation.setValue(90);
      Animated.timing(cubeRotation, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setIsTransitioning(false);
      });
    });

    return true;
  }, [hasNextFriend, onRequestNextFriend, cubeRotation, isTransitioning]);

  const {
    // Mode
    showProgressBar,

    // Photo data
    currentPhoto,
    imageURL,
    capturedAt,
    displayName,
    profilePhotoURL,

    // Stories navigation
    currentIndex,
    totalPhotos,
    handleTapNavigation,

    // Animation
    translateY,
    opacity,
    panResponder,

    // Reactions
    groupedReactions,
    orderedEmojis,
    getUserReactionCount,
    handleEmojiPress,

    // Custom emoji picker
    showEmojiPicker,
    setShowEmojiPicker,
    handleOpenEmojiPicker,
    handleEmojiPickerSelect,
    newlyAddedEmoji,
  } = usePhotoDetailModal({
    mode,
    photo,
    photos,
    initialIndex,
    onPhotoChange,
    visible,
    onClose,
    onReactionToggle,
    currentUserId,
    onFriendTransition: hasNextFriend ? handleFriendTransition : null,
  });

  // Check if viewing own photo (disable avatar tap)
  // Must be after hook call since currentPhoto comes from the hook
  const isOwnPhoto = currentPhoto?.userId === currentUserId;

  /**
   * Handle avatar press - navigate to user's profile
   * Disabled for own photos (currentPhoto.userId === currentUserId)
   * Profile opens as modal overlay - this modal stays mounted underneath
   */
  const handleAvatarPress = useCallback(() => {
    if (isOwnPhoto) return;
    if (onAvatarPress && currentPhoto) {
      onAvatarPress(currentPhoto.userId, displayName);
    }
  }, [onAvatarPress, currentPhoto, displayName, isOwnPhoto]);

  /**
   * Handle avatar press from comments - navigate to user's profile
   * Profile opens as modal overlay - this modal stays mounted underneath
   */
  const handleCommentAvatarPress = useCallback(
    (userId, userName) => {
      if (onAvatarPress) {
        onAvatarPress(userId, userName);
      }
    },
    [onAvatarPress]
  );

  // Fetch preview comments when photo changes
  useEffect(() => {
    const fetchPreviewComments = async () => {
      if (!visible || !currentPhoto?.id) {
        setPreviewComments([]);
        return;
      }

      const result = await getPreviewComments(currentPhoto.id, currentPhoto.userId);
      if (result.success) {
        setPreviewComments(result.previewComments || []);
      } else {
        setPreviewComments([]);
      }
    };

    fetchPreviewComments();
  }, [visible, currentPhoto?.id, currentPhoto?.userId, showComments]);

  // Calculate segment width based on total photos
  const { segmentWidth, needsScroll } = useMemo(() => {
    if (totalPhotos <= 0) return { segmentWidth: MIN_SEGMENT_WIDTH, needsScroll: false };

    const availableWidth = SCREEN_WIDTH - PROGRESS_BAR_HORIZONTAL_PADDING * 2;
    const totalGapWidth = (totalPhotos - 1) * PROGRESS_BAR_GAP;
    const widthForSegments = availableWidth - totalGapWidth;
    const calculatedWidth = widthForSegments / totalPhotos;

    // If segments would be smaller than min, use min width and enable scrolling
    if (calculatedWidth < MIN_SEGMENT_WIDTH) {
      return { segmentWidth: MIN_SEGMENT_WIDTH, needsScroll: true };
    }

    // If more than MAX_VISIBLE_SEGMENTS, cap width and scroll
    if (totalPhotos > MAX_VISIBLE_SEGMENTS) {
      const cappedWidth =
        (availableWidth - (MAX_VISIBLE_SEGMENTS - 1) * PROGRESS_BAR_GAP) / MAX_VISIBLE_SEGMENTS;
      return { segmentWidth: Math.max(cappedWidth, MIN_SEGMENT_WIDTH), needsScroll: true };
    }

    return { segmentWidth: calculatedWidth, needsScroll: false };
  }, [totalPhotos]);

  // Auto-scroll emoji row to start and fade highlight when new emoji is added
  useEffect(() => {
    if (newlyAddedEmoji) {
      // Scroll to start to show the new emoji
      if (emojiScrollRef.current) {
        emojiScrollRef.current.scrollTo({ x: 0, animated: true });
      }

      // Start fade animation: fully visible, then fade to 0 over 1 second
      highlightOpacity.setValue(1);
      Animated.timing(highlightOpacity, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    }
  }, [newlyAddedEmoji, highlightOpacity]);

  // Auto-scroll progress bar to keep current segment visible
  useEffect(() => {
    if (needsScroll && progressScrollRef.current && totalPhotos > 0) {
      const segmentTotalWidth = segmentWidth + PROGRESS_BAR_GAP;
      const visibleWidth = SCREEN_WIDTH - PROGRESS_BAR_HORIZONTAL_PADDING * 2;
      const totalContentWidth = totalPhotos * segmentWidth + (totalPhotos - 1) * PROGRESS_BAR_GAP;

      // Calculate scroll position to center current segment (or keep it in view)
      // We want to show a few segments before and after current
      const currentSegmentStart = currentIndex * segmentTotalWidth;
      const currentSegmentCenter = currentSegmentStart + segmentWidth / 2;

      // Scroll so current segment is about 1/3 from left edge (shows context of what's coming)
      const targetScrollX = Math.max(0, currentSegmentCenter - visibleWidth / 3);
      const maxScrollX = Math.max(0, totalContentWidth - visibleWidth);

      progressScrollRef.current.scrollTo({
        x: Math.min(targetScrollX, maxScrollX),
        animated: true,
      });
    }
  }, [currentIndex, needsScroll, segmentWidth, totalPhotos]);

  // In feed mode, check photo prop; in stories mode, check currentPhoto
  if (mode === 'feed' && !photo) return null;
  if (mode === 'stories' && !currentPhoto) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.container, { opacity }]} {...panResponder.panHandlers}>
        <StatusBar barStyle="light-content" />

        {/* Animated content wrapper with cube transition */}
        <Animated.View
          style={[
            styles.contentWrapper,
            {
              transform: [
                { translateY },
                { perspective: 1000 },
                {
                  rotateY: cubeRotation.interpolate({
                    inputRange: [-90, 0, 90],
                    outputRange: ['-90deg', '0deg', '90deg'],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Header with close button */}
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Photo - TouchableWithoutFeedback in both modes for swipe-to-close gesture support
              Stories mode: onPress triggers tap navigation
              Feed mode: onPress is undefined (touch tracking only for panResponder) */}
          <TouchableWithoutFeedback onPress={mode === 'stories' ? handleTapNavigation : undefined}>
            <View style={styles.photoScrollView}>
              <Image
                source={{ uri: imageURL }}
                style={styles.photo}
                contentFit="cover"
                transition={0}
              />
            </View>
          </TouchableWithoutFeedback>

          {/* Profile photo - overlapping top left of photo, tappable to navigate to profile (disabled for own photos) */}
          <TouchableOpacity
            style={styles.profilePicContainer}
            onPress={handleAvatarPress}
            activeOpacity={isOwnPhoto ? 1 : 0.7}
            disabled={isOwnPhoto}
          >
            {profilePhotoURL ? (
              <Image
                source={{ uri: profilePhotoURL }}
                style={styles.profilePic}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.profilePic, styles.profilePicPlaceholder]}>
                <Text style={styles.profilePicText}>{displayName?.[0]?.toUpperCase() || '?'}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* User info - bottom left of photo
              Stories mode: raised to clear progress bar
              Feed mode: original position */}
          <View
            style={[
              styles.userInfoOverlay,
              {
                bottom:
                  mode === 'stories'
                    ? previewComments?.length > 0
                      ? 130
                      : 110
                    : previewComments?.length > 0
                      ? 120
                      : 100,
              },
            ]}
          >
            <Text style={styles.displayName} numberOfLines={1}>
              {displayName || 'Unknown User'}
            </Text>
            <Text style={styles.timestamp}>{getTimeAgo(capturedAt)}</Text>
          </View>

          {/* Comment preview - below user info, above progress bar
              Stories mode: raised to match userInfoOverlay
              Feed mode: original position */}
          {previewComments.length > 0 && (
            <View
              style={[styles.commentPreviewContainer, { bottom: mode === 'stories' ? 100 : 90 }]}
            >
              <CommentPreview
                comments={previewComments}
                totalCount={currentPhoto?.commentCount || 0}
                onPress={() => setShowComments(true)}
                showViewAll={false}
              />
            </View>
          )}

          {/* Progress bar - stories mode only, positioned below user info */}
          {showProgressBar && totalPhotos > 0 && (
            <ScrollView
              ref={progressScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEnabled={needsScroll}
              style={styles.progressBarScrollView}
              contentContainerStyle={styles.progressBarContainer}
            >
              {Array.from({ length: totalPhotos }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressSegment,
                    { width: segmentWidth },
                    index <= currentIndex
                      ? styles.progressSegmentActive
                      : styles.progressSegmentInactive,
                  ]}
                />
              ))}
            </ScrollView>
          )}

          {/* Footer - Comment Input + Emoji Pills */}
          <View style={styles.footer}>
            {/* Comment input trigger - left side */}
            <TouchableOpacity
              style={styles.commentInputTrigger}
              onPress={() => setShowComments(true)}
              activeOpacity={0.8}
            >
              <PixelIcon name="chatbubble-outline" size={16} color={colors.text.secondary} />
              <Text style={styles.commentInputTriggerText} numberOfLines={1}>
                {currentPhoto?.commentCount > 0
                  ? `${currentPhoto.commentCount} comment${currentPhoto.commentCount === 1 ? '' : 's'}`
                  : 'Add a comment...'}
              </Text>
            </TouchableOpacity>

            {/* Emoji pills - right side (custom + curated emojis + add button) */}
            {/* When isOwnStory, show reactions as read-only with reduced opacity */}
            <ScrollView
              ref={emojiScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.emojiPickerContainer}
              style={[styles.emojiPickerScrollView, isOwnStory && styles.disabledEmojiRow]}
            >
              {orderedEmojis.map(emoji => {
                const totalCount = groupedReactions[emoji] || 0;
                const userCount = getUserReactionCount(emoji);
                const isSelected = userCount > 0;
                const isNewlyAdded = emoji === newlyAddedEmoji;

                // For own stories, render as non-interactive View
                if (isOwnStory) {
                  return (
                    <View key={emoji} style={{ position: 'relative' }}>
                      <View style={[styles.emojiPill, isSelected && styles.emojiPillSelected]}>
                        <Text style={styles.emojiPillEmoji}>{emoji}</Text>
                        {totalCount > 0 && <Text style={styles.emojiPillCount}>{totalCount}</Text>}
                      </View>
                    </View>
                  );
                }

                return (
                  <View key={emoji} style={{ position: 'relative' }}>
                    <TouchableOpacity
                      style={[styles.emojiPill, isSelected && styles.emojiPillSelected]}
                      onPress={() => handleEmojiPress(emoji)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.emojiPillEmoji}>{emoji}</Text>
                      {totalCount > 0 && <Text style={styles.emojiPillCount}>{totalCount}</Text>}
                    </TouchableOpacity>
                    {/* Purple highlight overlay that fades out */}
                    {isNewlyAdded && (
                      <Animated.View
                        pointerEvents="none"
                        style={[styles.emojiHighlightOverlay, { opacity: highlightOpacity }]}
                      />
                    )}
                  </View>
                );
              })}

              {/* Add custom emoji button - hidden for own stories */}
              {!isOwnStory && (
                <TouchableOpacity
                  style={[styles.emojiPill, styles.addEmojiButton]}
                  onPress={handleOpenEmojiPicker}
                  activeOpacity={0.7}
                >
                  <Text style={styles.addEmojiText}>+</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Comments Bottom Sheet */}
      <CommentsBottomSheet
        visible={showComments}
        onClose={() => setShowComments(false)}
        photoId={currentPhoto?.id}
        photoOwnerId={currentPhoto?.userId}
        currentUserId={currentUserId}
        onAvatarPress={handleCommentAvatarPress}
      />

      {/* Custom Emoji Picker */}
      <EmojiPicker
        onEmojiSelected={handleEmojiPickerSelect}
        open={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        enableRecentlyUsed={false}
        enableSearchBar={true}
        theme={{
          backdrop: colors.overlay.dark,
          knob: colors.text.secondary,
          container: colors.background.secondary,
          header: colors.text.primary,
          skinTonesContainer: colors.background.secondary,
          category: {
            icon: colors.text.secondary,
            iconActive: colors.text.primary,
            container: colors.background.secondary,
            containerActive: colors.brand.purple,
          },
          search: {
            text: colors.text.primary,
            placeholder: colors.text.secondary,
            icon: colors.text.secondary,
            background: colors.background.tertiary,
          },
          emoji: {
            selected: colors.brand.purple,
          },
        }}
      />
    </Modal>
  );
};

export default PhotoDetailModal;
