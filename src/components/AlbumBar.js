import { View, Text, StyleSheet, FlatList } from 'react-native';
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

  // Empty state for own profile - show add card with helper text
  if (isOwnProfile && albums.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Albums</Text>
        <View style={styles.emptyContainer}>
          <AddAlbumCard onPress={onAddPress} />
          <Text style={styles.emptyText}>Create your first album</Text>
        </View>
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

    return (
      <AlbumCard
        album={item}
        coverPhotoUrl={coverUrl}
        onPress={() => onAlbumPress?.(item)}
        onLongPress={() => onAlbumLongPress?.(item)}
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
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});

export default AlbumBar;
