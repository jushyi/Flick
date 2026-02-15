import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'expo-image';
import PixelIcon from './PixelIcon';
import StrokedNameText from './StrokedNameText';
import PixelSpinner from './PixelSpinner';
import { colors } from '../constants/colors';
import { styles } from '../styles/FriendCard.styles';
import DropdownMenu from './DropdownMenu';

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
  onRemove,
  onBlock,
  onUnblock,
  onReport,
  onDismiss, // Optional: renders X button next to Add for suggestions
  isBlocked = false, // Whether current user has blocked this user
  subtitle, // Optional: subtitle text below username (e.g., "3 mutual friends")
}) => {
  const { userId, displayName, username, profilePhotoURL } = user || {};

  // Menu state
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const menuButtonRef = useRef(null);

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
   * Handle menu button press - capture position and show menu
   */
  const handleMenuPress = () => {
    menuButtonRef.current?.measureInWindow((x, y, width, height) => {
      setMenuAnchor({ x, y, width, height });
      setMenuVisible(true);
    });
  };

  /**
   * Handle remove friend action with confirmation
   */
  const handleRemoveFriend = () => {
    Alert.alert('Remove Friend', `Remove ${displayName || username} from your friends?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => onRemove && onRemove(userId),
      },
    ]);
  };

  /**
   * Handle block user action with confirmation
   */
  const handleBlockUser = () => {
    Alert.alert(
      'Block User',
      `Block ${displayName || username}? They won't be able to see your profile or contact you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => onBlock && onBlock(userId),
        },
      ]
    );
  };

  /**
   * Handle unblock user action with confirmation
   */
  const handleUnblockUser = () => {
    onUnblock && onUnblock(userId);
  };

  /**
   * Handle report user action - navigates directly (no confirmation needed)
   */
  const handleReportUser = () => {
    onReport && onReport(userId);
  };

  /**
   * Render the 3-dot menu button (shared across statuses)
   */
  const renderMenuButton = () => {
    // Only show menu if we have block or report handlers
    if (!onBlock && !onUnblock && !onReport) return null;

    return (
      <TouchableOpacity
        ref={menuButtonRef}
        style={styles.menuButton}
        onPress={handleMenuPress}
        activeOpacity={0.7}
      >
        <PixelIcon name="ellipsis-vertical" size={20} color={colors.text.secondary} />
      </TouchableOpacity>
    );
  };

  /**
   * Render action button(s) based on relationship status
   */
  const renderActions = () => {
    if (loading) {
      return (
        <View style={styles.addButton}>
          <PixelSpinner size="small" color={colors.text.primary} />
        </View>
      );
    }

    switch (relationshipStatus) {
      case 'none':
        return (
          <View style={styles.actionsContainer}>
            {onAction && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => onAction(userId, 'add')}
                activeOpacity={0.7}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            )}
            {onDismiss && (
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={() => onDismiss(userId)}
                activeOpacity={0.7}
              >
                <PixelIcon name="close" size={18} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}
            {renderMenuButton()}
          </View>
        );

      case 'pending_sent':
        return (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.pendingButton}
              onPress={handlePendingPress}
              activeOpacity={0.7}
            >
              <Text style={styles.pendingButtonText}>Pending</Text>
            </TouchableOpacity>
            {renderMenuButton()}
          </View>
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
            {renderMenuButton()}
          </View>
        );

      case 'friends':
        // Three-dot menu only for friend management actions
        return (
          <TouchableOpacity
            ref={menuButtonRef}
            style={styles.menuButton}
            onPress={handleMenuPress}
            activeOpacity={0.7}
          >
            <PixelIcon name="ellipsis-vertical" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        );

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
          <Image
            source={{ uri: profilePhotoURL, cacheKey: `profile-${userId}` }}
            style={styles.avatar}
            cachePolicy="memory-disk"
            transition={0}
          />
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
        <StrokedNameText style={styles.displayName} nameColor={user?.nameColor} numberOfLines={1}>
          {displayName || 'Unknown User'}
        </StrokedNameText>
        <Text style={styles.username} numberOfLines={1}>
          @{username || 'unknown'}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
        {showFriendsSince && friendsSince && (
          <Text style={styles.friendsSince}>Friends since {formatFriendsSince()}</Text>
        )}
      </View>

      {/* Action buttons */}
      {renderActions()}

      {/* Friend management menu */}
      <DropdownMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        anchorPosition={menuAnchor}
        options={[
          // Only show Remove Friend option for actual friends
          ...(relationshipStatus === 'friends' && onRemove
            ? [
                {
                  label: 'Remove Friend',
                  icon: 'person-remove-outline',
                  onPress: handleRemoveFriend,
                },
              ]
            : []),
          // Block/Unblock option
          ...(onBlock || onUnblock
            ? [
                isBlocked
                  ? { label: 'Unblock User', icon: 'ban-outline', onPress: handleUnblockUser }
                  : { label: 'Block User', icon: 'ban-outline', onPress: handleBlockUser },
              ]
            : []),
          // Report option
          ...(onReport
            ? [
                {
                  label: 'Report User',
                  icon: 'flag-outline',
                  onPress: handleReportUser,
                  destructive: true,
                },
              ]
            : []),
        ]}
      />
    </CardWrapper>
  );
};

export default React.memo(FriendCard);
