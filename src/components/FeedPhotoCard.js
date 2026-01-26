import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTimeAgo } from '../utils/timeUtils';
import { styles } from '../styles/FeedPhotoCard.styles';
import { colors } from '../constants/colors';

/**
 * Feed photo card component - Overlapping Profile Design
 *
 * Full-width photos with profile photo overlapping the bottom edge
 * and name/timestamp floating below, centered.
 *
 * @param {object} photo - Photo object with user data
 * @param {function} onPress - Callback when card is tapped
 */
const FeedPhotoCard = ({ photo, onPress }) => {
  const { imageURL, capturedAt, reactions = {}, reactionCount = 0, user = {} } = photo;

  const { displayName, profilePhotoURL } = user;

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
      {/* Photo container with overlapping profile */}
      <View style={styles.photoWrapper}>
        <View style={styles.photoContainer}>
          <Image source={{ uri: imageURL }} style={styles.photo} resizeMode="cover" />
        </View>

        {/* Profile photo overlapping bottom edge */}
        <View style={styles.profileOverlay}>
          {profilePhotoURL ? (
            <Image source={{ uri: profilePhotoURL }} style={styles.profilePhoto} />
          ) : (
            <View style={styles.profilePhotoFallback}>
              <Ionicons name="person-circle" size={52} color={colors.text.secondary} />
            </View>
          )}
        </View>
      </View>

      {/* User info - centered below profile photo */}
      <View style={styles.userInfo}>
        <Text style={styles.displayName} numberOfLines={1}>
          {displayName || 'Unknown'}
        </Text>
        <Text style={styles.timestamp}>{getTimeAgo(capturedAt)}</Text>
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
    </TouchableOpacity>
  );
};

export default FeedPhotoCard;
