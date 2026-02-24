import React, { useRef, useEffect } from 'react';
import { View, Text, Animated as RNAnimated, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import {
  Gesture,
  GestureDetector,
  TouchableOpacity as GHTouchableOpacity,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { format } from 'date-fns';

import PixelIcon from './PixelIcon';
import ReactionBadges from './ReactionBadges';
import SnapBubble from './SnapBubble';

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
  const isSnap = message.type === 'snap';
  const isGif = message.type === 'gif';
  const isImage = message.type === 'image';
  const isMediaMessage = isGif || isImage;
  const isDeleted = message._isUnsent || message._isDeletedForMe;

  const translateX = useSharedValue(0);
  const hasTriggeredHaptic = useSharedValue(false);
  const bubbleRef = useRef(null);

  // Highlight flash animation when scroll-to-message targets this bubble
  // Two-phase: flash in (150ms) -> hold (300ms) -> fade out (1200ms)
  const highlightOpacity = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    if (highlighted) {
      highlightOpacity.setValue(0);
      RNAnimated.sequence([
        RNAnimated.timing(highlightOpacity, {
          toValue: 0.5,
          duration: 150,
          useNativeDriver: true,
        }),
        RNAnimated.delay(300),
        RNAnimated.timing(highlightOpacity, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]).start();
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

  // Delegate snap messages to dedicated SnapBubble component
  // Placed after all hooks to satisfy Rules of Hooks
  if (isSnap) {
    return (
      <SnapBubble
        message={message}
        isCurrentUser={isCurrentUser}
        showTimestamp={showTimestamp}
        onPress={onPress}
        isPending={message._isPending}
        hasError={message._hasError}
        onRetry={message._onRetry}
        reactions={reactions}
        onReactionPress={onReactionPress}
        currentUserId={currentUserId}
      />
    );
  }

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
   * Layout mirrors for sent messages (line on right, text right-aligned).
   */
  const renderOriginalMessage = () => {
    if (!message.replyTo) return null;

    const replyAuthor = message.replyTo.senderId === currentUserId ? 'You' : senderName || 'Friend';

    const contentBlock = (
      <View style={styles.originalMessageContent}>
        {message.replyTo.deleted ? (
          <Text style={[styles.originalDeletedText, isCurrentUser && styles.originalTextRight]}>
            Original message deleted
          </Text>
        ) : (
          <>
            <Text style={[styles.originalAuthorText, isCurrentUser && styles.originalTextRight]}>
              {replyAuthor}
            </Text>

            {(originalType === 'image' || originalType === 'gif') && originalImageUrl ? (
              <View
                style={[styles.originalMediaContainer, isCurrentUser && styles.originalMediaRight]}
              >
                <Image
                  source={{ uri: originalImageUrl }}
                  style={originalType === 'image' ? styles.originalImage : styles.originalGif}
                  contentFit={originalType === 'image' ? 'cover' : 'contain'}
                  cachePolicy="memory-disk"
                  transition={200}
                />
              </View>
            ) : (originalType === 'image' || originalType === 'gif') && !originalImageUrl ? (
              <Text style={[styles.originalContentText, isCurrentUser && styles.originalTextRight]}>
                {originalType === 'image' ? 'Photo' : 'GIF'}
              </Text>
            ) : (
              <Text style={[styles.originalContentText, isCurrentUser && styles.originalTextRight]}>
                {originalText}
              </Text>
            )}
          </>
        )}
      </View>
    );

    return (
      <GHTouchableOpacity
        activeOpacity={0.5}
        onPress={() => onScrollToMessage?.(message.replyTo.messageId)}
        style={[
          styles.originalMessageBlock,
          isCurrentUser ? styles.originalMessageBlockRight : styles.originalMessageBlockLeft,
        ]}
      >
        {contentBlock}
      </GHTouchableOpacity>
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

      {/* Message bubble with gesture support — bubbleRow is constrained by
          the container's alignItems (flex-end / flex-start), so it hugs the
          correct side without needing a full-width swipeContainer. */}
      <View style={styles.bubbleRow}>
        <Animated.View style={[styles.replyArrowContainer, replyIconAnimatedStyle]}>
          <PixelIcon name="arrow-undo" size={20} color={colors.text.secondary} />
        </Animated.View>

        <GestureDetector gesture={composed}>
          <Animated.View style={messageAnimatedStyle}>
            <View
              ref={bubbleRef}
              style={[
                styles.bubble,
                isCurrentUser ? styles.bubbleUser : styles.bubbleFriend,
                isMediaMessage && styles.bubbleMedia,
                reactions &&
                  Object.keys(reactions).length > 0 &&
                  !isMediaMessage &&
                  styles.bubbleWithReactions,
              ]}
            >
              {isMediaMessage ? (
                <Image
                  source={{ uri: message.gifUrl || message.imageUrl }}
                  style={isImage ? styles.messageImage : styles.gifImage}
                  contentFit={isImage ? 'cover' : 'contain'}
                  cachePolicy="memory-disk"
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
          isMediaMessage={isMediaMessage}
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
  },
  containerRight: {
    alignItems: 'flex-end',
  },
  containerLeft: {
    alignItems: 'flex-start',
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '75%',
  },
  replyArrowContainer: {
    position: 'absolute',
    left: -28,
    top: '50%',
    marginTop: -10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubble: {
    minWidth: 32,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 4,
  },
  bubbleWithReactions: {
    paddingBottom: 14,
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
    color: colors.text.secondary,
  },
  // Highlight overlay for scroll-to-message flash — cyan tint matches interactive.primary accent
  highlightOverlay: {
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
    borderRadius: 4,
    zIndex: 10,
  },
  // Muted original message block (shown above reply bubble) — retro "quoted text" panel
  originalMessageBlock: {
    maxWidth: '60%',
    marginBottom: 2,
    opacity: 0.6,
    borderLeftWidth: 2,
    borderLeftColor: colors.text.secondary,
    paddingLeft: 6,
    paddingVertical: 2,
  },
  originalMessageBlockRight: {
    alignSelf: 'flex-end',
    borderLeftWidth: 0,
    borderRightWidth: 2,
    borderRightColor: colors.text.secondary,
    paddingLeft: 0,
    paddingRight: 6,
  },
  originalMessageBlockLeft: {
    alignSelf: 'flex-start',
  },
  originalMessageContent: {},
  originalAuthorText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  originalContentText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  originalDeletedText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.readable,
    fontStyle: 'italic',
    color: colors.text.secondary,
  },
  originalTextRight: {
    textAlign: 'right',
  },
  originalMediaContainer: {
    borderRadius: 3,
    marginTop: 2,
  },
  originalMediaRight: {
    alignItems: 'flex-end',
  },
  originalImage: {
    width: 120,
    height: 150,
    borderRadius: 3,
  },
  originalGif: {
    width: 120,
    height: 90,
    borderRadius: 3,
  },
});

export default MessageBubble;
