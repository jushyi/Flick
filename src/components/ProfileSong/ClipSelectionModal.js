/**
 * ClipSelectionModal Component
 *
 * Modal for selecting a clip range from a song preview.
 * Features:
 * - Song info display (album art, title, artist)
 * - Waveform scrubber for range selection
 * - Preview button to hear selected clip
 * - Confirm button to save selection
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from '../../constants/colors';
import { playPreview, stopPreview } from '../../services/audioPlayer';
import { downloadForWaveform } from '../../services/audioDownloader';
import WaveformScrubber from './WaveformScrubber';
import logger from '../../utils/logger';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WAVEFORM_WIDTH = SCREEN_WIDTH - 64;
const PREVIEW_DURATION = 30; // iTunes preview duration

const ClipSelectionModal = ({ visible, song, onConfirm, onCancel }) => {
  const insets = useSafeAreaInsets();

  // State
  const [audioPath, setAudioPath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(PREVIEW_DURATION);
  const [isPlaying, setIsPlaying] = useState(false);

  // Download audio when modal opens
  useEffect(() => {
    if (visible && song) {
      setLoading(true);
      setError(null);
      setAudioPath(null);
      setClipStart(song.clipStart ?? 0);
      setClipEnd(song.clipEnd ?? PREVIEW_DURATION);
      setIsPlaying(false);

      downloadForWaveform(song.previewUrl, song.id)
        .then(path => {
          logger.info('ClipSelectionModal: Audio downloaded', { path });
          setAudioPath(path);
          setLoading(false);
        })
        .catch(err => {
          logger.error('ClipSelectionModal: Download failed', { error: err.message });
          setError('Could not load audio preview');
          setLoading(false);
        });
    }

    // Cleanup on close
    if (!visible) {
      stopPreview();
      setIsPlaying(false);
    }
  }, [visible, song]);

  // Handle range change from waveform scrubber
  const handleRangeChange = useCallback((start, end) => {
    setClipStart(start);
    setClipEnd(end);
  }, []);

  // Handle preview button
  const handlePreview = useCallback(async () => {
    if (isPlaying) {
      await stopPreview();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      await playPreview(song.previewUrl, {
        clipStart,
        clipEnd,
        onComplete: () => {
          setIsPlaying(false);
        },
      });
    }
  }, [isPlaying, song, clipStart, clipEnd]);

  // Handle confirm
  const handleConfirm = useCallback(async () => {
    await stopPreview();
    setIsPlaying(false);

    const songWithClip = {
      ...song,
      clipStart,
      clipEnd,
    };

    logger.info('ClipSelectionModal: Confirming clip', {
      songId: song.id,
      clipStart,
      clipEnd,
    });

    onConfirm(songWithClip);
  }, [song, clipStart, clipEnd, onConfirm]);

  // Handle cancel
  const handleCancel = useCallback(async () => {
    await stopPreview();
    setIsPlaying(false);
    onCancel();
  }, [onCancel]);

  if (!song) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleCancel}
    >
      <GestureHandlerRootView style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Your Clip</Text>
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

        {/* Waveform Section */}
        <View style={styles.waveformSection}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.brand.purple} />
              <Text style={styles.loadingText}>Loading waveform...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={48} color={colors.text.tertiary} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : audioPath ? (
            <WaveformScrubber
              audioPath={audioPath}
              initialStart={clipStart}
              initialEnd={clipEnd}
              duration={PREVIEW_DURATION}
              onRangeChange={handleRangeChange}
              containerWidth={WAVEFORM_WIDTH}
            />
          ) : null}
        </View>

        {/* Instructions */}
        <Text style={styles.instructions}>
          Drag the handles to select which part of the song plays on your profile
        </Text>

        {/* Action Buttons */}
        <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 16 }]}>
          {/* Preview Button */}
          <TouchableOpacity
            style={[styles.button, styles.previewButton, isPlaying && styles.previewButtonActive]}
            onPress={handlePreview}
            disabled={loading || !!error}
          >
            <Ionicons
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
            disabled={loading || !!error}
          >
            <Ionicons name="checkmark" size={20} color={colors.text.primary} />
            <Text style={styles.buttonText}>Use This Clip</Text>
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
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
  songInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  albumArt: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.background.secondary,
  },
  songDetails: {
    flex: 1,
    marginLeft: 16,
  },
  songTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  songArtist: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  waveformSection: {
    marginHorizontal: 32,
    marginTop: 20,
    minHeight: 120,
    justifyContent: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.secondary,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.tertiary,
  },
  instructions: {
    fontSize: 13,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: 16,
    marginHorizontal: 32,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 24,
    marginTop: 'auto',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
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
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  buttonTextActive: {
    color: colors.brand.purple,
  },
});

export default ClipSelectionModal;
