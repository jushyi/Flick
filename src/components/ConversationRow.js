import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

import { isYesterday, format } from 'date-fns';

import PixelIcon from './PixelIcon';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

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

const ConversationRow = ({ conversation, friendProfile, currentUserId, onPress, onLongPress }) => {
  const { lastMessage, updatedAt, unreadCount } = conversation;
  const { photoURL, displayName } = friendProfile;
  const hasUnread = unreadCount?.[currentUserId] > 0;

  const getPreviewText = () => {
    if (!lastMessage) return 'No messages yet';
    if (lastMessage.type === 'gif') return 'Sent a GIF';
    return lastMessage.text || 'No messages yet';
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
        <Text style={styles.timestamp}>{formatMessageTime(updatedAt)}</Text>
        {hasUnread && <View style={styles.unreadDot} />}
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
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.interactive.primary,
    marginTop: 4,
  },
});

export default ConversationRow;
