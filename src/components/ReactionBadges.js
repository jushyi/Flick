import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated as RNAnimated } from 'react-native';

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

/**
 * ReactionBadges
 *
 * Renders emoji reaction pills below a message bubble.
 * Each pill shows the emoji character and an optional count (when > 1).
 * Pills that include the current user's reaction are highlighted.
 * Fades in on first appearance (300ms).
 *
 * @param {object} reactions - Reaction map: { emoji: [{ senderId, messageId }] }
 * @param {boolean} isCurrentUser - Whether the message is from the current user (for alignment)
 * @param {string} currentUserId - Current user's UID (to highlight own reactions)
 * @param {function} onReactionPress - Callback (emoji) when tapping a reaction pill
 */
const ReactionBadges = ({ reactions, isCurrentUser, currentUserId, onReactionPress }) => {
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  if (!reactions || Object.keys(reactions).length === 0) {
    return null;
  }

  const emojiKeys = Object.keys(reactions);

  return (
    <RNAnimated.View
      style={[
        styles.container,
        isCurrentUser ? styles.containerRight : styles.containerLeft,
        { opacity: fadeAnim },
      ]}
    >
      {emojiKeys.map(emoji => {
        const reactionList = reactions[emoji] || [];
        const count = reactionList.length;
        if (count === 0) return null;

        const hasOwnReaction = reactionList.some(r => r.senderId === currentUserId);
        const emojiChar = EMOJI_MAP[emoji] || emoji;

        return (
          <Pressable
            key={emoji}
            onPress={() => onReactionPress?.(emoji)}
            style={[styles.pill, hasOwnReaction && styles.pillHighlight]}
          >
            <Text style={styles.emojiText}>{emojiChar}</Text>
            {count > 1 && <Text style={styles.countText}>{count}</Text>}
          </Pressable>
        );
      })}
    </RNAnimated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: -10,
    zIndex: 1,
  },
  containerRight: {
    alignSelf: 'flex-end',
    marginRight: 8,
  },
  containerLeft: {
    alignSelf: 'flex-start',
    marginLeft: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pillHighlight: {
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  emojiText: {
    fontSize: 12,
  },
  countText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
    marginLeft: 2,
  },
});

export default ReactionBadges;
