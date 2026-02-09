/**
 * PhotoDetailScreen - Navigation screen version of photo viewer
 *
 * Uses transparentModal presentation to keep previous screen visible.
 * Gets state from PhotoDetailContext instead of props.
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
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  StatusBar,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import EmojiPicker from 'rn-emoji-keyboard';
import { useNavigation } from '@react-navigation/native';
import { getTimeAgo } from '../utils/timeUtils';
import { usePhotoDetailModal } from '../hooks/usePhotoDetailModal';
import { usePhotoDetail } from '../context/PhotoDetailContext';
import { styles } from '../styles/PhotoDetailScreen.styles';
import CommentsBottomSheet from '../components/comments/CommentsBottomSheet';
import CommentPreview from '../components/comments/CommentPreview';
import { getPreviewComments } from '../services/firebase/commentService';
import {
  softDeletePhoto,
  archivePhoto,
  restorePhoto,
  updatePhotoTags,
} from '../services/firebase/photoService';
import DropdownMenu from '../components/DropdownMenu';
import { TagFriendsModal, TaggedPeopleModal } from '../components';
import { colors } from '../constants/colors';

// Progress bar constants - matches photo marginHorizontal (8px)
const PROGRESS_BAR_HORIZONTAL_PADDING = 8;
const PROGRESS_BAR_GAP = 2;
const MIN_SEGMENT_WIDTH = 4;
const MAX_VISIBLE_SEGMENTS = 20;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * PhotoDetailScreen Component
 *
 * Navigation screen that displays photo detail view.
 * Gets all state from PhotoDetailContext.
 */
const PhotoDetailScreen = () => {
  const navigation = useNavigation();

  // Get state and callbacks from context
  const {
    currentPhoto: contextPhoto,
    photos: contextPhotos,
    currentIndex: contextInitialIndex,
    mode: contextMode,
    isOwnStory: contextIsOwnStory,
    hasNextFriend: contextHasNextFriend,
    currentUserId: contextUserId,
    showComments,
    setShowComments,
    handleReactionToggle,
    handlePhotoChange,
    handleRequestNextFriend,
    handleAvatarPress: contextAvatarPress,
    handleClose: contextClose,
    handlePhotoStateChanged,
  } = usePhotoDetail();

  // Cube transition animation for friend-to-friend
  const cubeRotation = useRef(new Animated.Value(0)).current;
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Comments preview state (local since it's just for display)
  const [previewComments, setPreviewComments] = useState([]);

  // Progress bar scroll ref for auto-scrolling
  const progressScrollRef = useRef(null);

  // Emoji scroll ref for auto-scrolling when new emoji added
  const emojiScrollRef = useRef(null);

  // Highlight fade animation for newly added emoji (1 second fade)
  const highlightOpacity = useRef(new Animated.Value(1)).current;

  // Photo menu state (for owner actions: delete, archive, restore)
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);

  // Tag modal state
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [taggedPeopleModalVisible, setTaggedPeopleModalVisible] = useState(false);

  // Reset cube rotation when screen mounts
  useEffect(() => {
    cubeRotation.setValue(0);
    setIsTransitioning(false);
  }, []);

  /**
   * Handle close - navigate back
   */
  const handleClose = useCallback(() => {
    // Call context close handler
    contextClose();
    // Navigate back
    navigation.goBack();
  }, [contextClose, navigation]);

  /**
   * Handle friend-to-friend transition with cube animation
   */
  const handleFriendTransition = useCallback(() => {
    if (!contextHasNextFriend || isTransitioning) return false;

    setIsTransitioning(true);

    // Animate cube rotation out (0 -> -90 degrees)
    Animated.timing(cubeRotation, {
      toValue: -90,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      // Trigger friend change callback
      handleRequestNextFriend();
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
  }, [contextHasNextFriend, handleRequestNextFriend, cubeRotation, isTransitioning]);

  /**
   * ISS-005: Handle swipe-up gesture to open comments
   * Only opens if comments are currently closed
   */
  const handleSwipeUpToOpenComments = useCallback(() => {
    if (!showComments) {
      setShowComments(true);
    }
  }, [showComments, setShowComments]);

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

    // Comments visibility (for disabling swipe-to-dismiss during comment scroll)
    updateCommentsVisible,
  } = usePhotoDetailModal({
    mode: contextMode,
    photo: contextPhoto,
    photos: contextPhotos,
    initialIndex: contextInitialIndex,
    onPhotoChange: handlePhotoChange,
    visible: true, // Always visible since it's a screen
    onClose: handleClose,
    onReactionToggle: handleReactionToggle,
    currentUserId: contextUserId,
    onFriendTransition: contextHasNextFriend ? handleFriendTransition : null,
    onSwipeUp: handleSwipeUpToOpenComments, // ISS-005: swipe up to open comments
  });

  // Sync comments visibility with hook (so panResponder knows not to capture gestures)
  useEffect(() => {
    updateCommentsVisible(showComments);
  }, [showComments, updateCommentsVisible]);

  // Check if viewing own photo (disable avatar tap)
  const isOwnPhoto = currentPhoto?.userId === contextUserId;

  /**
   * Handle avatar press - navigate to user's profile
   * Disabled for own photos
   */
  const handleAvatarPress = useCallback(() => {
    if (isOwnPhoto) return;
    if (contextAvatarPress && currentPhoto) {
      contextAvatarPress(currentPhoto.userId, displayName);
    }
  }, [contextAvatarPress, currentPhoto, displayName, isOwnPhoto]);

  /**
   * Handle avatar press from comments - navigate to user's profile
   * Keep comments open - when user returns they'll be right where they were
   */
  const handleCommentAvatarPress = useCallback(
    (userId, userName) => {
      // Navigate directly - comments and PhotoDetail stay open underneath
      // When user goes back from profile, they return to PhotoDetail with comments still visible
      if (contextAvatarPress) {
        contextAvatarPress(userId, userName);
      }
    },
    [contextAvatarPress]
  );

  /**
   * Handle archive - show confirmation and archive photo
   */
  const handleArchive = useCallback(() => {
    setShowPhotoMenu(false);
    Alert.alert(
      'Remove from Journal',
      'This photo will be hidden from your stories and feed but remain in your albums. You can restore it anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          onPress: async () => {
            const result = await archivePhoto(currentPhoto.id, contextUserId);
            if (result.success) {
              handlePhotoStateChanged?.(); // Refresh feed/stories
              handleClose(); // Close viewer - photo is now hidden
            } else {
              Alert.alert('Error', result.error || 'Failed to archive photo');
            }
          },
        },
      ]
    );
  }, [currentPhoto?.id, contextUserId, handleClose, handlePhotoStateChanged]);

  /**
   * Handle restore - no confirmation needed for non-destructive action
   */
  const handleRestore = useCallback(async () => {
    setShowPhotoMenu(false);
    const result = await restorePhoto(currentPhoto.id, contextUserId);
    if (result.success) {
      handlePhotoStateChanged?.(); // Refresh feed/stories
      // Show success message - photo will now appear in feed/stories again
      Alert.alert('Restored', 'Photo has been restored to your journal.');
    } else {
      Alert.alert('Error', result.error || 'Failed to restore photo');
    }
  }, [currentPhoto?.id, contextUserId, handlePhotoStateChanged]);

  /**
   * Handle delete - moves photo to Recently Deleted (30-day grace period)
   */
  const handleDeleteConfirm = useCallback(() => {
    setShowPhotoMenu(false);
    Alert.alert(
      'Delete Photo',
      'This photo will be moved to Recently Deleted. You can restore it within 30 days from Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await softDeletePhoto(currentPhoto.id, contextUserId);
            if (result.success) {
              handlePhotoStateChanged?.(); // Refresh feed/stories
              handleClose(); // Close viewer - photo is deleted
            } else {
              Alert.alert('Error', result.error || 'Failed to delete photo');
            }
          },
        },
      ]
    );
  }, [currentPhoto?.id, contextUserId, handleClose, handlePhotoStateChanged]);

  /**
   * Build menu options based on photo state
   */
  const menuOptions = useMemo(() => {
    if (!isOwnPhoto) return [];

    const options = [];

    if (currentPhoto?.photoState === 'journal') {
      options.push({
        label: 'Remove from Journal',
        icon: 'archive-outline',
        onPress: handleArchive,
      });
    } else if (currentPhoto?.photoState === 'archive') {
      options.push({
        label: 'Restore to Journal',
        icon: 'refresh-outline',
        onPress: handleRestore,
      });
    }

    options.push({
      label: 'Delete',
      icon: 'trash-outline',
      onPress: handleDeleteConfirm,
      destructive: true,
    });

    return options;
  }, [isOwnPhoto, currentPhoto?.photoState, handleArchive, handleRestore, handleDeleteConfirm]);

  /**
   * Handle menu button press - capture position for anchored menu
   */
  const handleMenuButtonLayout = useCallback(event => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setMenuAnchor({ x, y, width, height });
  }, []);

  // Fetch preview comments when photo changes
  useEffect(() => {
    const fetchPreviewComments = async () => {
      if (!currentPhoto?.id) {
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
  }, [currentPhoto?.id, currentPhoto?.userId, showComments]);

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
      const currentSegmentStart = currentIndex * segmentTotalWidth;
      const currentSegmentCenter = currentSegmentStart + segmentWidth / 2;

      // Scroll so current segment is about 1/3 from left edge
      const targetScrollX = Math.max(0, currentSegmentCenter - visibleWidth / 3);
      const maxScrollX = Math.max(0, totalContentWidth - visibleWidth);

      progressScrollRef.current.scrollTo({
        x: Math.min(targetScrollX, maxScrollX),
        animated: true,
      });
    }
  }, [currentIndex, needsScroll, segmentWidth, totalPhotos]);

  // Don't render if no photo
  if (!currentPhoto) return null;

  return (
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
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Photo - TouchableWithoutFeedback for swipe-to-close gesture support */}
        <TouchableWithoutFeedback
          onPress={contextMode === 'stories' ? handleTapNavigation : undefined}
        >
          <View style={styles.photoScrollView}>
            <Image
              source={{ uri: imageURL }}
              style={styles.photo}
              contentFit="cover"
              transition={0}
            />
          </View>
        </TouchableWithoutFeedback>

        {/* Profile photo - overlapping top left of photo, tappable to navigate to profile */}
        <TouchableOpacity
          style={styles.profilePicContainer}
          onPress={handleAvatarPress}
          activeOpacity={isOwnPhoto ? 1 : 0.7}
          disabled={isOwnPhoto}
        >
          {profilePhotoURL ? (
            <Image source={{ uri: profilePhotoURL }} style={styles.profilePic} contentFit="cover" />
          ) : (
            <View style={[styles.profilePic, styles.profilePicPlaceholder]}>
              <Text style={styles.profilePicText}>{displayName?.[0]?.toUpperCase() || '?'}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* User info - bottom left of photo */}
        <View
          style={[
            styles.userInfoOverlay,
            {
              bottom:
                contextMode === 'stories'
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

        {/* Comment preview - below user info, above progress bar */}
        {previewComments.length > 0 && (
          <View
            style={[
              styles.commentPreviewContainer,
              { bottom: contextMode === 'stories' ? 100 : 90 },
            ]}
          >
            <CommentPreview
              comments={previewComments}
              totalCount={currentPhoto?.commentCount || 0}
              onPress={() => setShowComments(true)}
              showViewAll={false}
            />
          </View>
        )}

        {/* Tag button - visible for owner always, non-owner only when tags exist */}
        {(isOwnPhoto || currentPhoto?.taggedUserIds?.length > 0) && (
          <TouchableOpacity
            style={styles.tagButton}
            onPress={() => {
              if (isOwnPhoto) {
                setTagModalVisible(true);
              } else {
                setTaggedPeopleModalVisible(true);
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={currentPhoto?.taggedUserIds?.length > 0 ? 'person' : 'person-add-outline'}
              size={18}
              color={colors.text.primary}
            />
          </TouchableOpacity>
        )}

        {/* Photo menu button - only for own photos */}
        {isOwnPhoto && menuOptions.length > 0 && (
          <TouchableOpacity
            style={styles.photoMenuButton}
            onPress={() => setShowPhotoMenu(true)}
            onLayout={handleMenuButtonLayout}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-vertical" size={28} color={colors.text.primary} />
          </TouchableOpacity>
        )}

        {/* Progress bar - stories mode only */}
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
            <Ionicons name="chatbubble-outline" size={16} color={colors.text.secondary} />
            <Text style={styles.commentInputTriggerText} numberOfLines={1}>
              {currentPhoto?.commentCount > 0
                ? `${currentPhoto.commentCount} comment${currentPhoto.commentCount === 1 ? '' : 's'}`
                : 'Add a comment...'}
            </Text>
          </TouchableOpacity>

          {/* Emoji pills - right side */}
          <ScrollView
            ref={emojiScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.emojiPickerContainer}
            style={[styles.emojiPickerScrollView, contextIsOwnStory && styles.disabledEmojiRow]}
          >
            {orderedEmojis.map(emoji => {
              const totalCount = groupedReactions[emoji] || 0;
              const userCount = getUserReactionCount(emoji);
              const isSelected = userCount > 0;
              const isNewlyAdded = emoji === newlyAddedEmoji;

              // For own stories, render as non-interactive View
              if (contextIsOwnStory) {
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
            {!contextIsOwnStory && (
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

      {/* Comments Bottom Sheet */}
      <CommentsBottomSheet
        visible={showComments}
        onClose={() => setShowComments(false)}
        photoId={currentPhoto?.id}
        photoOwnerId={currentPhoto?.userId}
        currentUserId={contextUserId}
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

      {/* Photo Menu Dropdown (for owner actions) */}
      <DropdownMenu
        visible={showPhotoMenu}
        onClose={() => setShowPhotoMenu(false)}
        options={menuOptions}
        anchorPosition={menuAnchor}
      />

      {/* Tag Friends Modal (for owner tagging) */}
      <TagFriendsModal
        visible={tagModalVisible}
        onClose={() => setTagModalVisible(false)}
        initialSelectedIds={currentPhoto?.taggedUserIds || []}
        onConfirm={async selectedIds => {
          await updatePhotoTags(currentPhoto.id, selectedIds);
          setTagModalVisible(false);
        }}
      />

      {/* Tagged People Modal (for non-owner viewing) */}
      <TaggedPeopleModal
        visible={taggedPeopleModalVisible}
        onClose={() => setTaggedPeopleModalVisible(false)}
        taggedUserIds={currentPhoto?.taggedUserIds || []}
        onPersonPress={(userId, userName) => {
          setTaggedPeopleModalVisible(false);
          contextAvatarPress?.(userId, userName);
        }}
      />
    </Animated.View>
  );
};

export default PhotoDetailScreen;
