import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { format } from 'date-fns';

import ReactionBadges from './ReactionBadges';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

const REPLY_THRESHOLD = 40;
const MAX_SWIPE = 80;

const MessageBubble = ({
  message,
  isCurrentUser,
  showTimestamp,
  onPress,
  reactions,
  onDoubleTap,
  onLongPress,
  onSwipeReply,
  onReactionPress,
  replyTo,
  currentUserId,
  senderName,
  onScrollToMessage,
}) => {
  const isGif = message.type === 'gif';
  const isImage = message.type === 'image';
  const isDeleted = message._isUnsent || message._isDeletedForMe;

  const translateX = useSharedValue(0);
  const hasTriggeredHaptic = useSharedValue(false);
  const bubbleRef = useRef(null);

  const formatTimestamp = () => {
    if (!message.createdAt) return '';
    const date = message.createdAt.toDate
      ? message.createdAt.toDate()
      : new Date(message.createdAt);
    return format(date, 'h:mm a');
  };

  const handleDoubleTap = () => {
    if (onDoubleTap) {
      onDoubleTap(message);
    }
  };

  const handleLongPress = () => {
    if (onLongPress && bubbleRef.current) {
      bubbleRef.current.measureInWindow((x, y, width, height) => {
        onLongPress(message, { x, y, width, height });
      });
    }
  };

  const handleSingleTap = () => {
    if (onPress) {
      onPress();
    }
  };

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleSwipeReply = () => {
    if (onSwipeReply) {
      onSwipeReply(message);
    }
  };

  // Gesture composition
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(handleDoubleTap)();
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onStart(() => {
      runOnJS(handleLongPress)();
    });

  const singleTapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd(() => {
      runOnJS(handleSingleTap)();
    });

  const swipeGesture = Gesture.Pan()
    .activeOffsetX(20)
    .failOffsetY([-15, 15])
    .onUpdate(event => {
      'worklet';
      translateX.value = Math.max(0, Math.min(event.translationX, MAX_SWIPE));
      if (translateX.value >= REPLY_THRESHOLD && !hasTriggeredHaptic.value) {
        hasTriggeredHaptic.value = true;
        runOnJS(triggerHaptic)();
      }
    })
    .onEnd(event => {
      'worklet';
      if (event.translationX >= REPLY_THRESHOLD) {
        runOnJS(handleSwipeReply)();
      }
      translateX.value = withTiming(0, { duration: 200 });
      hasTriggeredHaptic.value = false;
    });

  // For deleted/unsent messages, use simplified gesture (single-tap only for timestamp)
  const deletedGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd(() => {
      runOnJS(handleSingleTap)();
    });

  const composed = isDeleted
    ? deletedGesture
    : Gesture.Race(
        swipeGesture,
        Gesture.Exclusive(doubleTapGesture, singleTapGesture),
        longPressGesture
      );

  const messageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const replyIconAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, REPLY_THRESHOLD], [0, 1]),
  }));

  // Render deleted/unsent state
  if (isDeleted) {
    const deletedText = message._isUnsent ? 'This message was deleted' : 'You deleted this message';

    return (
      <View
        style={[styles.container, isCurrentUser ? styles.containerRight : styles.containerLeft]}
      >
        <GestureDetector gesture={composed}>
          <View style={styles.deletedContainer}>
            <Text style={styles.deletedMessageText}>{deletedText}</Text>
          </View>
        </GestureDetector>

        {showTimestamp && (
          <Text
            style={[styles.timestamp, isCurrentUser ? styles.timestampRight : styles.timestampLeft]}
          >
            {formatTimestamp()}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, isCurrentUser ? styles.containerRight : styles.containerLeft]}>
      <View style={styles.swipeContainer}>
        <Animated.View style={[styles.replyArrowContainer, replyIconAnimatedStyle]}>
          <Ionicons name="return-up-back" size={20} color={colors.text.secondary} />
        </Animated.View>

        <GestureDetector gesture={composed}>
          <Animated.View style={messageAnimatedStyle}>
            <View
              ref={bubbleRef}
              style={[
                styles.bubble,
                isCurrentUser ? styles.bubbleUser : styles.bubbleFriend,
                (isGif || isImage) && styles.bubbleMedia,
              ]}
            >
              {message.replyTo && (
                <Pressable
                  onPress={() => onScrollToMessage?.(message.replyTo.messageId)}
                  style={[
                    styles.replyPreviewInBubble,
                    isCurrentUser
                      ? styles.replyPreviewInBubbleUser
                      : styles.replyPreviewInBubbleFriend,
                  ]}
                >
                  {message.replyTo.deleted ? (
                    <Text style={styles.replyDeletedText}>Original message deleted</Text>
                  ) : (
                    <>
                      <Text style={styles.replyAuthorText} numberOfLines={1}>
                        {message.replyTo.senderId === currentUserId
                          ? 'You'
                          : senderName || 'Friend'}
                      </Text>
                      <Text style={styles.replyContentText} numberOfLines={2}>
                        {message.replyTo.type === 'image'
                          ? '\uD83D\uDCF7 Photo'
                          : message.replyTo.type === 'gif'
                            ? 'GIF'
                            : message.replyTo.text || ''}
                      </Text>
                    </>
                  )}
                </Pressable>
              )}

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
            </View>
          </Animated.View>
        </GestureDetector>
      </View>

      {reactions && Object.keys(reactions).length > 0 && (
        <ReactionBadges
          reactions={reactions}
          isCurrentUser={isCurrentUser}
          currentUserId={currentUserId}
          onReactionPress={onReactionPress}
        />
      )}

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
  swipeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
  },
  replyArrowContainer: {
    position: 'absolute',
    left: -30,
    justifyContent: 'center',
    alignItems: 'center',
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
  bubbleMedia: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
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
    height: 250,
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
  // Deleted/unsent message styles
  deletedContainer: {
    maxWidth: '75%',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  deletedMessageText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.readable,
    fontStyle: 'italic',
    color: '#7B7B9E',
  },
  // Reply mini bubble styles
  replyPreviewInBubble: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 4,
    borderRadius: 6,
    borderLeftWidth: 2,
  },
  replyPreviewInBubbleUser: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
  },
  replyPreviewInBubbleFriend: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderLeftColor: colors.interactive.primary,
  },
  replyAuthorText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bodyBold,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 1,
  },
  replyContentText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.readable,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  replyDeletedText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.readable,
    fontStyle: 'italic',
    color: '#7B7B9E',
  },
});

export default MessageBubble;
