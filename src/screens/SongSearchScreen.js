/**
 * SongSearchScreen
 *
 * Screen for searching and selecting songs using iTunes API.
 * Replaces SongSearchModal to enable proper stacking with ClipSelectionModal.
 *
 * Features:
 * - Search input with debounce
 * - Results list with preview playback
 * - ClipSelectionModal overlay for clip selection
 * - Preserves search state when clip modal is open
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import PixelIcon from '../components/PixelIcon';
import PixelSpinner from '../components/PixelSpinner';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { searchSongs } from '../services/iTunesService';
import { stopPreview, playPreview } from '../services/audioPlayer';
import { SongSearchResult, ClipSelectionModal } from '../components/ProfileSong';
import logger from '../utils/logger';

const DEBOUNCE_MS = 500;

const SongSearchScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState(null);

  // Clip selection state
  const [selectedSongForClip, setSelectedSongForClip] = useState(null);

  const debounceRef = useRef(null);

  // Get source screen name and editSong from route params
  const { source, editSong } = route.params || {};

  // Handle editSong param - immediately open clip selection
  useEffect(() => {
    if (editSong) {
      setSelectedSongForClip(editSong);
    }
  }, [editSong]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      stopPreview();
    };
  }, []);

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
      logger.debug('SongSearchScreen: Searching', { query: text });
      const songs = await searchSongs(text.trim());
      setResults(songs);
      setLoading(false);
      logger.info('SongSearchScreen: Search complete', { count: songs.length });
    }, DEBOUNCE_MS);
  }, []);

  // Handle play/pause button press on a result
  const handlePlayPress = useCallback(
    async song => {
      if (playingId === song.id) {
        // Same song - stop playback
        logger.debug('SongSearchScreen: Stopping preview', { songId: song.id });
        await stopPreview();
        setPlayingId(null);
      } else {
        // Different song - stop current and play new
        logger.debug('SongSearchScreen: Starting preview', { songId: song.id });
        await stopPreview();
        setPlayingId(song.id);
        await playPreview(song.previewUrl, {
          clipStart: 0,
          clipEnd: 30,
          onComplete: () => {
            logger.debug('SongSearchScreen: Preview complete');
            setPlayingId(null);
          },
        });
      }
    },
    [playingId]
  );

  // Handle song selection (tap on card) - opens clip selection modal
  const handleSelectPress = useCallback(async song => {
    logger.info('SongSearchScreen: Song selected for clip', { songId: song.id, title: song.title });
    // Stop any playing preview
    await stopPreview();
    setPlayingId(null);
    // Open clip selection modal
    setSelectedSongForClip(song);
  }, []);

  // Handle clip selection confirmation
  const handleClipConfirm = useCallback(
    songWithClip => {
      logger.info('SongSearchScreen: Clip confirmed', {
        songId: songWithClip.id,
        clipStart: songWithClip.clipStart,
        clipEnd: songWithClip.clipEnd,
      });
      setSelectedSongForClip(null);
      // Navigate back to source screen with selected song as serializable params
      if (source) {
        navigation.navigate(source, { selectedSong: songWithClip });
      } else {
        navigation.goBack();
      }
    },
    [source, navigation]
  );

  // Handle clip selection cancel - always stay on search to allow picking different song
  const handleClipCancel = useCallback(async () => {
    logger.info('SongSearchScreen: Clip selection cancelled, staying on search');
    await stopPreview();
    setSelectedSongForClip(null);
    // Always stay on search screen so user can pick a different song
  }, []);

  // Handle close button
  const handleClose = useCallback(async () => {
    logger.debug('SongSearchScreen: Closing');
    await stopPreview();
    navigation.goBack();
  }, [navigation]);

  // Render empty state
  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <PixelSpinner size="large" color={colors.text.secondary} />
        </View>
      );
    }

    if (query.trim().length < 2) {
      return (
        <View style={styles.emptyContainer}>
          <PixelIcon name="search-outline" size={48} color={colors.text.tertiary} />
          <Text style={styles.emptyText}>Search to find songs</Text>
        </View>
      );
    }

    if (results.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <PixelIcon name="musical-notes-outline" size={48} color={colors.text.tertiary} />
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <PixelIcon name="chevron-down" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Search Songs</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <PixelIcon
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
              autoFocus={!editSong} // Don't autofocus if we're editing an existing song
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => handleQueryChange('')} style={styles.clearButton}>
                <PixelIcon name="close-circle" size={20} color={colors.text.tertiary} />
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

      {/* Clip Selection Modal - overlays this screen */}
      <ClipSelectionModal
        visible={selectedSongForClip !== null}
        song={selectedSongForClip}
        onConfirm={handleClipConfirm}
        onCancel={handleClipCancel}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  keyboardView: {
    flex: 1,
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
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
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
    borderRadius: 2,
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
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
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
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.tertiary,
    marginTop: 12,
  },
});

export default SongSearchScreen;
