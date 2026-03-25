import * as Haptics from 'expo-haptics';

export const lightImpact = (): void => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export const mediumImpact = (): void => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

export const heavyImpact = (): void => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
};

export const successNotification = (): void => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

export const warningNotification = (): void => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
};

export const errorNotification = (): void => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
};

export const selectionChanged = (): void => {
  Haptics.selectionAsync();
};

export const reactionHaptic = (): void => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};
