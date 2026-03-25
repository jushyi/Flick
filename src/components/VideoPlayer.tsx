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

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';

import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';

import { colors } from '../constants/colors';
import PixelIcon from './PixelIcon';

import type { ViewStyle } from 'react-native';

type Props = {
  source: string;
  isMuted?: boolean;
  onToggleMute?: () => void;
  loop?: boolean;
  autoPlay?: boolean;
  showControls?: boolean;
  onPlayToEnd?: () => void;
  onTimeUpdate?: (data: { currentTime: number; duration: number }) => void;
  style?: ViewStyle;
  contentFit?: 'cover' | 'contain' | 'fill';
  isVisible?: boolean;
  isPaused?: boolean;
  controlsPosition?: 'top' | 'bottom';
  showProgressBar?: boolean;
};

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
  isPaused = false,
  controlsPosition = 'bottom',
  showProgressBar = true,
}: Props) => {
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [internalMuted, setInternalMuted] = useState(isMuted);

  // Use external mute state if provided, otherwise manage internally
  const effectiveMuted = onToggleMute ? isMuted : internalMuted;
  const handleToggleMute = onToggleMute || (() => setInternalMuted(prev => !prev));

  const player = useVideoPlayer(source, p => {
    p.loop = loop;
    p.muted = effectiveMuted;
    p.volume = 1.0;
    if (autoPlay && isVisible) {
      p.play();
    }
  });

  const handleTogglePlayPause = () => {
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  };

  // Listen for playToEnd event — deferred to avoid setState-during-render
  const onPlayToEndRef = useRef(onPlayToEnd);
  onPlayToEndRef.current = onPlayToEnd;

  (useEvent as any)(player, 'playToEnd', () => {
    requestAnimationFrame(() => {
      onPlayToEndRef.current?.();
    });
  });

  // Poll player.currentTime and player.duration directly via interval.
  // More reliable than useEvent('timeUpdate') which may not fire on all platforms.
  // Uses requestAnimationFrame to defer parent callbacks out of the render cycle.
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Track whether we've already fired playToEnd for this playback cycle
  const playToEndFiredRef = useRef(false);

  // Reset the flag when source changes (new video)
  useEffect(() => {
    playToEndFiredRef.current = false;
  }, [source]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!mountedRef.current) return;
      const ct = player.currentTime || 0;
      const dur = player.duration || 0;
      if (dur > 0) {
        setProgress(ct / dur);

        // Detect video completion: currentTime within 0.3s of duration and not looping
        if (!loop && !playToEndFiredRef.current && ct >= dur - 0.3 && ct > 0) {
          playToEndFiredRef.current = true;
          requestAnimationFrame(() => {
            onPlayToEndRef.current?.();
          });
        }
      }
      if (onTimeUpdateRef.current) {
        requestAnimationFrame(() => {
          if (mountedRef.current) {
            onTimeUpdateRef.current?.({ currentTime: ct, duration: dur });
          }
        });
      }
    }, 250);
    return () => clearInterval(interval);
  }, [player, loop]);

  // Handle visibility changes (play/pause)
  useEffect(() => {
    if (isVisible) {
      player.play();
    } else {
      player.pause();
    }
  }, [isVisible, player]);

  // Handle external pause (hold-to-pause)
  useEffect(() => {
    if (isPaused) {
      player.pause();
    } else if (isVisible) {
      player.play();
    }
  }, [isPaused, isVisible, player]);

  // Handle mute state changes
  useEffect(() => {
    player.muted = effectiveMuted;
  }, [effectiveMuted, player]);

  // Handle loop changes
  useEffect(() => {
    player.loop = loop;
  }, [loop, player]);

  return (
    <View style={[styles.container, style]} pointerEvents={showControls ? 'auto' : 'box-none'}>
      {/* Wrapper View ensures pointerEvents="none" is respected on Android,
          where native VideoView may intercept touches despite the prop */}
      <View style={styles.video} pointerEvents={showControls ? 'auto' : 'none'}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit={contentFit}
          nativeControls={false}
        />
      </View>

      {showControls && (
        <View
          style={[styles.controlsOverlay, controlsPosition === 'top' && styles.controlsOverlayTop]}
        >
          {/* Play/Pause */}
          <TouchableOpacity
            onPress={handleTogglePlayPause}
            style={styles.controlButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <PixelIcon name={isPlaying ? 'pause' : 'play'} size={14} color={colors.text.primary} />
          </TouchableOpacity>

          {/* Progress bar (optional) */}
          {showProgressBar && (
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
              </View>
            </View>
          )}

          {/* Spacer when no progress bar */}
          {!showProgressBar && <View style={{ flex: 1 }} />}

          {/* Mute toggle */}
          <TouchableOpacity
            onPress={handleToggleMute}
            style={styles.controlButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <PixelIcon
              name={effectiveMuted ? 'notifications-off-outline' : 'musical-notes-outline'}
              size={14}
              color={colors.text.primary}
            />
          </TouchableOpacity>
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
  controlsOverlayTop: {
    bottom: undefined,
    top: 0,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: 'transparent',
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
  controlButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(10, 10, 26, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlText: {
    color: colors.text.primary,
    fontSize: 11,
    fontWeight: '700',
  },
});

export default VideoPlayer;
