import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { getTimeAgo } from '../utils/timeUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = 16;
const PHOTO_SIZE = SCREEN_WIDTH - CARD_PADDING * 2;

/**
 * Feed photo card component
 * Displays a single photo in the feed with user info and reactions
 *
 * @param {object} photo - Photo object with user data
 * @param {function} onPress - Callback when card is tapped
 */
const FeedPhotoCard = ({ photo, onPress }) => {
  const { imageURL, capturedAt, reactions = {}, reactionCount = 0, user = {} } = photo;

  const { username, displayName, profilePhotoURL } = user;

  /**
   * Get top 3 reactions with counts
   * New data structure: reactions[userId][emoji] = count
   */
  const getTopReactions = () => {
    if (!reactions || Object.keys(reactions).length === 0) return [];

    // Aggregate emoji counts across all users
    const emojiCounts = {};
    Object.values(reactions).forEach(userReactions => {
      // userReactions is now an object: { '😂': 2, '❤️': 1 }
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
      {/* Profile section */}
      <View style={styles.profileSection}>
        {/* Profile photo */}
        <View style={styles.profilePicContainer}>
          {profilePhotoURL ? (
            <Image source={{ uri: profilePhotoURL }} style={styles.profilePic} />
          ) : (
            <View style={[styles.profilePic, styles.profilePicPlaceholder]}>
              <Text style={styles.profilePicText}>{displayName?.[0]?.toUpperCase() || '?'}</Text>
            </View>
          )}
        </View>

        {/* User info */}
        <View style={styles.profileInfo}>
          <Text style={styles.displayName} numberOfLines={1}>
            {displayName || 'Unknown User'}
          </Text>
          <Text style={styles.username} numberOfLines={1}>
            @{username || 'unknown'}
          </Text>
        </View>

        {/* Timestamp */}
        <Text style={styles.timestamp}>{getTimeAgo(capturedAt)}</Text>
      </View>

      {/* Photo */}
      <View style={styles.photoContainer}>
        <Image source={{ uri: imageURL }} style={styles.photo} resizeMode="cover" />
      </View>

      {/* Reaction bar */}
      {reactionCount > 0 && (
        <View style={styles.reactionBar}>
          {topReactions.map((reaction, index) => (
            <View key={index} style={styles.reactionItem}>
              <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
              <Text style={styles.reactionCount}>{reaction.count}</Text>
            </View>
          ))}
          {reactionCount > 3 && <Text style={styles.moreReactions}>+{reactionCount - 3} more</Text>}
        </View>
      )}

      {/* Empty reaction bar if no reactions */}
      {reactionCount === 0 && (
        <View style={styles.reactionBar}>
          <Text style={styles.noReactions}>Be the first to react</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  profilePicContainer: {
    marginRight: 12,
  },
  profilePic: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  profilePicPlaceholder: {
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  profileInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  username: {
    fontSize: 12,
    color: '#666666',
  },
  timestamp: {
    fontSize: 12,
    color: '#999999',
    marginLeft: 8,
  },
  photoContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F0F0F0',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  reactionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  reactionEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  reactionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  moreReactions: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 4,
  },
  noReactions: {
    fontSize: 12,
    color: '#999999',
    fontStyle: 'italic',
  },
});

export default FeedPhotoCard;
