import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

import { isYesterday, format } from 'date-fns';

import PixelIcon from './PixelIcon';

import { useAuth } from '../context/AuthContext';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

const EMOJI_MAP = {
  heart: '\u2764\uFE0F',
  laugh: '\uD83D\uDE02',
  surprise: '\uD83D\uDE2E',
  sad: '\uD83D\uDE22',
  angry: '\uD83D\uDE21',
  thumbs_up: '\uD83D\uDC4D',
};

const formatMessageTime = timestamp => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  if (isYesterday(date)) return 'Yesterday';
  if (now - date < 7 * 24 * 60 * 60 * 1000) return format(date, 'EEE');
  return format(date, 'MMM d');
};

/**
 * UnreadBadge — Cyan circle with white count number.
 * Shows "99+" for counts above 99.
 */
const SNAP_AMBER = '#F5A623';

/**
 * UnreadBadge — Circle with white count number.
 * Default cyan for regular messages, amber for snap messages.
 * Shows "99+" for counts above 99.
 */
const UnreadBadge = ({ count, isSnap = false }) => {
  if (!count || count <= 0) return null;
  const displayText = count > 99 ? '99+' : String(count);
  return (
    <View style={[styles.unreadBadge, isSnap && styles.unreadBadgeSnap]}>
      <Text style={styles.unreadBadgeText}>{displayText}</Text>
    </View>
  );
};

const ConversationRow = ({
  conversation,
  friendProfile,
  currentUserId,
  onPress,
  onLongPress,
  onSnapCamera,
}) => {
  const { userProfile: currentUserProfile } = useAuth();
  const { lastMessage, updatedAt, unreadCount, readReceipts } = conversation;
  const { displayName } = friendProfile;
  const photoURL = friendProfile.profilePhotoURL || friendProfile.photoURL;

  // unreadCount comes as a number from useMessages (already extracted for current user)
  const hasUnread = unreadCount > 0;

  // Detect snap-type last message for amber unread badge styling
  const isSnapLastMessage = lastMessage?.type === 'snap' && lastMessage?.senderId !== currentUserId;

  // Derive friend ID from participants
  const friendId = conversation.participants?.find(p => p !== currentUserId);

  // Privacy gate: both users must have readReceiptsEnabled for read status to show
  const showReadStatus =
    currentUserProfile?.readReceiptsEnabled !== false &&
    friendProfile?.readReceiptsEnabled !== false;

  // Check if friend has read the last message
  const friendReadReceipt = friendId ? readReceipts?.[friendId] : null;
  const isFriendRead =
    showReadStatus &&
    !!friendReadReceipt &&
    !!lastMessage?.timestamp &&
    friendReadReceipt.toMillis?.() >= lastMessage.timestamp.toMillis?.();

  const getPreviewText = () => {
    if (!lastMessage) return 'No messages yet';

    const isSender = lastMessage.senderId === currentUserId;

    // Handle unsent messages (race condition: lastMessage still references unsent message)
    if (lastMessage.unsent) {
      return isSender ? 'You unsent a message' : 'Message deleted';
    }

    // Defensive: reaction messages should never be lastMessage (Cloud Function skips them),
    // but handle gracefully if race condition surfaces
    if (lastMessage.type === 'reaction') {
      const emojiChar = lastMessage.emoji ? EMOJI_MAP[lastMessage.emoji] || lastMessage.emoji : '';
      return isSender
        ? emojiChar
          ? `You reacted ${emojiChar}`
          : 'You reacted'
        : emojiChar
          ? `Reacted ${emojiChar}`
          : 'Reacted';
    }

    const msgType = lastMessage.type || 'text';

    // Current user sent the last message — show status words
    if (isSender) {
      switch (msgType) {
        case 'text':
        case 'gif':
        case 'image':
          return isFriendRead ? 'Seen' : 'Sent';
        case 'snap':
          return isFriendRead ? 'Opened' : 'Delivered';
        case 'tagged_photo':
          return isFriendRead ? 'Seen' : 'Sent';
        default:
          return 'Sent';
      }
    }

    // Friend sent the last message — show descriptive text
    switch (msgType) {
      case 'text':
        return lastMessage.text || 'No messages yet';
      case 'gif':
        return 'Sent a GIF';
      case 'image':
        return 'Sent a photo';
      case 'snap':
        return 'Sent you a snap';
      case 'tagged_photo':
        return 'Tagged you in a photo';
      default:
        return lastMessage.text || 'No messages yet';
    }
  };

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {photoURL ? (
        <Image
          source={{ uri: photoURL }}
          style={styles.avatar}
          cachePolicy="memory-disk"
          transition={0}
        />
      ) : (
        <View style={styles.avatarFallback}>
          <PixelIcon name="tab-profile" size={24} color={colors.icon.secondary} />
        </View>
      )}

      <View style={styles.textBlock}>
        <Text style={[styles.displayName, hasUnread && styles.displayNameUnread]} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={styles.preview} numberOfLines={1}>
          {getPreviewText()}
        </Text>
      </View>

      <View style={styles.rightColumn}>
        <View style={styles.rightTopRow}>
          <Text style={styles.timestamp}>{formatMessageTime(updatedAt)}</Text>
          {onSnapCamera && (
            <TouchableOpacity
              style={styles.snapCameraButton}
              onPress={() => onSnapCamera(conversation.id, friendId, displayName)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <PixelIcon name="snap-polaroid" size={18} color={SNAP_AMBER} />
            </TouchableOpacity>
          )}
        </View>
        <UnreadBadge count={unreadCount} isSnap={isSnapLastMessage && hasUnread} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  displayName: {
    fontSize: 13,
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bodyBold,
  },
  displayNameUnread: {
    color: colors.text.primary,
  },
  preview: {
    fontSize: 12,
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.readable,
    marginTop: 2,
  },
  rightColumn: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  timestamp: {
    fontSize: 10,
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.readable,
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.interactive.primary,
    paddingHorizontal: 4,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeSnap: {
    backgroundColor: SNAP_AMBER,
  },
  unreadBadgeText: {
    fontSize: 10,
    color: colors.text.inverse,
    fontFamily: typography.fontFamily.readableBold,
    textAlign: 'center',
  },
  rightTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  snapCameraButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ConversationRow;
