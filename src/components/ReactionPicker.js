import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { reactionHaptic, mediumImpact } from '../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Available reaction emojis (8 options)
 * Based on Lapse's authentic, film camera aesthetic
 */
const REACTION_EMOJIS = [
  { emoji: '😂', label: 'Laugh' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '😍', label: 'Hearts' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '💯', label: '100' },
];

/**
 * ReactionPicker - Modal emoji picker for photo reactions
 *
 * Features:
 * - 8 emoji options in 2 rows
 * - Remove reaction option if user already reacted
 * - Semi-transparent backdrop
 *
 * @param {boolean} visible - Modal visibility state
 * @param {string} currentReaction - User's current reaction emoji (null if none)
 * @param {function} onReactionSelect - Callback when emoji is selected (emoji)
 * @param {function} onRemoveReaction - Callback to remove current reaction
 * @param {function} onClose - Callback to close modal without selection
 */
const ReactionPicker = ({
  visible,
  currentReaction,
  onReactionSelect,
  onRemoveReaction,
  onClose,
}) => {
  /**
   * Handle emoji selection
   */
  const handleEmojiPress = (emoji) => {
    reactionHaptic(); // Haptic feedback on reaction selection
    onReactionSelect(emoji);
    onClose();
  };

  /**
   * Handle remove reaction
   */
  const handleRemoveReaction = () => {
    mediumImpact(); // Haptic feedback on removal
    onRemoveReaction();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* Picker container */}
        <View style={styles.pickerContainer}>
          {/* Title */}
          <Text style={styles.title}>Choose a reaction</Text>

          {/* Emoji grid - 2 rows of 4 */}
          <View style={styles.emojiGrid}>
            {REACTION_EMOJIS.map((reaction, index) => (
              <EmojiButton
                key={index}
                emoji={reaction.emoji}
                label={reaction.label}
                isSelected={currentReaction === reaction.emoji}
                onPress={() => handleEmojiPress(reaction.emoji)}
              />
            ))}
          </View>

          {/* Remove reaction button (if user has reacted) */}
          {currentReaction && (
            <TouchableOpacity
              style={styles.removeButton}
              onPress={handleRemoveReaction}
              activeOpacity={0.7}
            >
              <Text style={styles.removeButtonText}>Remove Reaction</Text>
            </TouchableOpacity>
          )}

          {/* Cancel button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

/**
 * EmojiButton - Individual emoji reaction button
 */
const EmojiButton = ({ emoji, label, isSelected, onPress }) => {
  return (
    <TouchableOpacity
      style={[styles.emojiButton, isSelected && styles.emojiButtonSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.emojiText}>{emoji}</Text>
      {isSelected && <View style={styles.selectedIndicator} />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 24,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  emojiButton: {
    width: (SCREEN_WIDTH - 80) / 4, // 4 buttons per row with padding
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiButtonSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  emojiText: {
    fontSize: 40,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
  },
  removeButton: {
    backgroundColor: '#FFEBEE',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  removeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D32F2F',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    textAlign: 'center',
  },
});

export default ReactionPicker;
