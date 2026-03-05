import { requireNativeModule, Platform } from 'expo-modules-core';

// The native module is iOS-only. On Android, all functions return safe defaults.
const isIOS = Platform.OS === 'ios';

interface LiveActivityManagerInterface {
  startActivity(
    activityId: string,
    senderName: string,
    caption: string | null,
    deepLinkUrl: string,
    thumbnailUri: string
  ): Promise<string | null>;
  endActivity(activityId: string): Promise<void>;
  endAllActivities(): Promise<void>;
  getActiveCount(): Promise<number>;
  diagnose(): Promise<string>;
  getNSEDiagnostics(): Promise<string | null>;
  clearNSEDiagnostics(): Promise<void>;
}

let nativeModule: LiveActivityManagerInterface | null = null;

if (isIOS) {
  try {
    nativeModule = requireNativeModule('LiveActivityManager');
  } catch {
    // Native module not available (e.g., running in Expo Go or older iOS)
  }
}

/**
 * Start a pinned snap Live Activity on the iOS lock screen.
 *
 * @param activityId - Unique ID for this activity (usually the snap message ID)
 * @param senderName - Display name of the sender
 * @param caption - Optional caption text (snap message text, truncated)
 * @param deepLinkUrl - Deep link URL to open when tapped (e.g., lapse://messages/{conversationId})
 * @param thumbnailUri - Local file URI of the compressed thumbnail image
 * @returns The native activity ID string, or null if not supported
 */
export async function startActivity(
  activityId: string,
  senderName: string,
  caption: string | null,
  deepLinkUrl: string,
  thumbnailUri: string
): Promise<string | null> {
  if (!nativeModule) return null;
  return nativeModule.startActivity(activityId, senderName, caption, deepLinkUrl, thumbnailUri);
}

/**
 * End a specific Live Activity by its activity ID.
 *
 * @param activityId - The activity ID used when starting
 */
export async function endActivity(activityId: string): Promise<void> {
  if (!nativeModule) return;
  return nativeModule.endActivity(activityId);
}

/**
 * End all active pinned snap Live Activities.
 */
export async function endAllActivities(): Promise<void> {
  if (!nativeModule) return;
  return nativeModule.endAllActivities();
}

/**
 * Get the count of currently active pinned snap Live Activities.
 *
 * @returns Number of active activities, or 0 if not supported
 */
export async function getActiveCount(): Promise<number> {
  if (!nativeModule) return 0;
  return nativeModule.getActiveCount();
}

/**
 * Run diagnostics on Live Activity support.
 * Checks each prerequisite and attempts a test Activity.request().
 * Returns a multi-line diagnostic string.
 */
export async function diagnose(): Promise<string> {
  if (!nativeModule) return 'nativeModule is null — LiveActivityManager not loaded';
  return nativeModule.diagnose();
}

/**
 * Read NSE diagnostic logs written by the Notification Service Extension.
 * The NSE writes step-by-step diagnostics to App Groups so they can be
 * read from the main app without Console.app access.
 *
 * @returns Parsed diagnostic entries, or null if none exist
 */
export async function getNSEDiagnostics(): Promise<unknown[] | null> {
  if (!nativeModule) return null;
  const raw = await nativeModule.getNSEDiagnostics();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Clear NSE diagnostic logs.
 */
export async function clearNSEDiagnostics(): Promise<void> {
  if (!nativeModule) return;
  return nativeModule.clearNSEDiagnostics();
}
