import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';

/**
 * UserSearchCard - Display search result for a user
 *
 * Shows:
 * - Profile photo (80x80, circular)
 * - Display name (bold, 16px)
 * - Username (@username, gray, 14px)
 * - Bio (truncated, 12px, light gray)
 * - Action button based on friendship status
 *
 * @param {object} user - User object with profile data
 * @param {string} friendshipStatus - 'none' | 'pending_sent' | 'pending_received' | 'friends'
 * @param {function} onAddFriend - Callback when "Add Friend" is pressed
 * @param {boolean} disabled - Disable button interaction
 */
const UserSearchCard = ({ user, friendshipStatus, onAddFriend, disabled = false }) => {
  const { displayName, username, bio, profilePhotoURL } = user;

  /**
   * Get button configuration based on friendship status
   */
  const getButtonConfig = () => {
    switch (friendshipStatus) {
      case 'friends':
        return {
          label: 'Friends',
          style: styles.buttonDisabled,
          textStyle: styles.buttonTextDisabled,
          disabled: true,
        };
      case 'pending_sent':
        return {
          label: 'Pending',
          style: styles.buttonPending,
          textStyle: styles.buttonTextPending,
          disabled: true,
        };
      case 'pending_received':
        return {
          label: 'Respond',
          style: styles.buttonActive,
          textStyle: styles.buttonTextActive,
          disabled: false,
        };
      case 'none':
      default:
        return {
          label: 'Add Friend',
          style: styles.buttonActive,
          textStyle: styles.buttonTextActive,
          disabled: false,
        };
    }
  };

  const buttonConfig = getButtonConfig();

  return (
    <View style={styles.card}>
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
      <View style={styles.userInfo}>
        <Text style={styles.displayName} numberOfLines={1}>
          {displayName || 'Unknown User'}
        </Text>
        <Text style={styles.username} numberOfLines={1}>
          @{username || 'unknown'}
        </Text>
        {bio && (
          <Text style={styles.bio} numberOfLines={2}>
            {bio}
          </Text>
        )}
      </View>

      {/* Action button */}
      <TouchableOpacity
        style={[buttonConfig.style, disabled && styles.buttonDisabled]}
        onPress={onAddFriend}
        disabled={buttonConfig.disabled || disabled}
        activeOpacity={0.7}
      >
        <Text style={buttonConfig.textStyle}>{buttonConfig.label}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  profilePicContainer: {
    marginRight: 12,
  },
  profilePic: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profilePicPlaceholder: {
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#666666',
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  bio: {
    fontSize: 12,
    color: '#999999',
    lineHeight: 16,
  },
  buttonActive: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonTextActive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonTextDisabled: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999999',
  },
  buttonPending: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  buttonTextPending: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9500',
  },
});

export default UserSearchCard;
