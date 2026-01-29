import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

const CARD_SIZE = 150;

/**
 * AlbumCard - Displays a single album in the album bar
 *
 * @param {object} album - Album object with { id, name, coverPhotoId, photoIds }
 * @param {string} coverPhotoUrl - URL for the cover photo (resolved by parent)
 * @param {function} onPress - Callback when card tapped
 * @param {function} onLongPress - Optional callback for long press (edit menu)
 */
export const AlbumCard = ({ album, coverPhotoUrl, onPress, onLongPress }) => {
  const hasPhotos = album.photoIds && album.photoIds.length > 0;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={event => onLongPress?.(event)}
      activeOpacity={0.8}
    >
      <View style={styles.stackContainer}>
        {/* Furthest card (3rd back) - only show if album has photos */}
        {hasPhotos && <View style={[styles.stackCard, styles.stackCardFurthest]} />}

        {/* Back card (2nd back) - only show if album has photos */}
        {hasPhotos && <View style={[styles.stackCard, styles.stackCardBack]} />}

        {/* Middle card (1st back) - only show if album has photos */}
        {hasPhotos && <View style={[styles.stackCard, styles.stackCardMiddle]} />}

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
    paddingTop: 6,
  },
  stackCard: {
    position: 'absolute',
    width: CARD_SIZE,
    height: CARD_SIZE,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  stackCardFurthest: {
    transform: [{ scale: 0.9 }, { translateY: -6 }],
    opacity: 0.5,
    zIndex: 1,
  },
  stackCardBack: {
    transform: [{ scale: 0.94 }, { translateY: -4 }],
    opacity: 0.65,
    zIndex: 2,
  },
  stackCardMiddle: {
    transform: [{ scale: 0.97 }, { translateY: -2 }],
    opacity: 0.8,
    zIndex: 3,
  },
  imageContainer: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.background.tertiary,
    zIndex: 4,
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
