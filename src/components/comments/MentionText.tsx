/**
 * MentionText Component
 *
 * Parses comment text and renders @mentions as highlighted tappable spans.
 * Used in CommentRow to make @mentions interactive for navigation.
 *
 * Features:
 * - Regex parsing of @username patterns
 * - Purple highlighted @mention text
 * - Tappable @mentions with callback
 * - First @mention linked to mentionedCommentId (auto-inserted from Reply)
 * - Subsequent @mentions still highlighted but with null commentId
 */
import React, { useMemo } from 'react';
import { Text } from 'react-native';
import { styles } from '../../styles/MentionText.styles';

// Regex to match @mentions (username with word characters)
const MENTION_REGEX = /@(\w+)/g;

/**
 * MentionText Component
 *
 * @param {string} text - The comment text to parse
 * @param {function} onMentionPress - Callback when @mention is tapped (username, mentionedCommentId)
 * @param {string|null} mentionedCommentId - The comment ID the first @mention refers to (from comment data)
 * @param {object} style - Base text style (optional)
 */
type Props = {
  text: string;
  mentions?: string[];
  onMentionPress?: (userId: string) => void;
  style?: Record<string, unknown>;
};

const MentionText = ({ text, onMentionPress, mentionedCommentId = null, style }) => {
  /**
   * Parse text into segments: regular text and @mention spans
   * Returns array of { type: 'text' | 'mention', content: string, username?: string, isFirst?: boolean }
   */
  const segments = useMemo(() => {
    if (!text) return [];

    const result: Array<{ type: string; content: string; username?: string; isFirst?: boolean }> = [];
    let lastIndex = 0;
    let match;
    let isFirstMention = true;

    // Reset regex lastIndex for fresh search
    MENTION_REGEX.lastIndex = 0;

    while ((match = MENTION_REGEX.exec(text)) !== null) {
      // Add text before this match
      if (match.index > lastIndex) {
        result.push({
          type: 'text',
          content: text.slice(lastIndex, match.index),
        });
      }

      // Add the @mention
      result.push({
        type: 'mention',
        content: match[0], // Full match including @
        username: match[1], // Just the username
        isFirst: isFirstMention,
      });

      isFirstMention = false;
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last match
    if (lastIndex < text.length) {
      result.push({
        type: 'text',
        content: text.slice(lastIndex),
      });
    }

    return result;
  }, [text]);

  /**
   * Handle @mention press
   * First @mention gets mentionedCommentId, subsequent ones get null
   */
  const handleMentionPress = (username, isFirst) => {
    if (onMentionPress) {
      // Only the first @mention gets the linked commentId
      const commentId = isFirst ? mentionedCommentId : null;
      onMentionPress(username, commentId);
    }
  };

  // If no text, return null
  if (!text) {
    return null;
  }

  // Render text with nested Text components for @mentions
  return (
    <Text style={[styles.baseText, style]}>
      {segments.map((segment, index) => {
        if (segment.type === 'mention') {
          return (
            <Text
              key={`mention-${index}`}
              style={styles.mentionText}
              onPress={() => handleMentionPress(segment.username, segment.isFirst)}
            >
              {segment.content}
            </Text>
          );
        }
        return segment.content;
      })}
    </Text>
  );
};

export default MentionText;
