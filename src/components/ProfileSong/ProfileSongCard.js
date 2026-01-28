/**
 * ProfileSongCard Component
 *
 * Displays the user's profile song with album art, title, artist, and playback controls.
 * Features:
 * - Play/pause toggle with progress bar
 * - Subtle glow animation when playing
 * - Empty state with "Add a song" prompt
 */

import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { playPreview, stopPreview, pausePreview, resumePreview } from '../../services/audioPlayer';
import logger from '../../utils/logger';

const ProfileSongCard = ({ song, isOwnProfile, onPress, onLongPress }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Glow animation value
  const glowOpacity = useSharedValue(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      logger.debug('ProfileSongCard: Unmounting, stopping audio');
      stopPreview();
    };
  }, []);

  // Start/stop glow animation based on playing state
  useEffect(() => {
    if (isPlaying) {
      // Pulse glow animation
      glowOpacity.value = withRepeat(
        withSequence(withTiming(0.4, { duration: 800 }), withTiming(0.2, { duration: 800 })),
        -1, // Infinite repeat
        true // Reverse
      );
    } else {
      // Stop animation and reset
      cancelAnimation(glowOpacity);
      glowOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [isPlaying, glowOpacity]);

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value,
  }));

  // Handle progress updates from audio player
  const handleProgress = useCallback(progressValue => {
    setProgress(progressValue);
  }, []);

  // Handle playback completion
  const handleComplete = useCallback(() => {
    logger.debug('ProfileSongCard: Playback complete');
    setIsPlaying(false);
    setProgress(0);
  }, []);

  // Toggle play/pause
  const handlePlayPause = useCallback(async () => {
    if (!song?.previewUrl) {
      logger.warn('ProfileSongCard: No preview URL available');
      return;
    }

    if (isPlaying) {
      // Pause
      logger.debug('ProfileSongCard: Pausing');
      await pausePreview();
      setIsPlaying(false);
    } else if (progress > 0 && progress < 1) {
      // Resume from where we left off
      logger.debug('ProfileSongCard: Resuming');
      await resumePreview();
      setIsPlaying(true);
    } else {
      // Start fresh playback
      logger.debug('ProfileSongCard: Starting playback');
      setProgress(0);
      setIsPlaying(true);
      await playPreview(song.previewUrl, {
        clipStart: song.clipStart || 0,
        clipEnd: song.clipEnd || 30,
        onProgress: handleProgress,
        onComplete: handleComplete,
      });
    }
  }, [song, isPlaying, progress, handleProgress, handleComplete]);

  // Handle card press
  const handlePress = useCallback(() => {
    if (song) {
      // Has song - toggle play/pause
      handlePlayPause();
    } else if (onPress) {
      // No song - trigger add song flow
      onPress();
    }
  }, [song, handlePlayPause, onPress]);

  // Handle card long press (only for own profile with song)
  const handleLongPress = useCallback(() => {
    if (isOwnProfile && song && onLongPress) {
      onLongPress();
    }
  }, [isOwnProfile, song, onLongPress]);

  // Empty state
  if (!song) {
    return (
      <TouchableOpacity style={styles.emptyContainer} onPress={handlePress} activeOpacity={0.7}>
        <Ionicons name="musical-notes-outline" size={24} color={colors.text.secondary} />
        <Text style={styles.emptyText}>Add a song</Text>
      </TouchableOpacity>
    );
  }

  // With song
  return (
    <Animated.View style={[styles.container, styles.glowShadow, glowStyle]}>
      <TouchableOpacity
        style={styles.content}
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.7}
        delayLongPress={500}
      >
        {/* Album Art */}
        <Image source={{ uri: song.albumArt }} style={styles.albumArt} resizeMode="cover" />

        {/* Song Info */}
        <View style={styles.songInfo}>
          <Text style={styles.title} numberOfLines={1}>
            {song.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {song.artist}
          </Text>
        </View>

        {/* Play/Pause Button */}
        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlayPause}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={isPlaying ? 'pause-circle' : 'play-circle'}
            size={32}
            color={colors.text.primary}
          />
        </TouchableOpacity>

        {/* Progress Bar */}
        {(isPlaying || progress > 0) && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    backgroundColor: colors.background.tertiary,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 60,
  },
  glowShadow: {
    shadowColor: colors.brand.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    elevation: 8,
  },
  albumArt: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.background.secondary,
  },
  songInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  artist: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  playButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.background.secondary,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.brand.purple,
  },
  // Empty state
  emptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    minHeight: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.subtle,
    backgroundColor: colors.background.tertiary,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
});

export default ProfileSongCard;
