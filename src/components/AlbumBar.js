import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AlbumCard, AddAlbumCard } from './AlbumCard';
import { colors } from '../constants/colors';

/**
 * AlbumBar - Horizontal scrolling album bar for profile
 *
 * @param {array} albums - Array of album objects
 * @param {object} photoUrls - Map of photoId -> URL for resolving cover photos
 * @param {boolean} isOwnProfile - Shows add button only for own profile
 * @param {function} onAlbumPress - Callback(album) when album tapped
 * @param {function} onAlbumLongPress - Callback(album) for long press (edit menu)
 * @param {function} onAddPress - Callback when add button pressed
 */
const AlbumBar = ({
  albums = [],
  photoUrls = {},
  isOwnProfile = false,
  onAlbumPress,
  onAlbumLongPress,
  onAddPress,
}) => {
  // Empty state for other users - don't render anything
  if (!isOwnProfile && albums.length === 0) {
    return null;
  }

  // Empty state for own profile - full-width tappable prompt
  if (isOwnProfile && albums.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Albums</Text>
        <TouchableOpacity style={styles.emptyPrompt} onPress={onAddPress} activeOpacity={0.8}>
          <Ionicons name="albums-outline" size={28} color="#888" style={styles.emptyPromptIcon} />
          <Text style={styles.emptyPromptText}>Tap here to make your first album</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Prepare data for FlatList - albums plus add card for own profile
  const renderItem = ({ item, index }) => {
    // Add card at the end for own profile
    if (item.isAddCard) {
      return <AddAlbumCard onPress={onAddPress} />;
    }

    // Get cover photo URL from photoUrls map
    const coverUrl = item.coverPhotoId ? photoUrls[item.coverPhotoId] : null;

    // Get stack photo URLs (most recent photos excluding cover, up to 2)
    const stackPhotoUrls = [];
    if (item.photoIds && item.photoIds.length > 0) {
      // Get photos from end of array (most recent), excluding cover
      const nonCoverPhotos = item.photoIds.filter(id => id !== item.coverPhotoId);
      // Take up to 2 most recent (from end of array)
      const recentPhotos = nonCoverPhotos.slice(-2).reverse();
      recentPhotos.forEach(photoId => {
        if (photoUrls[photoId]) {
          stackPhotoUrls.push(photoUrls[photoId]);
        }
      });
    }

    return (
      <AlbumCard
        album={item}
        coverPhotoUrl={coverUrl}
        stackPhotoUrls={stackPhotoUrls}
        onPress={() => onAlbumPress?.(item)}
        onLongPress={event => onAlbumLongPress?.(item, event)}
      />
    );
  };

  // Build data array with optional add card at end
  const data = isOwnProfile ? [...albums, { id: 'add-card', isAddCard: true }] : albums;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Albums</Text>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  header: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  separator: {
    width: 12,
  },
  emptyPrompt: {
    marginHorizontal: 16,
    height: 100,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#555',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPromptIcon: {
    marginBottom: 6,
  },
  emptyPromptText: {
    fontSize: 15,
    color: '#888',
  },
});

export default AlbumBar;
