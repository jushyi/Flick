/**
 * MentionSuggestionsOverlay Component
 *
 * Floating overlay component positioned above the CommentInput
 * that displays @-mention autocomplete suggestions.
 *
 * Features:
 * - Scrollable list of mutual friend suggestions
 * - Profile photo, display name, and @username per row
 * - Haptic feedback on selection
 * - Loading state with spinner
 * - Renders inline (NOT as Modal/Portal) within CommentsBottomSheet hierarchy
 */
import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import PixelSpinner from '../PixelSpinner';
import StrokedNameText from '../StrokedNameText';
import { colors } from '../../constants/colors';
import { styles } from '../../styles/MentionSuggestionsOverlay.styles';

/**
 * MentionSuggestionsOverlay Component
 *
 * @param {Array} suggestions - Array of { userId, username, displayName, profilePhotoURL }
 * @param {function} onSelect - Callback (user) => void when suggestion tapped
 * @param {boolean} visible - Whether to show the overlay
 * @param {boolean} loading - Whether mutual friends are still loading
 */
const MentionSuggestionsOverlay = ({
  suggestions = [],
  onSelect,
  visible = false,
  loading = false,
}) => {
  const handleSelect = useCallback(
    user => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (onSelect) {
        onSelect(user);
      }
    },
    [onSelect]
  );

  const renderSuggestionItem = useCallback(
    ({ item }) => {
      const initials = item.displayName ? item.displayName[0].toUpperCase() : '?';

      return (
        <TouchableOpacity
          style={styles.suggestionRow}
          onPress={() => handleSelect(item)}
          activeOpacity={0.7}
        >
          {/* Profile Photo */}
          {item.profilePhotoURL ? (
            <Image
              source={{ uri: item.profilePhotoURL, cacheKey: `mention-${item.userId}` }}
              style={styles.profilePhoto}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={0}
            />
          ) : (
            <View style={styles.profilePhotoPlaceholder}>
              <Text style={styles.profilePhotoInitial}>{initials}</Text>
            </View>
          )}

          {/* Display Name + @username */}
          <View style={styles.textContainer}>
            <StrokedNameText
              style={styles.displayName}
              nameColor={item?.nameColor}
              numberOfLines={1}
            >
              {item.displayName || 'Unknown'}
            </StrokedNameText>
            {item.username && (
              <Text style={styles.username} numberOfLines={1}>
                @{item.username}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [handleSelect]
  );

  const keyExtractor = useCallback(item => item.userId, []);

  // Only render when visible and there are suggestions or loading
  if (!visible || (!loading && suggestions.length === 0)) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <PixelSpinner size="small" color={colors.brand.purple} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={suggestions}
        renderItem={renderSuggestionItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

export default MentionSuggestionsOverlay;
