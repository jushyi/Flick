import { requireNativeModule, Platform } from 'expo-modules-core';

// The native module is only available on iOS
const LiveActivityManager =
  Platform.OS === 'ios' ? requireNativeModule('LiveActivityManager') : null;

/**
 * Start a Live Activity for a pinned snap.
 *
 * @param activityId - Unique identifier for the activity (usually the message ID)
 * @param senderName - Display name of the sender
 * @param caption - Optional caption text (snap message text)
 * @param deepLinkUrl - URL to open when the Live Activity is tapped
 * @param thumbnailUri - Local file URI for the snap thumbnail
 * @returns The native activity ID string, or null if not supported
 */
export async function startActivity(
  activityId: string,
  senderName: string,
  caption: string | null,
  deepLinkUrl: string,
  thumbnailUri: string
): Promise<string | null> {
  if (!LiveActivityManager) return null;
  return LiveActivityManager.startActivity(
    activityId,
    senderName,
    caption,
    deepLinkUrl,
    thumbnailUri
  );
}

/**
 * End a specific Live Activity by its activity ID.
 *
 * @param activityId - The activity ID used when starting the activity
 */
export async function endActivity(activityId: string): Promise<void> {
  if (!LiveActivityManager) return;
  return LiveActivityManager.endActivity(activityId);
}

/**
 * End all active pinned snap Live Activities.
 */
export async function endAllActivities(): Promise<void> {
  if (!LiveActivityManager) return;
  return LiveActivityManager.endAllActivities();
}

/**
 * Get the count of currently active pinned snap Live Activities.
 *
 * @returns The number of active activities, or 0 if not supported
 */
export async function getActiveCount(): Promise<number> {
  if (!LiveActivityManager) return 0;
  return LiveActivityManager.getActiveCount();
}

export default {
  startActivity,
  endActivity,
  endAllActivities,
  getActiveCount,
};
