/**
 * SongSearchModal Component
 *
 * Modal for searching and selecting songs using iTunes API.
 * Features:
 * - Search input with debounce
 * - Results list with preview playback
 * - Song selection callback
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { searchSongs } from '../../services/iTunesService';
import { stopPreview, playPreview } from '../../services/audioPlayer';
import SongSearchResult from './SongSearchResult';
import logger from '../../utils/logger';

const DEBOUNCE_MS = 500;

const SongSearchModal = ({ visible, onClose, onSelectSong }) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const debounceRef = useRef(null);

  // Cleanup on modal close or unmount
  useEffect(() => {
    if (!visible) {
      // Reset state when modal closes
      setQuery('');
      setResults([]);
      setLoading(false);
      setPlayingId(null);
      stopPreview();
    }

    return () => {
      // Cleanup on unmount
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      stopPreview();
    };
  }, [visible]);

  // Handle search query changes with debounce
  const handleQueryChange = useCallback(text => {
    setQuery(text);

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Clear results if query too short
    if (text.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Set loading state
    setLoading(true);

    // Debounce the search
    debounceRef.current = setTimeout(async () => {
      logger.debug('SongSearchModal: Searching', { query: text });
      const songs = await searchSongs(text.trim());
      setResults(songs);
      setLoading(false);
      logger.info('SongSearchModal: Search complete', { count: songs.length });
    }, DEBOUNCE_MS);
  }, []);

  // Handle play/pause button press on a result
  const handlePlayPress = useCallback(
    async song => {
      if (playingId === song.id) {
        // Same song - stop playback
        logger.debug('SongSearchModal: Stopping preview', { songId: song.id });
        await stopPreview();
        setPlayingId(null);
      } else {
        // Different song - stop current and play new
        logger.debug('SongSearchModal: Starting preview', { songId: song.id });
        await stopPreview();
        setPlayingId(song.id);
        await playPreview(song.previewUrl, {
          clipStart: 0,
          clipEnd: 30,
          onComplete: () => {
            logger.debug('SongSearchModal: Preview complete');
            setPlayingId(null);
          },
        });
      }
    },
    [playingId]
  );

  // Handle song selection (tap on card)
  const handleSelectPress = useCallback(
    async song => {
      logger.info('SongSearchModal: Song selected', { songId: song.id, title: song.title });
      // Stop any playing preview
      await stopPreview();
      setPlayingId(null);
      // Call parent callback
      onSelectSong(song);
    },
    [onSelectSong]
  );

  // Handle close
  const handleClose = useCallback(async () => {
    logger.debug('SongSearchModal: Closing');
    await stopPreview();
    onClose();
  }, [onClose]);

  // Render empty state
  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.text.secondary} />
        </View>
      );
    }

    if (query.trim().length < 2) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={48} color={colors.text.tertiary} />
          <Text style={styles.emptyText}>Search to find songs</Text>
        </View>
      );
    }

    if (results.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="musical-notes-outline" size={48} color={colors.text.tertiary} />
          <Text style={styles.emptyText}>No songs found</Text>
        </View>
      );
    }

    return null;
  };

  // Render result item
  const renderItem = useCallback(
    ({ item }) => (
      <SongSearchResult
        song={item}
        isPlaying={playingId === item.id}
        onPlayPress={() => handlePlayPress(item)}
        onSelectPress={() => handleSelectPress(item)}
      />
    ),
    [playingId, handlePlayPress, handleSelectPress]
  );

  // Key extractor
  const keyExtractor = useCallback(item => item.id, []);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="chevron-down" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Search Songs</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Ionicons
              name="search"
              size={20}
              color={colors.text.tertiary}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a song..."
              placeholderTextColor={colors.text.tertiary}
              value={query}
              onChangeText={handleQueryChange}
              autoFocus
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => handleQueryChange('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Results List */}
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
  },
  clearButton: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.tertiary,
    marginTop: 12,
  },
});

export default SongSearchModal;
