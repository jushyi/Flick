import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTimeAgo } from '../utils/timeUtils';
import { styles } from '../styles/FeedPhotoCard.styles';
import { colors } from '../constants/colors';
import CommentPreview from './comments/CommentPreview';
import { getPreviewComments } from '../services/firebase/commentService';

/**
 * Feed photo card component - Instagram-Style Design
 *
 * Full-width photos with user info row below.
 * Modern, clean aesthetic with dark theme.
 *
 * @param {object} photo - Photo object with user data
 * @param {function} onPress - Callback when card is tapped
 * @param {function} onCommentPress - Callback when comment preview is tapped (opens modal with comments sheet)
 */
const FeedPhotoCard = ({ photo, onPress, onCommentPress }) => {
  const {
    id,
    imageURL,
    capturedAt,
    reactions = {},
    reactionCount = 0,
    commentCount = 0,
    userId,
    user = {},
  } = photo;

  const { displayName, profilePhotoURL } = user;

  // Preview comments state
  const [previewComments, setPreviewComments] = useState([]);

  // Fetch preview comments
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

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.95}>
      {/* Photo - full width with rounded top corners */}
      <View style={styles.photoContainer}>
        <Image source={{ uri: imageURL }} style={styles.photo} resizeMode="cover" />
      </View>

      {/* User info row - profile photo + name + timestamp */}
      <View style={styles.infoRow}>
        {/* Profile photo or fallback icon */}
        {profilePhotoURL ? (
          <Image source={{ uri: profilePhotoURL }} style={styles.profilePhoto} />
        ) : (
          <View style={styles.profilePhotoFallback}>
            <Ionicons name="person-circle" size={36} color={colors.text.secondary} />
          </View>
        )}

        {/* Name and timestamp */}
        <View style={styles.textContainer}>
          <Text style={styles.displayName} numberOfLines={1}>
            {displayName || 'Unknown'}
          </Text>
          <Text style={styles.timestamp}>{getTimeAgo(capturedAt)}</Text>
        </View>
      </View>

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

      {/* Comment preview - tapping opens modal with comments sheet (UAT-005 fix) */}
      {previewComments.length > 0 && (
        <View style={styles.commentPreview}>
          <CommentPreview
            comments={previewComments}
            totalCount={commentCount}
            onPress={onCommentPress || onPress}
            compact
          />
        </View>
      )}
    </TouchableOpacity>
  );
};

export default FeedPhotoCard;
