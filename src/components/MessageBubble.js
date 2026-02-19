import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

import { format } from 'date-fns';

import { colors } from '../constants/colors';

const MessageBubble = ({ message, isCurrentUser, showTimestamp, onPress }) => {
  const isGif = message.type === 'gif';

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
          isGif && styles.bubbleGif,
        ]}
      >
        {isGif ? (
          <Image
            source={{ uri: message.gifUrl }}
            style={styles.gifImage}
            contentFit="contain"
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
    borderRadius: 16,
  },
  bubbleUser: {
    backgroundColor: colors.interactive.primary,
    borderBottomRightRadius: 4,
  },
  bubbleFriend: {
    backgroundColor: colors.background.tertiary,
    borderBottomLeftRadius: 4,
  },
  bubbleGif: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  text: {
    fontSize: 15,
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
    borderRadius: 12,
  },
  timestamp: {
    fontSize: 11,
    color: colors.text.secondary,
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
