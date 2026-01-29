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
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={event => onLongPress?.(event)}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        {coverPhotoUrl ? (
          <Image source={{ uri: coverPhotoUrl }} style={styles.coverImage} />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="images-outline" size={40} color={colors.text.secondary} />
          </View>
        )}
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
  imageContainer: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.background.tertiary,
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
