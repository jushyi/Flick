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
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import PixelIcon from '../PixelIcon';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing } from '../../constants/spacing';
import { layout } from '../../constants/layout';
import { playPreview, stopPreview, pausePreview, resumePreview } from '../../services/audioPlayer';
import logger from '../../utils/logger';

const ProfileSongCard = ({ song, isOwnProfile, onPress, onLongPress }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const glowOpacity = useSharedValue(0);
  const progressValue = useSharedValue(0);

  useEffect(() => {
    return () => {
      logger.debug('ProfileSongCard: Unmounting, stopping audio');
      stopPreview();
    };
  }, []);

  // Stop audio when navigating away from screen
  useFocusEffect(
    useCallback(() => {
      // When screen gains focus, nothing to do
      return () => {
        // When screen loses focus (navigate away), stop audio
        if (isPlaying) {
          logger.debug('ProfileSongCard: Screen losing focus, stopping audio');
          stopPreview();
          setIsPlaying(false);
          setProgress(0);
        }
      };
    }, [isPlaying])
  );

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

  // Animate progress bar smoothly
  useEffect(() => {
    if (progress > 0) {
      // Animate to new position with linear easing for smooth constant-speed movement
      // Duration matches audioPlayer's 50ms progress update interval
      progressValue.value = withTiming(progress, {
        duration: 50,
        easing: Easing.linear,
      });
    } else {
      // Reset to start without animation
      progressValue.value = 0;
    }
  }, [progress, progressValue]);

  // Animated style for progress bar width
  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressValue.value * 100}%`,
  }));

  const handleProgress = useCallback(progressValue => {
    setProgress(progressValue);
  }, []);

  const handleComplete = useCallback(() => {
    logger.debug('ProfileSongCard: Playback complete');
    setIsPlaying(false);
    setProgress(0);
  }, []);

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

  const handlePress = useCallback(() => {
    if (song) {
      // Has song - toggle play/pause
      handlePlayPause();
    } else if (onPress) {
      // No song - trigger add song flow
      onPress();
    }
  }, [song, handlePlayPause, onPress]);

  const handleLongPress = useCallback(() => {
    if (isOwnProfile && song && onLongPress) {
      onLongPress();
    }
  }, [isOwnProfile, song, onLongPress]);

  if (!song) {
    return (
      <TouchableOpacity style={styles.emptyContainer} onPress={handlePress} activeOpacity={0.7}>
        <PixelIcon name="musical-notes-outline" size={24} color={colors.text.secondary} />
        <Text style={styles.emptyText}>Add a song</Text>
      </TouchableOpacity>
    );
  }

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
        <Image
          source={{ uri: song.albumArt }}
          style={styles.albumArt}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="low"
        />

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
          <PixelIcon
            name={isPlaying ? 'pause-circle' : 'play-circle'}
            size={32}
            color={colors.text.primary}
          />
        </TouchableOpacity>

        {/* Progress Bar */}
        {(isPlaying || progress > 0) && (
          <View style={styles.progressContainer}>
            <Animated.View style={[styles.progressBar, progressBarStyle]} />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: layout.borderRadius.md,
    backgroundColor: colors.background.tertiary,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
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
  artist: {
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
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    minHeight: 60,
    borderRadius: layout.borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.subtle,
    backgroundColor: colors.background.tertiary,
    gap: spacing.xs,
  },
  emptyText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
  },
});

export default ProfileSongCard;
