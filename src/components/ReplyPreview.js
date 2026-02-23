/**
 * ReplyPreview - Compact reply context bar
 *
 * Rendered above DMInput when replying to a message.
 * Shows sender name, truncated message preview, and cancel button.
 * Slides up on appear, swipe down or tap X to dismiss.
 *
 * Props:
 * - message: the message object being replied to
 * - senderName: display name of message sender (or "You" if current user)
 * - onCancel: callback to clear reply mode
 */
import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import PixelIcon from './PixelIcon';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

const PREVIEW_HEIGHT = 44;
const SWIPE_DISMISS_THRESHOLD = 30;

const ReplyPreview = ({ message, senderName, onCancel }) => {
  const translateY = useSharedValue(PREVIEW_HEIGHT);

  useEffect(() => {
    translateY.value = withTiming(0, { duration: 200 });
  }, [translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Swipe down to dismiss
  const panGesture = Gesture.Pan().onEnd(event => {
    'worklet';
    if (event.translationY > SWIPE_DISMISS_THRESHOLD) {
      translateY.value = withTiming(PREVIEW_HEIGHT, { duration: 150 });
      if (onCancel) {
        runOnJS(onCancel)();
      }
    } else {
      translateY.value = withTiming(0, { duration: 150 });
    }
  });

  // Determine preview text based on message type
  const getPreviewText = () => {
    if (!message) return '';
    if (message.type === 'image') return '\uD83D\uDCF7 Photo';
    if (message.type === 'gif') return 'GIF';
    return message.text || '';
  };

  if (!message) return null;

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <View style={styles.content}>
          <View style={styles.accentBar} />
          <View style={styles.textContainer}>
            <Text style={styles.replyToLabel}>Replying to {senderName}</Text>
            <Text style={styles.previewText} numberOfLines={1}>
              {getPreviewText()}
            </Text>
          </View>
          <Pressable onPress={onCancel} hitSlop={8} style={styles.cancelButton}>
            <PixelIcon name="close-circle" size={18} color={colors.text.secondary} />
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: colors.background.primary,
    height: PREVIEW_HEIGHT,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  accentBar: {
    width: 3,
    height: '100%',
    backgroundColor: colors.interactive.primary,
    borderRadius: 2,
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  replyToLabel: {
    fontFamily: typography.fontFamily.body,
    fontSize: 10,
    color: colors.interactive.primary,
    marginBottom: 2,
  },
  previewText: {
    fontFamily: typography.fontFamily.readable,
    fontSize: 12,
    color: colors.text.secondary,
  },
  cancelButton: {
    paddingLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ReplyPreview;
