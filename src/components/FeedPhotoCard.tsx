import React, { useRef, useState, useEffect, memo } from 'react';
import { View, Text, TouchableOpacity, Pressable, Platform } from 'react-native';
import { TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import { Image } from 'expo-image';

import PixelIcon from './PixelIcon';
import StrokedNameText from './StrokedNameText';
import VideoPlayer from './VideoPlayer';
import CommentPreview from './comments/CommentPreview';

import { useVideoMute } from '../context/VideoMuteContext';

import { getTimeAgo } from '../utils/timeUtils';
import { getComments as getPreviewComments } from '../services/supabase/commentService';

import { styles } from '../styles/FeedPhotoCard.styles';
import { colors } from '../constants/colors';
import { profileCacheKey } from '../utils/imageUtils';

/**
 * Feed photo card component - Instagram-Style Design
 *
 * Full-width photos with user info row below.
 * Modern, clean aesthetic with dark theme.
 *
 * @param {object} photo - Photo object with user data
 * @param {function} onPress - Callback when card is tapped
 * @param {function} onCommentPress - Callback when comment preview is tapped (opens modal with comments sheet)
 * @param {function} onAvatarPress - Callback when avatar is tapped (userId, displayName) -> navigate to profile
 * @param {string} currentUserId - Current user's ID (to disable tap on own avatar)
 */
/**
 * Format video duration in seconds to M:SS string
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration (e.g. "0:12", "1:05")
 */
type Props = {
  photo: Record<string, unknown>;
  onPress?: (photoId: string) => void;
  onCommentPress?: (photoId: string) => void;
  onAvatarPress?: (userId: string) => void;
  currentUserId?: string;
  isVisible?: boolean;
};

const FeedPhotoCard = ({
  photo,
  onPress,
  onCommentPress,
  onAvatarPress,
  currentUserId,
  isVisible = false,
}: Props) => {
  const {
    id,
    imageURL,
    capturedAt,
    reactions = {},
    reactionCount = 0,
    commentCount = 0,
    userId,
    user = {},
    mediaType,
    videoURL,
  } = photo;

  const isVideo = mediaType === 'video';

  const { displayName, profilePhotoURL } = user;

  // Global mute state for video playback
  const { isMuted, toggleMute } = useVideoMute();

  // Mute indicator flash — triggered by isMuted changes, not by tap handler
  const [muteFlash, setMuteFlash] = useState(null);
  const prevMutedRef = useRef(isMuted);

  useEffect(() => {
    if (!isVideo) return;
    if (prevMutedRef.current !== isMuted) {
      setMuteFlash(isMuted ? 'muted' : 'unmuted');
      const timer = setTimeout(() => setMuteFlash(null), 800);
      prevMutedRef.current = isMuted;
      return () => clearTimeout(timer);
    }
  }, [isMuted, isVideo]);

  const [previewComments, setPreviewComments] = useState([]);

  useEffect(() => {
    const fetchPreview = async () => {
      if (!id) return;
      const result = await getPreviewComments(id, userId);
      if (result.success) {
        setPreviewComments(result.previewComments || []);
      }
    };

    fetchPreview();
  }, [id, userId, commentCount]);

  /**
   * Get top 3 reactions with counts
   * Data structure: reactions[userId][emoji] = count
   */
  const getTopReactions = () => {
    if (!reactions || Object.keys(reactions).length === 0) return [];

    // Aggregate emoji counts across all users
    const emojiCounts = {};
    Object.values(reactions).forEach(userReactions => {
      // userReactions is an object: { '😂': 2, '❤️': 1 }
      if (typeof userReactions === 'object') {
        Object.entries(userReactions).forEach(([emoji, count]) => {
          if (!emojiCounts[emoji]) {
            emojiCounts[emoji] = 0;
          }
          emojiCounts[emoji] += count;
        });
      }
    });

    // Sort by count and take top 3
    return Object.entries(emojiCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([emoji, count]) => ({ emoji, count }));
  };

  const topReactions = getTopReactions();

  /**
   * Handle avatar press - navigate to user's profile
   * Disabled for own photos (userId === currentUserId)
   */
  const handleAvatarPress = () => {
    // Don't allow tap on own avatar
    if (userId === currentUserId) return;
    if (onAvatarPress && userId) {
      onAvatarPress(userId, displayName);
    }
  };

  // Check if this is the current user's own photo
  const isOwnPhoto = userId === currentUserId;

  // Ref for measuring photo position (expand/collapse animation)
  const photoContainerRef = useRef(null);

  const measurePhotoAndCall = callback => {
    if (photoContainerRef.current) {
      photoContainerRef.current.measureInWindow((x, y, width, height) => {
        if (callback) callback({ x, y, width, height, borderRadius: 0 });
      });
    } else if (callback) {
      callback(null);
    }
  };

  const handlePhotoPress = () => {
    measurePhotoAndCall(onPress);
  };

  const handleCommentPreviewPress = () => {
    measurePhotoAndCall(onCommentPress || onPress);
  };

  return (
    <View testID="feed-photo-card" style={styles.card}>
      {/* Photo/Video - full width */}
      <View ref={photoContainerRef} style={styles.photoContainer}>
        {isVideo && videoURL ? (
          <>
            {Platform.OS === 'android' ? (
              <GHTouchableOpacity activeOpacity={1} onPress={toggleMute} style={styles.photo}>
                <VideoPlayer
                  source={videoURL}
                  isMuted={isMuted}
                  onToggleMute={toggleMute}
                  loop={true}
                  autoPlay={true}
                  showControls={false}
                  isVisible={isVisible}
                  contentFit="cover"
                />
              </GHTouchableOpacity>
            ) : (
              <Pressable onPress={toggleMute} style={styles.photo}>
                <VideoPlayer
                  source={videoURL}
                  isMuted={isMuted}
                  onToggleMute={toggleMute}
                  loop={true}
                  autoPlay={true}
                  showControls={false}
                  isVisible={isVisible}
                  contentFit="cover"
                />
              </Pressable>
            )}
            {muteFlash && (
              <View style={styles.muteFlashOverlay} pointerEvents="none">
                <View style={styles.muteFlashBubble}>
                  <PixelIcon
                    name={
                      muteFlash === 'muted' ? 'notifications-off-outline' : 'musical-notes-outline'
                    }
                    size={28}
                    color={colors.text.primary}
                  />
                </View>
              </View>
            )}
          </>
        ) : (
          <TouchableOpacity activeOpacity={0.95} onPress={handlePhotoPress}>
            <Image
              source={{ uri: imageURL, cacheKey: `photo-${id}` }}
              style={styles.photo}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={0}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* User info row - tappable to open detail modal for videos */}
      <TouchableOpacity
        style={styles.infoRow}
        onPress={isVideo ? handlePhotoPress : undefined}
        activeOpacity={isVideo ? 0.7 : 1}
        disabled={!isVideo}
      >
        {/* Profile photo or fallback icon - tappable to navigate to profile (disabled for own photos) */}
        <TouchableOpacity
          onPress={handleAvatarPress}
          activeOpacity={isOwnPhoto ? 1 : 0.7}
          disabled={isOwnPhoto}
        >
          {profilePhotoURL ? (
            <Image
              source={{
                uri: profilePhotoURL,
                cacheKey: profileCacheKey(`profile-${userId}`, profilePhotoURL),
              }}
              style={styles.profilePhoto}
              cachePolicy="memory-disk"
              transition={0}
            />
          ) : (
            <View style={styles.profilePhotoFallback}>
              <PixelIcon name="person-circle" size={36} color={colors.text.secondary} />
            </View>
          )}
        </TouchableOpacity>

        {/* Name and timestamp */}
        <View style={styles.textContainer}>
          <StrokedNameText style={styles.displayName} nameColor={user?.nameColor} numberOfLines={1}>
            {displayName || 'Unknown'}
          </StrokedNameText>
          <Text style={styles.timestamp}>{getTimeAgo(capturedAt)}</Text>
        </View>
      </TouchableOpacity>

      {/* Attribution line (for reshared photos) */}
      {photo.attribution && (
        <TouchableOpacity
          onPress={() =>
            onAvatarPress(
              photo.attribution.photographerId,
              photo.attribution.photographerDisplayName
            )
          }
          activeOpacity={0.7}
          style={styles.attributionRow}
        >
          <PixelIcon name="camera" size={14} color={colors.text.tertiary} />
          <Text style={styles.attributionText}>
            Photo by @{photo.attribution.photographerUsername}
          </Text>
        </TouchableOpacity>
      )}

      {/* Caption (if present) */}
      {photo.caption ? (
        <Text style={styles.captionText} numberOfLines={3}>
          {photo.caption}
        </Text>
      ) : null}

      {/* Reactions row (if present) */}
      {reactionCount > 0 && (
        <View style={styles.reactions}>
          {topReactions.map((reaction, index) => (
            <View key={index} style={styles.reactionItem}>
              <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
              <Text style={styles.reactionCount}>{reaction.count}</Text>
            </View>
          ))}
          {reactionCount > 3 && <Text style={styles.moreReactions}>+{reactionCount - 3}</Text>}
        </View>
      )}

      {/* Prompt if no reactions */}
      {reactionCount === 0 && <Text style={styles.noReactions}>Tap to react</Text>}

      {/* Comment preview - tapping opens modal with comments sheet */}
      {previewComments.length > 0 && (
        <View testID="feed-comments-button" style={styles.commentPreview}>
          <CommentPreview
            comments={previewComments}
            totalCount={commentCount}
            onPress={handleCommentPreviewPress}
            compact
          />
        </View>
      )}
    </View>
  );
};

export default memo(FeedPhotoCard, (prevProps, nextProps) => {
  // Only re-render when photo data or visibility actually changes
  return (
    prevProps.photo === nextProps.photo &&
    prevProps.currentUserId === nextProps.currentUserId &&
    prevProps.isVisible === nextProps.isVisible
  );
});
