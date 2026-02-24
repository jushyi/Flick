import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, Animated as RNAnimated, StyleSheet } from 'react-native';
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
  highlighted,
  findMessageById,
}) => {
  const isGif = message.type === 'gif';
  const isImage = message.type === 'image';
  const isDeleted = message._isUnsent || message._isDeletedForMe;

  const translateX = useSharedValue(0);
  const hasTriggeredHaptic = useSharedValue(false);
  const bubbleRef = useRef(null);

  // Highlight flash animation when scroll-to-message targets this bubble
  const highlightOpacity = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    if (highlighted) {
      highlightOpacity.setValue(0.4);
      RNAnimated.timing(highlightOpacity, {
        toValue: 0,
        duration: 1500,
        useNativeDriver: true,
      }).start();
    }
  }, [highlighted, highlightOpacity]);

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

  // Resolve the full original message for replies (needed for image/gif URLs)
  const resolvedOriginal =
    message.replyTo && !message.replyTo.deleted && findMessageById
      ? findMessageById(message.replyTo.messageId)
      : null;

  // Determine the original message content for reply rendering
  const originalType = message.replyTo?.type;
  const originalImageUrl = resolvedOriginal?.imageUrl || resolvedOriginal?.gifUrl || null;
  const originalText = message.replyTo?.text || resolvedOriginal?.text || '';

  /**
   * Renders the muted original message block above the reply bubble.
   * Shows full text, images, or GIFs at reduced opacity.
   */
  const renderOriginalMessage = () => {
    if (!message.replyTo) return null;

    const replyAuthor = message.replyTo.senderId === currentUserId ? 'You' : senderName || 'Friend';

    return (
      <Pressable
        onPress={() => onScrollToMessage?.(message.replyTo.messageId)}
        style={[
          styles.originalMessageBlock,
          isCurrentUser ? styles.originalMessageBlockRight : styles.originalMessageBlockLeft,
        ]}
      >
        {/* Connecting line on the left edge */}
        <View
          style={[
            styles.originalConnectingLine,
            isCurrentUser ? styles.connectingLineRight : styles.connectingLineLeft,
          ]}
        />

        <View style={styles.originalMessageContent}>
          {message.replyTo.deleted ? (
            <Text style={styles.originalDeletedText}>Original message deleted</Text>
          ) : (
            <>
              <Text style={styles.originalAuthorText}>{replyAuthor}</Text>

              {(originalType === 'image' || originalType === 'gif') && originalImageUrl ? (
                <View style={styles.originalMediaContainer}>
                  <Image
                    source={{ uri: originalImageUrl }}
                    style={originalType === 'image' ? styles.originalImage : styles.originalGif}
                    contentFit={originalType === 'image' ? 'cover' : 'contain'}
                    transition={200}
                  />
                </View>
              ) : (originalType === 'image' || originalType === 'gif') && !originalImageUrl ? (
                <Text style={styles.originalContentText}>
                  {originalType === 'image' ? '\uD83D\uDCF7 Photo' : 'GIF'}
                </Text>
              ) : (
                <Text style={styles.originalContentText}>{originalText}</Text>
              )}
            </>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, isCurrentUser ? styles.containerRight : styles.containerLeft]}>
      {/* Highlight flash overlay for scroll-to-message */}
      {highlighted && (
        <RNAnimated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.highlightOverlay, { opacity: highlightOpacity }]}
        />
      )}

      {/* Muted original message rendered above the reply bubble */}
      {renderOriginalMessage()}

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
  // Highlight overlay for scroll-to-message flash
  highlightOverlay: {
    backgroundColor: 'rgba(0, 212, 255, 0.25)',
    borderRadius: 4,
    zIndex: 10,
  },
  // Muted original message block (shown above reply bubble)
  originalMessageBlock: {
    maxWidth: '75%',
    marginBottom: 2,
    flexDirection: 'row',
    opacity: 0.55,
  },
  originalMessageBlockRight: {
    alignSelf: 'flex-end',
  },
  originalMessageBlockLeft: {
    alignSelf: 'flex-start',
  },
  originalConnectingLine: {
    width: 2,
    backgroundColor: '#7B7B9E',
    borderRadius: 1,
    marginRight: 8,
  },
  connectingLineRight: {
    // Line on the left side even for current user's replies
  },
  connectingLineLeft: {
    // Line on the left side for friend's replies
  },
  originalMessageContent: {
    flex: 1,
  },
  originalAuthorText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bodyBold,
    color: '#7B7B9E',
    marginBottom: 2,
  },
  originalContentText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.readable,
    color: '#7B7B9E',
    lineHeight: 18,
  },
  originalDeletedText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.readable,
    fontStyle: 'italic',
    color: '#7B7B9E',
  },
  originalMediaContainer: {
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 2,
  },
  originalImage: {
    width: 180,
    height: 220,
    borderRadius: 3,
  },
  originalGif: {
    width: 180,
    height: 135,
    borderRadius: 3,
  },
});

export default MessageBubble;
