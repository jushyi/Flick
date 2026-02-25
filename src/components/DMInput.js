/**
 * DMInput Component
 *
 * Message input bar for DM conversations with:
 * - TextInput with multiline support (up to 4 lines visible)
 * - Image picker button for photo messages
 * - GIF button for Giphy integration
 * - Media preview with remove button (unified for image + gif)
 * - Send button (visible when there's text or selected media)
 * - Disabled state for read-only conversations (unfriended)
 * - Safe area bottom padding for edge-to-edge Android
 *
 * Intentionally separate from CommentInput — DM input will
 * diverge over time with DM-specific features.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  Platform,
  Keyboard,
  StyleSheet,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { openGifPicker, useGifSelection } from './comments/GifPicker';

import PixelIcon from './PixelIcon';
import ReplyPreview from './ReplyPreview';

import { uploadCommentImage } from '../services/firebase/storageService';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

import logger from '../utils/logger';

const MAX_LENGTH = 2000;

const DMInput = ({
  onSendMessage,
  onSend,
  onOpenSnapCamera,
  disabled = false,
  placeholder = 'Message...',
  replyToMessage = null,
  replyToSenderName = '',
  onCancelReply,
}) => {
  const [text, setText] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null); // { uri, type: 'image' | 'gif' }
  const [isUploading, setIsUploading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const inputRef = useRef(null);
  const insets = useSafeAreaInsets();

  // Track keyboard visibility to adjust bottom padding per platform
  // iOS: keyboardWillShow/Hide fires before animation for smooth transitions
  // Android: keyboardDidShow/Hide (Android does not support keyboardWill* events)
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Auto-focus TextInput when reply mode activates
  useEffect(() => {
    if (replyToMessage && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyToMessage]);

  const handleGifSelected = useCallback(gifUrl => {
    logger.info('DMInput: GIF selected', { urlLength: gifUrl?.length });
    setSelectedMedia({ uri: gifUrl, type: 'gif' });
  }, []);

  useGifSelection(handleGifSelected);

  const handleGifPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openGifPicker();
  }, []);

  const handleImagePick = useCallback(async () => {
    logger.info('DMInput: Image picker pressed');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please grant camera roll access to attach images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        logger.info('DMInput: Image selected', {
          width: result.assets[0].width,
          height: result.assets[0].height,
        });
        setSelectedMedia({ uri: result.assets[0].uri, type: 'image' });
      }
    } catch (error) {
      logger.error('DMInput: Image picker error', { error: error.message });
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  }, []);

  const clearMedia = useCallback(() => {
    logger.debug('DMInput: Clearing media');
    setSelectedMedia(null);
  }, []);

  const handleSend = useCallback(async () => {
    const trimmedText = text.trim();
    if (!trimmedText && !selectedMedia) return;

    if (selectedMedia) {
      try {
        setIsUploading(true);

        if (selectedMedia.type === 'image') {
          // Upload image to Firebase Storage, then send as image message
          logger.debug('DMInput: Uploading image');
          const downloadUrl = await uploadCommentImage(selectedMedia.uri);
          logger.info('DMInput: Image uploaded', { urlLength: downloadUrl?.length });

          if (onSendMessage) {
            onSendMessage(null, null, downloadUrl);
          }
        } else if (selectedMedia.type === 'gif') {
          // GIF URL is already a remote URL from Giphy
          if (onSendMessage) {
            onSendMessage(null, selectedMedia.uri, null);
          }
        }
      } catch (error) {
        logger.error('DMInput: Media upload failed', { error: error.message });
        Alert.alert('Upload Failed', 'Failed to upload media. Please try again.');
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }

      setText('');
      setSelectedMedia(null);
      onSend?.();
      return;
    }

    // Text-only message
    if (onSendMessage) {
      onSendMessage(trimmedText, null, null);
    }
    setText('');
    onSend?.();
  }, [text, selectedMedia, onSendMessage, onSend]);

  const handleSubmitEditing = useCallback(() => {
    handleSend();
  }, [handleSend]);

  const canSend = text.trim().length > 0 || !!selectedMedia;

  // Crossfade animation between camera icon and send arrow
  // 0 = camera visible, 1 = send arrow visible
  const morphAnim = useRef(new Animated.Value(canSend ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(morphAnim, {
      toValue: canSend ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [canSend, morphAnim]);

  const bottomPadding = keyboardVisible
    ? Platform.OS === 'ios'
      ? 8
      : 7
    : Platform.OS === 'android'
      ? Math.max(insets.bottom + 3, 12)
      : Math.max(insets.bottom, 8);

  if (disabled) {
    return (
      <View style={[styles.container, { paddingBottom: bottomPadding }]}>
        <View style={styles.disabledContainer}>
          <Text style={styles.disabledText}>You can no longer message this person</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      {/* Reply Preview - shown when replying to a message */}
      {replyToMessage && (
        <ReplyPreview
          message={replyToMessage}
          senderName={replyToSenderName}
          onCancel={onCancelReply}
        />
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
              <PixelIcon name="close" size={14} color="white" />
            </View>
          </TouchableOpacity>
          {selectedMedia.type === 'gif' && (
            <View style={styles.gifBadge}>
              <Text style={styles.gifBadgeText}>GIF</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.inputRow}>
        {/* Input Wrapper with text input + image + GIF buttons inside */}
        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            placeholder={placeholder}
            placeholderTextColor={colors.text.secondary}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={MAX_LENGTH}
            numberOfLines={4}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleSubmitEditing}
            keyboardAppearance="dark"
          />

          {/* Image Picker Button */}
          <TouchableOpacity
            style={styles.imageButton}
            onPress={handleImagePick}
            disabled={isUploading}
          >
            <PixelIcon
              name="image-outline"
              size={22}
              color={isUploading ? colors.text.tertiary : colors.text.secondary}
            />
          </TouchableOpacity>

          {/* GIF Picker Button */}
          <TouchableOpacity
            style={styles.gifButton}
            onPress={handleGifPress}
            disabled={isUploading}
          >
            <Text style={[styles.gifButtonText, isUploading && styles.gifButtonTextDisabled]}>
              GIF
            </Text>
          </TouchableOpacity>
        </View>

        {/* Camera / Send Button — morphs between snap camera and send arrow */}
        {canSend ? (
          <Animated.View style={{ opacity: morphAnim, alignSelf: 'stretch' }}>
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSend}
              disabled={isUploading}
              testID="send-button"
            >
              {isUploading ? (
                <Text style={styles.uploadingText}>...</Text>
              ) : (
                <PixelIcon name="arrow-up" size={20} color={colors.interactive.primary} />
              )}
            </TouchableOpacity>
          </Animated.View>
        ) : !disabled && onOpenSnapCamera ? (
          <Animated.View style={{ opacity: Animated.subtract(1, morphAnim), alignSelf: 'stretch' }}>
            <TouchableOpacity
              style={styles.sendButton}
              onPress={onOpenSnapCamera}
              testID="camera-button"
            >
              <PixelIcon name="snap-polaroid" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 8, android: 4 }),
    minHeight: 36,
  },
  textInput: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: typography.fontFamily.readable,
    maxHeight: 100,
    paddingTop: Platform.select({ ios: 0, android: 4 }),
    paddingBottom: Platform.select({ ios: 0, android: 4 }),
  },
  imageButton: {
    paddingLeft: 8,
    paddingVertical: 2,
  },
  gifButton: {
    paddingLeft: 8,
    paddingVertical: 2,
  },
  gifButtonText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: typography.fontFamily.bodyBold,
  },
  gifButtonTextDisabled: {
    color: colors.text.tertiary,
  },
  sendButton: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  uploadingText: {
    color: colors.text.tertiary,
    fontSize: 14,
    fontFamily: typography.fontFamily.bodyBold,
  },
  // Media preview (above input row)
  mediaPreviewContainer: {
    position: 'relative',
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  mediaPreview: {
    width: 80,
    height: 80,
    borderRadius: 4,
  },
  removeMediaButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    zIndex: 1,
  },
  removeMediaButtonBg: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gifBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gifBadgeText: {
    color: colors.text.primary,
    fontSize: 10,
    fontFamily: typography.fontFamily.bodyBold,
  },
  disabledContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  disabledText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: typography.fontFamily.body,
  },
});

export default DMInput;
