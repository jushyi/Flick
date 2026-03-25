import React from 'react';
import Toast, { BaseToast, BaseToastProps } from 'react-native-toast-message';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

/**
 * Custom toast configuration for pixel-art styled error notifications.
 * Used with react-native-toast-message. Placed in App.js (wired in Plan 04).
 */
export const toastConfig = {
  error: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: colors.status.danger,
        borderLeftWidth: 4,
        backgroundColor: colors.background.secondary,
      }}
      text1Style={{
        color: colors.text.primary,
        fontFamily: typography.fontFamily.readable,
        fontSize: typography.size.md,
      }}
      text1NumberOfLines={1}
    />
  ),
};

/**
 * Toast component to be placed at the root of the app.
 * Position: bottom, offset 100px from bottom, visible for 2 seconds.
 */
export default function AppToast() {
  return (
    <Toast
      config={toastConfig}
      position="bottom"
      bottomOffset={100}
      visibilityTime={2000}
    />
  );
}
