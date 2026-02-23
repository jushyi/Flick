import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

import { format } from 'date-fns';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

const MessageBubble = ({ message, isCurrentUser, showTimestamp, onPress }) => {
  const isGif = message.type === 'gif';
  const isImage = message.type === 'image';

  const formatTimestamp = () => {
    if (!message.createdAt) return '';
    const date = message.createdAt.toDate
      ? message.createdAt.toDate()
      : new Date(message.createdAt);
    return format(date, 'h:mm a');
  };

  return (
    <View style={[styles.container, isCurrentUser ? styles.containerRight : styles.containerLeft]}>
      <Pressable
        onPress={onPress}
        style={[
          styles.bubble,
          isCurrentUser ? styles.bubbleUser : styles.bubbleFriend,
          (isGif || isImage) && styles.bubbleGif,
        ]}
      >
        {isGif || isImage ? (
          <Image
            source={{ uri: message.gifUrl || message.imageUrl }}
            style={isImage ? styles.messageImage : styles.gifImage}
            contentFit={isImage ? 'cover' : 'contain'}
            transition={200}
          />
        ) : (
          <Text style={[styles.text, isCurrentUser ? styles.textUser : styles.textFriend]}>
            {message.text}
          </Text>
        )}
      </Pressable>

      {showTimestamp && (
        <Text
          style={[styles.timestamp, isCurrentUser ? styles.timestampRight : styles.timestampLeft]}
        >
          {formatTimestamp()}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 2,
    paddingHorizontal: 16,
  },
  containerRight: {
    alignItems: 'flex-end',
  },
  containerLeft: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 4,
  },
  bubbleUser: {
    backgroundColor: colors.interactive.primary,
    borderBottomRightRadius: 1,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
  },
  bubbleFriend: {
    backgroundColor: colors.background.tertiary,
    borderBottomLeftRadius: 1,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  bubbleGif: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  text: {
    fontSize: 14,
    fontFamily: typography.fontFamily.readable,
  },
  textUser: {
    color: colors.text.inverse,
  },
  textFriend: {
    color: colors.text.primary,
  },
  gifImage: {
    width: 200,
    height: 150,
    borderRadius: 3,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 3,
  },
  timestamp: {
    fontSize: 10,
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.body,
    marginTop: 4,
  },
  timestampRight: {
    textAlign: 'right',
  },
  timestampLeft: {
    textAlign: 'left',
  },
});

export default MessageBubble;
