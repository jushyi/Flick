import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

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

  // Empty state
  if (reactionCount === 0 || groupedReactions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No reactions yet</Text>
        <Text style={styles.emptySubtext}>Be the first to react!</Text>
      </View>
    );
  }

  // Compact mode - just emoji pills
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

  // Full mode - detailed reaction list
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
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
  },

  // Compact mode
  compactContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 8,
  },
  compactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  compactPillHighlighted: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  compactEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  compactCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  compactCountHighlighted: {
    color: '#2196F3',
  },

  // Full mode
  container: {
    paddingVertical: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  reactionList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  reactionCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    minWidth: 80,
  },
  reactionCardHighlighted: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  reactionEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  reactionCount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333333',
  },
  reactionCountHighlighted: {
    color: '#2196F3',
  },
});

export default ReactionDisplay;
