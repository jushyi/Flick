/**
 * CommentInput Component
 *
 * Text input for adding comments with:
 * - TextInput with multiline support
 * - Image picker button for media comments
 * - GIF button for Giphy integration
 * - Media preview with remove button
 * - Send button (disabled when empty)
 * - Reply banner showing "Replying to @name" with cancel
 * - forwardRef for external focus control
 */
import React, { useState, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../constants/colors';
import logger from '../../utils/logger';
import { uploadCommentImage } from '../../services/firebase/storageService';
// Note: Giphy SDK requires dev client build, not Expo Go
import { openGifPicker, useGifSelection } from './GifPicker';
import { styles } from '../../styles/CommentInput.styles';

/**
 * CommentInput Component
 *
 * @param {function} onSubmit - Callback with (text, mediaUrl, mediaType) when sent
 * @param {object} replyingTo - Comment object if replying (shows "Replying to @name")
 * @param {function} onCancelReply - Callback to cancel reply mode
 * @param {string} placeholder - Custom placeholder text
 * @param {boolean} autoFocus - Whether to auto-focus input
 * @param {ref} ref - Ref forwarded to TextInput for external focus control
 */
const CommentInput = forwardRef(
  (
    {
      onSubmit,
      replyingTo = null,
      onCancelReply,
      placeholder = 'Add a comment...',
      autoFocus = false,
    },
    ref
  ) => {
    const [text, setText] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState(null); // { uri, type: 'image' | 'gif' }
    const [isUploading, setIsUploading] = useState(false);
    const inputRef = useRef(null);

    // Note: GIF functionality disabled for Expo Go compatibility
    // Uncomment when using dev client build:
    const handleGifSelected = useCallback(gifUrl => {
      logger.info('CommentInput: GIF selected', { urlLength: gifUrl?.length });
      setSelectedMedia({ uri: gifUrl, type: 'gif' });
    }, []);
    useGifSelection(handleGifSelected);
    const handleGifPick = useCallback(() => {
      logger.info('CommentInput: GIF picker pressed');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      openGifPicker();
    }, []);

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      focus: () => {
        logger.debug('CommentInput: Focus called via ref');
        inputRef.current?.focus();
      },
      blur: () => {
        logger.debug('CommentInput: Blur called via ref');
        inputRef.current?.blur();
      },
      clear: () => {
        logger.debug('CommentInput: Clear called via ref');
        setText('');
        setSelectedMedia(null);
      },
      setMedia: media => {
        logger.debug('CommentInput: setMedia called via ref', { mediaType: media?.type });
        setSelectedMedia(media);
      },
    }));

    /**
     * Handle text change
     */
    const handleChangeText = useCallback(newText => {
      setText(newText);
    }, []);

    /**
     * Clear selected media
     */
    const clearMedia = useCallback(() => {
      logger.debug('CommentInput: Clearing media');
      setSelectedMedia(null);
    }, []);

    /**
     * Handle image picker button press
     */
    const handleImagePick = useCallback(async () => {
      logger.info('CommentInput: Image picker pressed');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        // Request permission
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permissionResult.granted) {
          Alert.alert('Permission Required', 'Please grant camera roll access to attach images.');
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1], // Square crop for thumbnails
          quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
          logger.info('CommentInput: Image selected', {
            width: result.assets[0].width,
            height: result.assets[0].height,
          });
          setSelectedMedia({ uri: result.assets[0].uri, type: 'image' });
        }
      } catch (error) {
        logger.error('CommentInput: Image picker error', { error: error.message });
        Alert.alert('Error', 'Failed to pick image. Please try again.');
      }
    }, []);

    /**
     * Handle send button press
     */
    const handleSend = useCallback(async () => {
      const trimmedText = text.trim();
      if (!trimmedText && !selectedMedia) {
        logger.debug('CommentInput: Send blocked - empty text and no media');
        return;
      }

      logger.info('CommentInput: Sending comment', {
        textLength: trimmedText.length,
        hasMedia: !!selectedMedia,
        mediaType: selectedMedia?.type,
        isReply: !!replyingTo,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      let mediaUrl = null;
      let mediaType = null;

      if (selectedMedia) {
        try {
          setIsUploading(true);

          if (selectedMedia.type === 'image') {
            // Upload image to Firebase Storage
            logger.debug('CommentInput: Uploading image');
            mediaUrl = await uploadCommentImage(selectedMedia.uri);
            mediaType = 'image';
            logger.info('CommentInput: Image uploaded', { mediaUrl: mediaUrl?.substring(0, 50) });
          } else if (selectedMedia.type === 'gif') {
            // GIF URL is already a remote URL from Giphy
            mediaUrl = selectedMedia.uri;
            mediaType = 'gif';
          }
        } catch (error) {
          logger.error('CommentInput: Media upload failed', { error: error.message });
          Alert.alert('Upload Failed', 'Failed to upload media. Please try again.');
          setIsUploading(false);
          return;
        } finally {
          setIsUploading(false);
        }
      }

      if (onSubmit) {
        onSubmit(trimmedText, mediaUrl, mediaType);
      }

      // Clear text and media after submit
      setText('');
      setSelectedMedia(null);
    }, [text, selectedMedia, replyingTo, onSubmit]);

    /**
     * Handle cancel reply
     */
    const handleCancelReply = useCallback(() => {
      logger.info('CommentInput: Cancel reply pressed');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (onCancelReply) {
        onCancelReply();
      }
    }, [onCancelReply]);

    /**
     * Handle submit on keyboard return
     */
    const handleSubmitEditing = useCallback(() => {
      if (text.trim() || selectedMedia) {
        handleSend();
      }
    }, [text, selectedMedia, handleSend]);

    const canSubmit = !!(text.trim() || selectedMedia);
    const isDisabled = !canSubmit || isUploading;
    const replyUsername = replyingTo?.user?.username || replyingTo?.user?.displayName || 'user';

    return (
      <View style={styles.container}>
        {/* Reply Banner - shown when replying to a comment */}
        {replyingTo && (
          <View style={styles.replyBanner}>
            <Text style={styles.replyBannerText}>
              Replying to <Text style={styles.replyBannerUsername}>@{replyUsername}</Text>
            </Text>
            <TouchableOpacity style={styles.replyBannerCancel} onPress={handleCancelReply}>
              <Ionicons name="close" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Media Preview - shown when media is selected */}
        {selectedMedia && (
          <View style={styles.mediaPreviewContainer}>
            <Image
              source={{ uri: selectedMedia.uri }}
              style={styles.mediaPreview}
              contentFit="cover"
            />
            <TouchableOpacity onPress={clearMedia} style={styles.removeMediaButton}>
              <View style={styles.removeMediaButtonBg}>
                <Ionicons name="close" size={14} color="white" />
              </View>
            </TouchableOpacity>
            {selectedMedia.type === 'gif' && (
              <View style={styles.gifBadge}>
                <Text style={styles.gifBadgeText}>GIF</Text>
              </View>
            )}
          </View>
        )}

        {/* Input Row */}
        <View style={styles.inputRow}>
          {/* Input Wrapper with rounded background */}
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder={placeholder}
              placeholderTextColor={colors.text.tertiary}
              value={text}
              onChangeText={handleChangeText}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              multiline
              maxLength={1000}
              returnKeyType="send"
              blurOnSubmit={true}
              onSubmitEditing={handleSubmitEditing}
              autoFocus={autoFocus}
              keyboardAppearance="dark"
            />

            {/* Image Picker Button */}
            <TouchableOpacity
              style={styles.imageButton}
              onPress={handleImagePick}
              disabled={isUploading}
            >
              <Ionicons
                name="image-outline"
                size={22}
                color={isUploading ? colors.text.tertiary : colors.text.secondary}
              />
            </TouchableOpacity>

            {/* GIF Picker Button - disabled for Expo Go, enable in dev client */}
            {
              <TouchableOpacity
                style={styles.gifButton}
                onPress={handleGifPick}
                disabled={isUploading}
              >
                <Text style={[styles.gifButtonText, isUploading && styles.gifButtonTextDisabled]}>
                  GIF
                </Text>
              </TouchableOpacity>
            }
          </View>

          {/* Send Button */}
          <TouchableOpacity
            style={[styles.sendButton, isDisabled && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={isDisabled}
          >
            {isUploading ? (
              <Text style={styles.uploadingText}>...</Text>
            ) : (
              <Ionicons
                name="arrow-up"
                size={20}
                color={isDisabled ? colors.text.tertiary : colors.text.primary}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);

CommentInput.displayName = 'CommentInput';

export default CommentInput;
