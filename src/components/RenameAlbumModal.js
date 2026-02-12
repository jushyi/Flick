import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';

const MAX_ALBUM_NAME_LENGTH = 24;

/**
 * RenameAlbumModal - Half-screen modal for renaming albums
 *
 * @param {boolean} visible - Whether the modal is visible
 * @param {string} currentName - Current album name to pre-fill input
 * @param {function} onClose - Callback to close the modal
 * @param {function} onSave - Callback(newName) when save is pressed
 */
const RenameAlbumModal = ({ visible, currentName = '', onClose, onSave }) => {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(currentName);
  const slideAnim = useRef(new Animated.Value(300)).current;

  // Reset name when modal opens with new currentName
  useEffect(() => {
    if (visible) {
      setName(currentName);
    }
  }, [visible, currentName]);

  // Animate content slide when visibility changes
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 15,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
    } else {
      // Reset position for next open
      slideAnim.setValue(300);
    }
  }, [visible, slideAnim]);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return;
    }
    onSave?.(trimmedName);
    onClose?.();
  };

  const handleCancel = () => {
    Keyboard.dismiss();
    onClose?.();
  };

  const isValidName = name.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleCancel}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}
              onPress={e => e.stopPropagation()}
            >
              <View style={styles.handle} />

              <Text style={styles.title}>Rename Album</Text>

              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Album name"
                placeholderTextColor={colors.text.tertiary}
                autoFocus
                maxLength={MAX_ALBUM_NAME_LENGTH}
                returnKeyType="done"
                onSubmitEditing={handleSave}
                selectionColor={colors.brand.purple}
              />

              <Text style={styles.charCount}>
                {name.length}/{MAX_ALBUM_NAME_LENGTH}
              </Text>

              <View style={styles.buttons}>
                <TouchableOpacity onPress={handleCancel} style={styles.button} activeOpacity={0.7}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSave}
                  style={[
                    styles.button,
                    styles.saveButton,
                    !isValidName && styles.saveButtonDisabled,
                  ]}
                  disabled={!isValidName}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.saveText, !isValidName && styles.saveTextDisabled]}>
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: layout.borderRadius.xl,
    borderTopRightRadius: layout.borderRadius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.icon.inactive,
    borderRadius: layout.borderRadius.sm,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: colors.background.tertiary,
    color: colors.text.primary,
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: layout.borderRadius.md,
  },
  charCount: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    textAlign: 'right',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: layout.borderRadius.md,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
  },
  saveButton: {
    backgroundColor: colors.brand.purple,
  },
  saveButtonDisabled: {
    backgroundColor: colors.icon.inactive,
  },
  saveText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  saveTextDisabled: {
    color: colors.text.secondary,
  },
});

export default RenameAlbumModal;
