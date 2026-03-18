/**
 * VideoPlayer - Reusable video player wrapping expo-video
 *
 * Provides VideoView with custom controls: progress bar and mute toggle.
 * Supports autoplay, looping, mute state, and playToEnd callback for stories.
 *
 * Usage:
 *   <VideoPlayer
 *     source={videoUrl}
 *     isMuted={isMuted}
 *     onToggleMute={toggleMute}
 *     loop={true}
 *     showControls={true}
 *   />
 */

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';

import { colors } from '../constants/colors';

const VideoPlayer = ({
  source,
  isMuted = true,
  onToggleMute,
  loop = true,
  autoPlay = true,
  showControls = true,
  onPlayToEnd,
  onTimeUpdate,
  style,
  contentFit = 'cover',
  isVisible = true,
}) => {
  const [progress, setProgress] = useState(0);

  const player = useVideoPlayer(source, p => {
    p.loop = loop;
    p.muted = isMuted;
    if (autoPlay && isVisible) {
      p.play();
    }
  });

  // Listen for playToEnd event
  useEvent(player, 'playToEnd', () => {
    if (onPlayToEnd) {
      onPlayToEnd();
    }
  });

  // Listen for status/time updates
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: player.currentTime,
  });

  // Update progress bar and notify parent of time updates
  useEffect(() => {
    const duration = player.duration;
    if (duration > 0) {
      setProgress(currentTime / duration);
    }
    if (onTimeUpdate) {
      onTimeUpdate({ currentTime, duration });
    }
  }, [currentTime, player.duration, onTimeUpdate]);

  // Handle visibility changes (play/pause)
  useEffect(() => {
    if (isVisible) {
      player.play();
    } else {
      player.pause();
    }
  }, [isVisible, player]);

  // Handle mute state changes
  useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  // Handle loop changes
  useEffect(() => {
    player.loop = loop;
  }, [loop, player]);

  return (
    <View style={[styles.container, style]}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit={contentFit}
        nativeControls={false}
      />

      {showControls && (
        <View style={styles.controlsOverlay}>
          {/* Progress bar */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
            </View>
          </View>

          {/* Mute toggle */}
          {onToggleMute && (
            <Pressable
              onPress={onToggleMute}
              style={styles.muteButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.muteText}>{isMuted ? 'M' : 'U'}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  video: {
    flex: 1,
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 16,
    backgroundColor: 'rgba(10, 10, 26, 0.3)',
  },
  progressBarContainer: {
    flex: 1,
    marginRight: 12,
  },
  progressBarTrack: {
    height: 2,
    backgroundColor: colors.overlay.lightMedium,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.text.primary,
    borderRadius: 1,
  },
  muteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(10, 10, 26, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  muteText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '700',
  },
});

export default VideoPlayer;
