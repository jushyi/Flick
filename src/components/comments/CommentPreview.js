/**
 * CommentPreview Component
 *
 * Displays a single rotating preview comment for a photo with "View all X comments" link.
 * Used in both PhotoDetailModal (full mode) and FeedPhotoCard (compact mode).
 *
 * Features:
 * - Owner comment prioritized as caption
 * - Bold username inline with comment text
 * - Truncation for long comments
 * - Single comment display with 2-second rotation
 * - Smooth fade animation between comments
 * - "View all X comments" link when more exist
 */
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import StrokedNameText from '../StrokedNameText';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing } from '../../constants/spacing';

/**
 * CommentPreview Component
 *
 * @param {Array} comments - Array of preview comments (1-2 items)
 * @param {number} totalCount - Total comment count
 * @param {function} onPress - Callback when pressed (opens full comments)
 * @param {boolean} compact - Compact mode for feed cards (1 line per comment)
 * @param {boolean} showViewAll - Show "View all X comments" link (default: true)
 */
const CommentPreview = ({
  comments = [],
  totalCount = 0,
  onPress,
  compact = false,
  showViewAll = true,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Rotate comments every 2 seconds with fade animation
  useEffect(() => {
    if (!comments || comments.length <= 1) return;

    const interval = setInterval(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        // Change index
        setCurrentIndex(prev => (prev + 1) % comments.length);
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [comments?.length, fadeAnim]);

  // Reset index when comments change
  useEffect(() => {
    setCurrentIndex(0);
    fadeAnim.setValue(1);
  }, [comments, fadeAnim]);

  if (!comments || comments.length === 0) {
    return null;
  }

  const hasMoreComments = totalCount > comments.length;
  const currentComment = comments[currentIndex];

  // Determine display text - handle media-only comments
  const getCommentDisplayText = () => {
    if (currentComment?.text) {
      return currentComment.text;
    }
    // Media-only comment
    if (currentComment?.mediaType === 'gif') {
      return 'sent a GIF';
    }
    if (currentComment?.mediaType === 'image' || currentComment?.mediaUrl) {
      return 'sent an image';
    }
    return '';
  };

  const displayText = getCommentDisplayText();
  const isMediaOnly = !currentComment?.text && currentComment?.mediaUrl;

  return (
    <TouchableOpacity
      style={[styles.container, compact && styles.containerCompact]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Single rotating comment with fade animation */}
      <Animated.View style={{ opacity: fadeAnim }}>
        <View style={styles.commentRow}>
          <Text style={styles.commentText} numberOfLines={compact ? 1 : 2}>
            <StrokedNameText style={styles.username} nameColor={currentComment?.user?.nameColor}>
              {currentComment?.user?.displayName || 'User'}
            </StrokedNameText>
            <Text style={[styles.commentContent, isMediaOnly && styles.mediaIndicator]}>
              {' '}
              {displayText}
            </Text>
          </Text>
        </View>
      </Animated.View>

      {/* View all comments link */}
      {showViewAll && hasMoreComments && (
        <Text style={styles.viewAllText}>View all {totalCount} comments</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xxs,
  },
  containerCompact: {
    paddingVertical: 2,
  },
  commentRow: {
    marginBottom: 2,
  },
  commentText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
    lineHeight: 18,
  },
  username: {
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  commentContent: {
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
  },
  mediaIndicator: {
    fontStyle: 'italic',
    color: colors.text.secondary,
  },
  viewAllText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
});

export default CommentPreview;
