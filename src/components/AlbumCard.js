import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
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
 */
export const AlbumCard = ({ album, coverPhotoUrl, stackPhotoUrls = [], onPress, onLongPress }) => {
  // Show stack cards based on how many stack photos we have
  const stackCount = stackPhotoUrls.length;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={event => onLongPress?.(event)}
      activeOpacity={0.8}
    >
      <View style={styles.stackContainer}>
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
      </View>
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
    backgroundColor: '#2A2A2A',
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
    marginTop: 8,
    fontSize: 14,
    color: colors.text.primary,
    textAlign: 'center',
  },
  addContainer: {
    width: CARD_SIZE,
    height: CARD_SIZE,
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
