/**
 * ClipSelectionModal Component
 *
 * Modal for previewing a song before saving to profile.
 * Features:
 * - Song info display (album art, title, artist)
 * - Waveform scrubber with tap-to-seek
 * - Preview button to hear 30-second clip
 * - Confirm button to save selection
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import PixelIcon from '../PixelIcon';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { spacing } from '../../constants/spacing';
import { layout } from '../../constants/layout';
import { playPreview, stopPreview, seekTo } from '../../services/audioPlayer';
import WaveformScrubber from './WaveformScrubber';
import logger from '../../utils/logger';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WAVEFORM_WIDTH = SCREEN_WIDTH - 64;
const PREVIEW_DURATION = 30; // iTunes preview duration

const ClipSelectionModal = ({ visible, song, onConfirm, onCancel }) => {
  const insets = useSafeAreaInsets();

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0); // Current position in seconds

  const slideAnim = useRef(new Animated.Value(300)).current;

  // Animate content slide when visibility changes
  useEffect(() => {
    if (visible) {
      // Slide up when opening
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      // Reset to bottom position when closed
      slideAnim.setValue(300);
    }
  }, [visible, slideAnim]);

  // Reset state when song changes or modal opens
  useEffect(() => {
    if (visible && song) {
      setIsPlaying(false);
      setPlaybackPosition(0);
    }

    // Cleanup on close
    if (!visible) {
      stopPreview();
      setIsPlaying(false);
      setPlaybackPosition(0);
    }
  }, [visible, song]);

  // Handle preview button - plays from current position
  const handlePreview = useCallback(async () => {
    if (isPlaying) {
      await stopPreview();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      // Start from current scrubbed position
      const startPosition = playbackPosition;
      await playPreview(song.previewUrl, {
        clipStart: startPosition,
        clipEnd: PREVIEW_DURATION,
        onProgress: progress => {
          // progress is 0-1 within the clip range (startPosition to end)
          const clipDuration = PREVIEW_DURATION - startPosition;
          const currentPos = startPosition + progress * clipDuration;
          setPlaybackPosition(currentPos);
        },
        onComplete: () => {
          setIsPlaying(false);
          setPlaybackPosition(0);
        },
      });
    }
  }, [isPlaying, song, playbackPosition]);

  // Handle drag-to-seek on waveform
  const handleSeek = useCallback(
    async seconds => {
      setPlaybackPosition(seconds);
      if (isPlaying) {
        await seekTo(seconds);
      }
    },
    [isPlaying]
  );

  // Handle confirm - passes song as-is (audioPlayer defaults to full 30s)
  const handleConfirm = useCallback(async () => {
    await stopPreview();
    setIsPlaying(false);

    logger.info('ClipSelectionModal: Confirming song', {
      songId: song.id,
    });

    onConfirm(song);
  }, [song, onConfirm]);

  const handleCancel = useCallback(async () => {
    await stopPreview();
    setIsPlaying(false);
    onCancel();
  }, [onCancel]);

  if (!song) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleCancel}>
      <View style={styles.backdrop}>
        {/* Backdrop touchable - tap to dismiss back to song search */}
        <TouchableWithoutFeedback onPress={handleCancel}>
          <View style={styles.backdropTouchable} />
        </TouchableWithoutFeedback>

        {/* Content container - partial height at bottom, slides up */}
        <Animated.View
          style={[styles.contentContainer, { transform: [{ translateY: slideAnim }] }]}
        >
          <GestureHandlerRootView style={styles.gestureContainer}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                <PixelIcon name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Preview Clip</Text>
              <View style={styles.headerSpacer} />
            </View>

            {/* Song Info */}
            <View style={styles.songInfo}>
              <Image source={{ uri: song.albumArt }} style={styles.albumArt} contentFit="cover" />
              <View style={styles.songDetails}>
                <Text style={styles.songTitle} numberOfLines={2}>
                  {song.title}
                </Text>
                <Text style={styles.songArtist} numberOfLines={1}>
                  {song.artist}
                </Text>
              </View>
            </View>

            {/* Waveform Scrubber */}
            <View style={styles.waveformSection}>
              <WaveformScrubber
                songId={song.id}
                duration={PREVIEW_DURATION}
                currentTime={playbackPosition}
                onSeek={handleSeek}
                containerWidth={WAVEFORM_WIDTH}
              />
            </View>

            {/* Instructions */}
            <Text style={styles.instructions}>
              Drag across the waveform to scrub through the preview
            </Text>

            {/* Action Buttons */}
            <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + spacing.md }]}>
              {/* Preview Button */}
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.previewButton,
                  isPlaying && styles.previewButtonActive,
                ]}
                onPress={handlePreview}
              >
                <PixelIcon
                  name={isPlaying ? 'pause' : 'play'}
                  size={20}
                  color={isPlaying ? colors.brand.purple : colors.text.primary}
                />
                <Text style={[styles.buttonText, isPlaying && styles.buttonTextActive]}>
                  {isPlaying ? 'Stop' : 'Preview'}
                </Text>
              </TouchableOpacity>

              {/* Confirm Button */}
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleConfirm}
              >
                <Text style={styles.buttonText}>Use This Song</Text>
              </TouchableOpacity>
            </View>
          </GestureHandlerRootView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    flex: 1, // Takes up space above content
  },
  contentContainer: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: layout.borderRadius.xl,
    borderTopRightRadius: layout.borderRadius.xl,
    paddingTop: spacing.xs,
  },
  gestureContainer: {
    flex: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  closeButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },
  songInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  albumArt: {
    width: layout.dimensions.avatarXLarge,
    height: layout.dimensions.avatarXLarge,
    borderRadius: layout.borderRadius.sm,
    backgroundColor: colors.background.secondary,
  },
  songDetails: {
    flex: 1,
    marginLeft: spacing.md,
  },
  songTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  songArtist: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  waveformSection: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  instructions: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginHorizontal: spacing.xl,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: layout.borderRadius.md,
    gap: spacing.xs,
  },
  previewButton: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  previewButtonActive: {
    borderColor: colors.brand.purple,
    backgroundColor: colors.background.secondary,
  },
  confirmButton: {
    backgroundColor: colors.brand.purple,
  },
  buttonText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
    flexShrink: 1,
  },
  buttonTextActive: {
    color: colors.brand.purple,
  },
});

export default ClipSelectionModal;
