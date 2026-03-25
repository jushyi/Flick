import * as Haptics from 'expo-haptics';

/**
 * Haptic Feedback Utilities
 * Provides consistent haptic feedback across the app
 */

/**
 * Light impact feedback - For subtle interactions
 * Use for: UI element taps, list item selections
 */
export const lightImpact = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

/**
 * Medium impact feedback - For standard interactions
 * Use for: Button presses, toggles, card taps
 */
export const mediumImpact = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

/**
 * Heavy impact feedback - For significant actions
 * Use for: Photo capture, important confirmations
 */
export const heavyImpact = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
};

/**
 * Success notification - For successful actions
 * Use for: Photo uploaded, friend request accepted, reaction added
 */
export const successNotification = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

/**
 * Warning notification - For warnings or cautions
 * Use for: Form validation errors, network issues
 */
export const warningNotification = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
};

/**
 * Error notification - For errors
 * Use for: Failed operations, deletions
 */
export const errorNotification = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
};

/**
 * Selection changed - For picker/selector changes
 * Use for: Reaction picker selection, tab switches
 */
export const selectionChanged = () => {
  Haptics.selectionAsync();
};

/**
 * Reaction haptic - Custom for emoji reactions
 * Combines selection change with light impact for satisfying feel
 */
export const reactionHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};
