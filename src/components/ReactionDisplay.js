import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';

/**
 * ReactionDisplay - Detailed reaction list with user info
 *
 * Shows all reactions grouped by emoji with counts
 * Used in PhotoDetailModal or expanded view
 *
 * @param {object} reactions - Reactions map { userId: emoji }
 * @param {number} reactionCount - Total reaction count
 * @param {string} currentUserId - Current user's ID to highlight their reaction
 * @param {boolean} compact - Compact mode (just emoji counts)
 */
const ReactionDisplay = ({ reactions = {}, reactionCount = 0, currentUserId, compact = false }) => {
  /**
   * Group reactions by emoji with counts
   * Returns array of { emoji, count, userIds: [] }
   */
  const getGroupedReactions = () => {
    if (!reactions || Object.keys(reactions).length === 0) return [];

    const grouped = {};

    Object.entries(reactions).forEach(([userId, emoji]) => {
      if (!grouped[emoji]) {
        grouped[emoji] = {
          emoji,
          count: 0,
          userIds: [],
        };
      }
      grouped[emoji].count += 1;
      grouped[emoji].userIds.push(userId);
    });

    // Sort by count (most popular first)
    return Object.values(grouped).sort((a, b) => b.count - a.count);
  };

  const groupedReactions = getGroupedReactions();

  if (reactionCount === 0 || groupedReactions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No reactions yet</Text>
        <Text style={styles.emptySubtext}>Be the first to react!</Text>
      </View>
    );
  }

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {groupedReactions.map((reaction, index) => {
          const userReacted = reaction.userIds.includes(currentUserId);
          return (
            <View
              key={index}
              style={[styles.compactPill, userReacted && styles.compactPillHighlighted]}
            >
              <Text style={styles.compactEmoji}>{reaction.emoji}</Text>
              <Text style={[styles.compactCount, userReacted && styles.compactCountHighlighted]}>
                {reaction.count}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {reactionCount} {reactionCount === 1 ? 'Reaction' : 'Reactions'}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.reactionList}
      >
        {groupedReactions.map((reaction, index) => {
          const userReacted = reaction.userIds.includes(currentUserId);
          return (
            <TouchableOpacity
              key={index}
              style={[styles.reactionCard, userReacted && styles.reactionCardHighlighted]}
              activeOpacity={0.7}
            >
              <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
              <Text style={[styles.reactionCount, userReacted && styles.reactionCountHighlighted]}>
                {reaction.count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  // Empty state
  emptyContainer: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
    marginBottom: spacing.xxs,
  },
  emptySubtext: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.tertiary,
  },

  // Compact mode
  compactContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  compactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.pill.background,
    borderRadius: layout.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.pill.border,
  },
  compactPillHighlighted: {
    backgroundColor: colors.overlay.purpleTint,
    borderColor: colors.brand.purple,
  },
  compactEmoji: {
    fontSize: typography.size.lg,
    marginRight: spacing.xxs,
  },
  compactCount: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  compactCountHighlighted: {
    color: colors.brand.purple,
  },

  // Full mode
  container: {
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  reactionList: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  reactionCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: spacing.md,
    backgroundColor: colors.pill.background,
    borderRadius: layout.borderRadius.md,
    borderWidth: 2,
    borderColor: colors.pill.border,
    minWidth: 80,
  },
  reactionCardHighlighted: {
    backgroundColor: colors.overlay.purpleTint,
    borderColor: colors.brand.purple,
  },
  reactionEmoji: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  reactionCount: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  reactionCountHighlighted: {
    color: colors.brand.purple,
  },
});

export default ReactionDisplay;
