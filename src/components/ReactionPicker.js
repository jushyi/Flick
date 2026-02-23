/**
 * ReactionPicker - iMessage-style long-press overlay
 *
 * Floating overlay with emoji reaction row above the message
 * and text action menu below. Dark semi-transparent backdrop,
 * tap anywhere outside to dismiss.
 *
 * Props:
 * - visible: boolean controlling modal visibility
 * - message: target message object
 * - position: { x, y, width, height } of the target message bubble
 * - isCurrentUser: boolean (determines Unsend/Delete actions)
 * - canUnsend: boolean (within 15-minute window)
 * - onReaction: callback (emoji key) when emoji tapped
 * - onReply: callback when Reply tapped
 * - onUnsend: callback when Unsend tapped
 * - onDeleteForMe: callback when Delete for me tapped
 * - onClose: callback to dismiss overlay
 */
import React, { useEffect } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, useWindowDimensions } from 'react-native';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

const REACTION_EMOJIS = [
  { key: 'heart', char: '\u2764\uFE0F' },
  { key: 'laugh', char: '\uD83D\uDE02' },
  { key: 'surprise', char: '\uD83D\uDE2E' },
  { key: 'sad', char: '\uD83D\uDE22' },
  { key: 'angry', char: '\uD83D\uDE21' },
  { key: 'thumbs_up', char: '\uD83D\uDC4D' },
];

const EMOJI_ROW_HEIGHT = 56;
const ACTION_ITEM_HEIGHT = 46;
const MENU_BORDER_RADIUS = 12;
const EMOJI_BORDER_RADIUS = 20;
const MENU_VERTICAL_GAP = 8;

const ReactionPicker = ({
  visible,
  message,
  position,
  isCurrentUser,
  canUnsend,
  onReaction,
  onReply,
  onUnsend,
  onDeleteForMe,
  onClose,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Animation values
  const backdropOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.8);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      contentScale.value = withSpring(1, { stiffness: 200, damping: 20 });
      contentOpacity.value = withTiming(1, { duration: 200 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      contentScale.value = withTiming(0.8, { duration: 200 });
      contentOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, backdropOpacity, contentScale, contentOpacity]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: contentScale.value }],
    opacity: contentOpacity.value,
  }));

  // Build action items
  const actions = [];
  actions.push({ label: 'Reply', onPress: onReply });
  if (isCurrentUser && canUnsend) {
    actions.push({ label: 'Unsend', onPress: onUnsend });
  }
  if (isCurrentUser) {
    actions.push({ label: 'Delete for me', onPress: onDeleteForMe });
  }

  const actionMenuHeight = actions.length * ACTION_ITEM_HEIGHT;

  // Determine positioning: is message in top or bottom half?
  const msgCenterY = position ? position.y + position.height / 2 : screenHeight / 2;
  const isTopHalf = msgCenterY < screenHeight / 2;

  // Calculate positions
  let emojiRowTop;
  let actionMenuTop;

  if (isTopHalf) {
    // Default: emoji above message, actions below
    emojiRowTop = Math.max(8, (position?.y ?? 0) - EMOJI_ROW_HEIGHT - MENU_VERTICAL_GAP);
    actionMenuTop = (position?.y ?? 0) + (position?.height ?? 0) + MENU_VERTICAL_GAP;
  } else {
    // Flipped: actions above message, emoji below
    actionMenuTop = Math.max(8, (position?.y ?? 0) - actionMenuHeight - MENU_VERTICAL_GAP);
    emojiRowTop = (position?.y ?? 0) + (position?.height ?? 0) + MENU_VERTICAL_GAP;
  }

  // Clamp to screen bounds
  emojiRowTop = Math.max(8, Math.min(emojiRowTop, screenHeight - EMOJI_ROW_HEIGHT - 8));
  actionMenuTop = Math.max(8, Math.min(actionMenuTop, screenHeight - actionMenuHeight - 8));

  // Horizontal positioning: center on message, clamped to screen
  const emojiRowWidth = REACTION_EMOJIS.length * 48 + 16;
  const msgCenterX = position ? position.x + position.width / 2 : screenWidth / 2;
  let emojiRowLeft = msgCenterX - emojiRowWidth / 2;
  emojiRowLeft = Math.max(8, Math.min(emojiRowLeft, screenWidth - emojiRowWidth - 8));

  const actionMenuWidth = 200;
  let actionMenuLeft = isCurrentUser
    ? position
      ? position.x + position.width - actionMenuWidth
      : screenWidth - actionMenuWidth - 16
    : (position?.x ?? 16);
  actionMenuLeft = Math.max(8, Math.min(actionMenuLeft, screenWidth - actionMenuWidth - 8));

  const handleEmojiPress = emojiKey => {
    onReaction?.(emojiKey);
    onClose?.();
  };

  const handleActionPress = actionOnPress => {
    actionOnPress?.();
    onClose?.();
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <View style={styles.modalContainer}>
        {/* Dark backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Emoji row */}
        <Animated.View
          style={[
            styles.emojiRow,
            contentAnimatedStyle,
            {
              top: emojiRowTop,
              left: emojiRowLeft,
            },
          ]}
        >
          {REACTION_EMOJIS.map(emoji => (
            <Pressable
              key={emoji.key}
              style={({ pressed }) => [styles.emojiButton, pressed && styles.emojiButtonPressed]}
              onPress={() => handleEmojiPress(emoji.key)}
            >
              <Text style={styles.emojiText}>{emoji.char}</Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* Scaled message preview (subtle lift effect) */}
        {position && (
          <Animated.View
            style={[
              contentAnimatedStyle,
              {
                position: 'absolute',
                top: position.y,
                left: position.x,
                width: position.width,
                height: position.height,
                transform: [{ scale: 1.05 }],
              },
            ]}
          />
        )}

        {/* Action menu */}
        <Animated.View
          style={[
            styles.actionMenu,
            contentAnimatedStyle,
            {
              top: actionMenuTop,
              left: actionMenuLeft,
              width: actionMenuWidth,
            },
          ]}
        >
          {actions.map((action, index) => (
            <React.Fragment key={action.label}>
              {index > 0 && <View style={styles.divider} />}
              <Pressable
                style={({ pressed }) => [styles.actionItem, pressed && styles.actionItemPressed]}
                onPress={() => handleActionPress(action.onPress)}
              >
                <Text style={styles.actionText}>{action.label}</Text>
              </Pressable>
            </React.Fragment>
          ))}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  emojiRow: {
    position: 'absolute',
    flexDirection: 'row',
    backgroundColor: 'rgba(20, 20, 40, 0.95)',
    borderRadius: EMOJI_BORDER_RADIUS,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  emojiButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  emojiButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  emojiText: {
    fontSize: 22,
  },
  actionMenu: {
    position: 'absolute',
    backgroundColor: 'rgba(20, 20, 40, 0.95)',
    borderRadius: MENU_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  actionItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionItemPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionText: {
    color: colors.text.primary,
    fontSize: 13,
    fontFamily: typography.fontFamily.body,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 0,
  },
});

export default ReactionPicker;
