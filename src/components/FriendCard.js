import React from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { colors } from '../constants/colors';
import { styles } from '../styles/FriendCard.styles';

/**
 * FriendCard - Unified card component for all friend-related displays
 *
 * Handles all relationship states with a consistent card layout:
 * - Avatar (50x50) left | Name/username middle | Action button right
 *
 * Props:
 * - user: { userId, displayName, username, profilePhotoURL }
 * - relationshipStatus: 'none' | 'friends' | 'pending_sent' | 'pending_received'
 * - friendshipId: string (for request actions)
 * - onAction: callback for primary action (add friend, cancel request)
 * - onAccept: callback for accepting request (pending_received only)
 * - onDeny: callback for denying request (pending_received only)
 * - onPress: callback for card tap (navigate to profile)
 * - showFriendsSince: boolean (only in friends list)
 * - friendsSince: Date (if applicable)
 * - loading: boolean (action in progress)
 */
const FriendCard = ({
  user,
  relationshipStatus = 'none',
  friendshipId,
  onAction,
  onAccept,
  onDeny,
  onPress,
  showFriendsSince = false,
  friendsSince,
  loading = false,
}) => {
  const { userId, displayName, username, profilePhotoURL } = user || {};

  /**
   * Format friends since date
   */
  const formatFriendsSince = () => {
    if (!friendsSince) return '';

    // Handle Firestore Timestamp
    const date = friendsSince.toDate ? friendsSince.toDate() : new Date(friendsSince);

    return date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  };

  /**
   * Handle pending button press - show cancel confirmation
   */
  const handlePendingPress = () => {
    Alert.alert('Cancel Request', `Cancel friend request to ${displayName || username}?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Request',
        style: 'destructive',
        onPress: () => onAction && onAction(friendshipId, 'cancel'),
      },
    ]);
  };

  /**
   * Render action button(s) based on relationship status
   */
  const renderActions = () => {
    if (loading) {
      return (
        <View style={styles.addButton}>
          <ActivityIndicator size="small" color={colors.text.primary} />
        </View>
      );
    }

    switch (relationshipStatus) {
      case 'none':
        return (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => onAction && onAction(userId, 'add')}
            activeOpacity={0.7}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        );

      case 'pending_sent':
        return (
          <TouchableOpacity
            style={styles.pendingButton}
            onPress={handlePendingPress}
            activeOpacity={0.7}
          >
            <Text style={styles.pendingButtonText}>Pending</Text>
          </TouchableOpacity>
        );

      case 'pending_received':
        return (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => onAccept && onAccept(friendshipId)}
              activeOpacity={0.7}
            >
              <Text style={styles.acceptButtonText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.denyButton}
              onPress={() => onDeny && onDeny(friendshipId)}
              activeOpacity={0.7}
            >
              <Text style={styles.denyButtonText}>Deny</Text>
            </TouchableOpacity>
          </View>
        );

      case 'friends':
        // No action button for friends - long press to remove (handled at parent level)
        return null;

      default:
        return null;
    }
  };

  const CardWrapper = onPress ? TouchableOpacity : View;
  const cardProps = onPress
    ? { style: styles.card, onPress, activeOpacity: 0.7 }
    : { style: styles.card };

  return (
    <CardWrapper {...cardProps}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {profilePhotoURL ? (
          <Image source={{ uri: profilePhotoURL }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {displayName?.[0]?.toUpperCase() || username?.[0]?.toUpperCase() || '?'}
            </Text>
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
        {showFriendsSince && friendsSince && (
          <Text style={styles.friendsSince}>Friends since {formatFriendsSince()}</Text>
        )}
      </View>

      {/* Action buttons */}
      {renderActions()}
    </CardWrapper>
  );
};

export default FriendCard;
