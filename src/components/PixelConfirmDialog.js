/**
 * PixelConfirmDialog - Retro 16-bit confirmation modal
 *
 * Custom pixel-themed dialog replacing native Alert.alert.
 * Dark navy background, Silkscreen font, bordered buttons.
 *
 * Props:
 * - visible: boolean
 * - title: dialog title (e.g., "Delete Message")
 * - message: dialog body text
 * - confirmText: confirm button label (e.g., "Delete")
 * - cancelText: cancel button label (default "Cancel")
 * - onConfirm: callback when confirmed
 * - onCancel: callback when cancelled
 * - destructive: boolean, if true confirm button is red/warning colored
 */
import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet, useWindowDimensions } from 'react-native';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

const PixelConfirmDialog = ({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  destructive = false,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const dialogWidth = Math.min(screenWidth * 0.8, 300);

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.dialog, { width: dialogWidth }]}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.buttonRow}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.cancelText}>{cancelText}</Text>
            </Pressable>
            <View style={styles.buttonDivider} />
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                styles.confirmButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={[styles.confirmText, destructive && styles.destructiveText]}>
                {confirmText}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    backgroundColor: '#1A1A2E',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  title: {
    fontFamily: typography.fontFamily.body,
    fontSize: 16,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontFamily: typography.fontFamily.body,
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: -20,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  buttonDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  cancelButton: {
    borderBottomLeftRadius: 8,
  },
  confirmButton: {
    borderBottomRightRadius: 8,
  },
  cancelText: {
    fontFamily: typography.fontFamily.body,
    fontSize: 13,
    color: colors.text.secondary,
  },
  confirmText: {
    fontFamily: typography.fontFamily.body,
    fontSize: 13,
    color: colors.interactive.primary,
  },
  destructiveText: {
    color: colors.status.danger,
  },
});

export default PixelConfirmDialog;
