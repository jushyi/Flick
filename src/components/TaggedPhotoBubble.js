/**
 * TaggedPhotoBubble - Tagged photo message card for DM conversations
 *
 * Renders a tagged photo as a large, visually distinct card in the conversation
 * thread. Both sender and recipient see the same large photo card (no compact
 * version). The card includes:
 *
 * 1. Header text: "[Name] tagged you in a photo" (recipient) / "You tagged in a photo" (sender)
 * 2. Large photo image (4:3 aspect ratio)
 * 3. "Add to feed" button (recipient only, one-tap add)
 * 4. Optional ReactionBadges below the card
 * 5. Optional timestamp
 *
 * Caption is NOT shown on the card (only visible in PhotoDetail).
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';

import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';

import PixelIcon from './PixelIcon';
import PixelSpinner from './PixelSpinner';
import ReactionBadges from './ReactionBadges';

import { addTaggedPhotoToFeed } from '../services/firebase/photoTagService';

import { styles, TAG_ACCENT } from '../styles/TaggedPhotoBubble.styles';

import { colors } from '../constants/colors';

import logger from '../utils/logger';

const TaggedPhotoBubble = ({
  message,
  isCurrentUser,
  showTimestamp,
  onPress,
  reactions,
  onReactionPress,
  currentUserId,
  conversationId,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Determine if current user already added this photo to their feed
  const hasAdded = !!(message.addedToFeedBy && message.addedToFeedBy[currentUserId]);

  const formatTimestamp = () => {
    if (!message.createdAt) return '';
    const date = message.createdAt.toDate
      ? message.createdAt.toDate()
      : new Date(message.createdAt);
    return format(date, 'h:mm a');
  };

  // Header text: recipient sees "tagged you in a photo", sender sees "You tagged in a photo"
  const headerText = isCurrentUser ? 'You tagged in a photo' : 'Tagged you in a photo';

  const handleAddToFeed = useCallback(async () => {
    if (hasAdded || isAdding) return;

    setIsAdding(true);
    const result = await addTaggedPhotoToFeed(message.photoId, conversationId, message.id);

    if (result.success) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // hasAdded will update via real-time Firestore subscription when addedToFeedBy is written
    } else {
      logger.warn('TaggedPhotoBubble: Failed to add photo to feed', {
        photoId: message.photoId,
        error: result.error,
      });
    }

    setIsAdding(false);
  }, [hasAdded, isAdding, message.photoId, message.id, conversationId]);

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress(message);
    }
  }, [onPress, message]);

  return (
    <View style={[styles.container, isCurrentUser ? styles.containerRight : styles.containerLeft]}>
      <TouchableOpacity activeOpacity={0.85} onPress={handlePress}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.headerContainer}>
            <Text style={styles.headerText}>{headerText}</Text>
          </View>

          {/* Photo */}
          <View style={styles.photoContainer}>
            {imageError || !message.photoURL ? (
              <View style={styles.photoPlaceholder}>
                <PixelIcon name="image" size={32} color={colors.text.secondary} />
              </View>
            ) : (
              <Image
                source={{ uri: message.photoURL }}
                style={styles.photo}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
                onError={() => setImageError(true)}
              />
            )}
          </View>

          {/* Add to feed button - recipient only */}
          {!isCurrentUser && (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.addButton, (hasAdded || isAdding) && styles.addButtonDisabled]}
                onPress={handleAddToFeed}
                disabled={hasAdded || isAdding}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={hasAdded ? 'Added to feed' : 'Add to feed'}
              >
                {isAdding ? (
                  <PixelSpinner size="small" color={TAG_ACCENT} />
                ) : (
                  <>
                    <PixelIcon
                      name={hasAdded ? 'checkmark' : 'add'}
                      size={14}
                      color={hasAdded ? colors.text.secondary : colors.text.inverse}
                    />
                    <Text
                      style={[
                        styles.addButtonText,
                        (hasAdded || isAdding) && styles.addButtonTextDisabled,
                      ]}
                    >
                      {hasAdded ? 'Added to feed' : 'Add to feed'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Reaction badges */}
      {reactions && Object.keys(reactions).length > 0 && (
        <ReactionBadges
          reactions={reactions}
          isCurrentUser={isCurrentUser}
          currentUserId={currentUserId}
          onReactionPress={onReactionPress}
        />
      )}

      {/* Timestamp */}
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

export default TaggedPhotoBubble;
