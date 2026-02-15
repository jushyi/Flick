/**
 * SongSearchResult Component
 *
 * Displays a single song result in the search modal.
 * Layout matches ProfileSongCard for WYSIWYG (What You See Is What You Get).
 * Features:
 * - Album art thumbnail
 * - Song title and artist with duration
 * - Play/pause button for preview
 * - Separate tap targets for preview vs selection
 */

import { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import PixelIcon from '../PixelIcon';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing } from '../../constants/spacing';
import { layout } from '../../constants/layout';
import { formatDuration } from '../../services/iTunesService';

const SongSearchResult = ({ song, isPlaying, onPlayPress, onSelectPress }) => {
  return (
    <TouchableOpacity
      style={[styles.container, isPlaying && styles.containerPlaying]}
      onPress={onSelectPress}
      activeOpacity={0.7}
    >
      {/* Album Art */}
      <Image source={{ uri: song.albumArt }} style={styles.albumArt} contentFit="cover" />

      {/* Song Info */}
      <View style={styles.songInfo}>
        <Text style={styles.title} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {song.artist} - {formatDuration(song.duration)}
        </Text>
      </View>

      {/* Play/Pause Button */}
      <TouchableOpacity
        style={styles.playButton}
        onPress={onPlayPress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <PixelIcon
          name={isPlaying ? 'pause-circle' : 'play-circle'}
          size={32}
          color={isPlaying ? colors.brand.purple : colors.text.primary}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: layout.borderRadius.md,
    backgroundColor: colors.background.tertiary,
    minHeight: 60,
  },
  containerPlaying: {
    backgroundColor: colors.background.secondary,
    borderLeftWidth: 3,
    borderLeftColor: colors.brand.purple,
  },
  albumArt: {
    width: 48,
    height: 48,
    borderRadius: layout.borderRadius.sm,
    backgroundColor: colors.background.secondary,
  },
  songInfo: {
    flex: 1,
    marginLeft: spacing.sm,
    marginRight: spacing.xs,
  },
  title: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    marginTop: 2,
  },
  playButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default memo(SongSearchResult);
