/**
 * DMInput Component
 *
 * Message input bar for DM conversations with:
 * - TextInput with multiline support (up to 4 lines visible)
 * - GIF button for Giphy integration
 * - Send button (visible only when there's text)
 * - Disabled state for read-only conversations (unfriended)
 * - Safe area bottom padding for edge-to-edge Android
 *
 * Intentionally separate from CommentInput — DM input will
 * diverge over time with DM-specific features.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Platform,
  Keyboard,
  StyleSheet,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { openGifPicker, useGifSelection } from './comments/GifPicker';

import PixelIcon from './PixelIcon';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

const MAX_LENGTH = 2000;

const DMInput = ({ onSendMessage, onSend, disabled = false, placeholder = 'Message...' }) => {
  const [text, setText] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
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

  const handleGifSelected = useCallback(
    gifUrl => {
      if (onSendMessage) {
        onSendMessage(null, gifUrl);
      }
      onSend?.();
    },
    [onSendMessage, onSend]
  );

  useGifSelection(handleGifSelected);

  const handleGifPress = useCallback(() => {
    openGifPicker();
  }, []);

  const handleSend = useCallback(() => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    if (onSendMessage) {
      onSendMessage(trimmedText, null);
    }
    setText('');
    onSend?.();
  }, [text, onSendMessage, onSend]);

  const handleSubmitEditing = useCallback(() => {
    handleSend();
  }, [handleSend]);

  const hasText = text.trim().length > 0;

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
      <View style={styles.inputRow}>
        {/* GIF Button */}
        <TouchableOpacity style={styles.gifButton} onPress={handleGifPress}>
          <Text style={styles.gifButtonText}>GIF</Text>
        </TouchableOpacity>

        {/* Text Input */}
        <View style={styles.inputWrapper}>
          <TextInput
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
        </View>

        {/* Send Button */}
        {hasText && (
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <PixelIcon name="arrow-up" size={20} color={colors.interactive.primary} />
          </TouchableOpacity>
        )}
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
  gifButton: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
  },
  gifButtonText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: typography.fontFamily.bodyBold,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 8, android: 4 }),
  },
  textInput: {
    color: colors.text.primary,
    fontSize: 14,
    fontFamily: typography.fontFamily.readable,
    maxHeight: 100,
    paddingTop: Platform.select({ ios: 0, android: 4 }),
    paddingBottom: Platform.select({ ios: 0, android: 4 }),
  },
  sendButton: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
    borderRadius: 2,
    padding: 8,
    marginLeft: 8,
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
