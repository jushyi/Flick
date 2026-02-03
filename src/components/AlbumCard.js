import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

const CARD_SIZE = 150;

/**
 * AlbumCard - Displays a single album in the album bar
 *
 * @param {object} album - Album object with { id, name, coverPhotoId, photoIds }
 * @param {string} coverPhotoUrl - URL for the cover photo (resolved by parent)
 * @param {array} stackPhotoUrls - URLs for stack photos (up to 3, most recent non-cover photos)
 * @param {function} onPress - Callback when card tapped
 * @param {function} onLongPress - Optional callback for long press (edit menu)
 * @param {boolean} isHighlighted - Whether to show scale bounce animation
 */
export const AlbumCard = ({
  album,
  coverPhotoUrl,
  stackPhotoUrls = [],
  onPress,
  onLongPress,
  isHighlighted = false,
}) => {
  // Show stack cards based on how many stack photos we have
  const stackCount = stackPhotoUrls.length;

  // Animation for highlight effect
  const scale = useSharedValue(1);

  // Trigger scale bounce when isHighlighted becomes true
  useEffect(() => {
    if (isHighlighted) {
      // Quick bounce - 100ms up, 100ms hold, 100ms down
      scale.value = withSequence(
        withTiming(1.15, { duration: 100 }),
        withTiming(1.15, { duration: 100 }),
        withTiming(1, { duration: 100 })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHighlighted]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={event => onLongPress?.(event)}
      activeOpacity={0.8}
    >
      <Animated.View style={[styles.stackContainer, animatedStyle]}>
        {/* Back card (2nd back) - only show if we have 2+ stack photos */}
        {stackCount >= 2 && (
          <View style={[styles.stackCard, styles.stackCardBack]}>
            <Image source={{ uri: stackPhotoUrls[1] }} style={styles.stackImage} />
          </View>
        )}

        {/* Middle card (1st back) - only show if we have 1+ stack photos */}
        {stackCount >= 1 && (
          <View style={[styles.stackCard, styles.stackCardMiddle]}>
            <Image source={{ uri: stackPhotoUrls[0] }} style={styles.stackImage} />
          </View>
        )}

        {/* Front card (cover) */}
        <View style={styles.imageContainer}>
          {coverPhotoUrl ? (
            <Image source={{ uri: coverPhotoUrl }} style={styles.coverImage} />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="images-outline" size={40} color={colors.text.secondary} />
            </View>
          )}
        </View>
      </Animated.View>
      <Text style={styles.title} numberOfLines={2}>
        {album.name}
      </Text>
    </TouchableOpacity>
  );
};

/**
 * AddAlbumCard - Dashed border card for adding new album
 *
 * @param {function} onPress - Callback when card tapped
 */
export const AddAlbumCard = ({ onPress }) => {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.addContainer}>
        <Ionicons name="add" size={40} color={colors.text.secondary} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_SIZE,
    alignItems: 'center',
  },
  stackContainer: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    paddingTop: 12,
    overflow: 'visible',
  },
  stackCard: {
    position: 'absolute',
    width: CARD_SIZE,
    height: CARD_SIZE,
    backgroundColor: colors.background.tertiary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  stackImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  stackCardBack: {
    transform: [{ scale: 0.94 }, { translateY: 0 }],
    opacity: 0.35,
    zIndex: 1,
  },
  stackCardMiddle: {
    transform: [{ scale: 0.97 }, { translateY: 6 }],
    opacity: 0.45,
    zIndex: 2,
  },
  imageContainer: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.background.tertiary,
    zIndex: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginTop: 14,
    fontSize: 14,
    color: colors.text.primary,
    textAlign: 'center',
  },
  addContainer: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border.subtle,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
});

export default AlbumCard;
