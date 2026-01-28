/**
 * ClipSelectionModal Component
 *
 * Modal for previewing a song before saving to profile.
 * Features:
 * - Song info display (album art, title, artist)
 * - Preview button to hear 30-second clip
 * - Confirm button to save selection
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { playPreview, stopPreview } from '../../services/audioPlayer';
import logger from '../../utils/logger';

const ClipSelectionModal = ({ visible, song, onConfirm, onCancel }) => {
  const insets = useSafeAreaInsets();

  // State
  const [isPlaying, setIsPlaying] = useState(false);

  // Reset state when song changes or modal opens
  useEffect(() => {
    if (visible && song) {
      setIsPlaying(false);
    }

    // Cleanup on close
    if (!visible) {
      stopPreview();
      setIsPlaying(false);
    }
  }, [visible, song]);

  // Handle preview button - plays full 30s preview
  const handlePreview = useCallback(async () => {
    if (isPlaying) {
      await stopPreview();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      await playPreview(song.previewUrl, {
        onComplete: () => {
          setIsPlaying(false);
        },
      });
    }
  }, [isPlaying, song]);

  // Handle confirm - passes song as-is (audioPlayer defaults to full 30s)
  const handleConfirm = useCallback(async () => {
    await stopPreview();
    setIsPlaying(false);

    logger.info('ClipSelectionModal: Confirming song', {
      songId: song.id,
    });

    onConfirm(song);
  }, [song, onConfirm]);

  // Handle cancel
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

        {/* Content container - partial height at bottom */}
        <View style={styles.contentContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
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

          {/* Instructions */}
          <Text style={styles.instructions}>
            Preview the 30-second clip that will play on your profile
          </Text>

          {/* Action Buttons */}
          <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 16 }]}>
            {/* Preview Button */}
            <TouchableOpacity
              style={[styles.button, styles.previewButton, isPlaying && styles.previewButtonActive]}
              onPress={handlePreview}
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
            <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={handleConfirm}>
              <Ionicons name="checkmark" size={20} color={colors.text.primary} />
              <Text style={styles.buttonText}>Use This Song</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    flex: 1, // Takes up space above content
  },
  contentContainer: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
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
    paddingTop: 16,
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
