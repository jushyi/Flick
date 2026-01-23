import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import logger from '../utils/logger';

/**
 * FriendStoryCard component
 * Displays a friend's avatar and name for the Stories row
 * Tappable card that opens the StoriesViewerModal
 *
 * @param {object} friend - Friend data object
 * @param {string} friend.userId - Friend's user ID
 * @param {string} friend.displayName - Friend's display name
 * @param {string} friend.profilePhotoURL - Friend's profile photo URL (optional)
 * @param {Array} friend.topPhotos - Friend's top photos by engagement
 * @param {boolean} friend.hasPhotos - Whether friend has any photos
 * @param {function} onPress - Callback when card is tapped
 * @param {boolean} isFirst - Whether this is the first card (for left margin)
 */
const FriendStoryCard = ({ friend, onPress, isFirst = false }) => {
  const { userId, displayName, profilePhotoURL, hasPhotos } = friend;

  /**
   * Handle card press
   */
  const handlePress = () => {
    logger.debug('FriendStoryCard: Card pressed', { userId, displayName });
    if (onPress) {
      onPress();
    }
  };

  /**
   * Get first letter of display name for fallback avatar
   */
  const getInitial = () => {
    return displayName?.[0]?.toUpperCase() || '?';
  };

  return (
    <TouchableOpacity
      style={[styles.container, isFirst && styles.firstContainer]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Avatar with gradient ring */}
      <View style={[styles.avatarRing, hasPhotos && styles.avatarRingActive]}>
        <View style={styles.avatarInner}>
          {profilePhotoURL ? (
            <Image source={{ uri: profilePhotoURL }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{getInitial()}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Display name */}
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {displayName || 'Unknown'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 75,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  firstContainer: {
    marginLeft: 0,
  },
  avatarRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3A3A3A', // Gray ring for friends without photos
    marginBottom: 6,
  },
  avatarRingActive: {
    // Instagram-style gradient fallback - purple/pink solid border
    borderColor: '#C13584', // Instagram purple-pink color
    borderWidth: 2.5,
  },
  avatarInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#000000',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#000000', // Creates gap between ring and avatar
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 27,
  },
  avatarPlaceholder: {
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '600',
    color: '#888888',
  },
  name: {
    fontSize: 11,
    color: '#FFFFFF',
    textAlign: 'center',
    maxWidth: 66,
  },
});

export default FriendStoryCard;
