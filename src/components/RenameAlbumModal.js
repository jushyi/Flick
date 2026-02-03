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
      // Slide up with spring animation
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
      return; // Don't save empty names
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 24,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.icon.inactive,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    backgroundColor: colors.background.tertiary,
    color: colors.text.primary,
    fontSize: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  charCount: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 24,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  saveButton: {
    backgroundColor: colors.brand.purple,
  },
  saveButtonDisabled: {
    backgroundColor: colors.icon.inactive,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  saveTextDisabled: {
    color: colors.text.secondary,
  },
});

export default RenameAlbumModal;
