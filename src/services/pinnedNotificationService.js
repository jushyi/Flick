/**
 * Pinned Notification Service
 *
 * Manages pinned snap notification lifecycle on the recipient side:
 * - Track pinned snaps on receipt (for re-delivery checks)
 * - Dismiss notification when snap is viewed
 * - Re-deliver notifications for unviewed pinned snaps on app foreground
 *
 * iOS-only — all functions no-op on Android via Platform guards.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

import logger from '../utils/logger';

const STORAGE_KEY = 'pinned_snaps_active';

/**
 * Dismiss the notification for a pinned snap after the user views it.
 * Matches presented notifications by pinnedActivityId in data payload.
 * Best-effort — errors are logged but not thrown.
 *
 * @param {string} pinnedActivityId - The pinned activity ID to match
 */
export const dismissPinnedSnapNotification = async pinnedActivityId => {
  if (Platform.OS !== 'ios' || !pinnedActivityId) return;

  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    const matching = presented.filter(
      n => n.request.content.data?.pinnedActivityId === pinnedActivityId
    );

    for (const n of matching) {
      await Notifications.dismissNotificationAsync(n.request.identifier);
    }

    if (matching.length > 0) {
      logger.info('pinnedNotificationService: Dismissed pinned snap notifications', {
        pinnedActivityId,
        count: matching.length,
      });
    }

    // Clear from tracking list
    await clearPinnedSnap(pinnedActivityId);
  } catch (error) {
    logger.warn('pinnedNotificationService: Failed to dismiss pinned notification', {
      pinnedActivityId,
      error: error.message,
    });
  }
};

/**
 * Track a pinned snap in local storage for re-delivery checks.
 * Called when a pinned snap notification is received.
 * Deduplicates by pinnedActivityId.
 *
 * @param {string} pinnedActivityId - The pinned activity ID
 * @param {object} metadata - { conversationId, senderName, caption, pinnedThumbnailUrl }
 */
export const trackPinnedSnap = async (pinnedActivityId, metadata) => {
  if (Platform.OS !== 'ios' || !pinnedActivityId) return;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];

    // Deduplicate by pinnedActivityId
    const exists = list.some(item => item.pinnedActivityId === pinnedActivityId);
    if (exists) return;

    list.push({
      pinnedActivityId,
      conversationId: metadata?.conversationId || '',
      senderName: metadata?.senderName || '',
      caption: metadata?.caption || '',
      pinnedThumbnailUrl: metadata?.pinnedThumbnailUrl || '',
      trackedAt: new Date().toISOString(),
    });

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));

    logger.debug('pinnedNotificationService: Tracked pinned snap', { pinnedActivityId });
  } catch (error) {
    logger.warn('pinnedNotificationService: Failed to track pinned snap', {
      pinnedActivityId,
      error: error.message,
    });
  }
};

/**
 * Remove a pinned snap from the local tracking list.
 * Called after successful notification dismissal.
 *
 * @param {string} pinnedActivityId - The pinned activity ID to remove
 */
export const clearPinnedSnap = async pinnedActivityId => {
  if (Platform.OS !== 'ios' || !pinnedActivityId) return;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const list = JSON.parse(raw);
    const filtered = list.filter(item => item.pinnedActivityId !== pinnedActivityId);

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

    logger.debug('pinnedNotificationService: Cleared pinned snap from tracking', {
      pinnedActivityId,
    });
  } catch (error) {
    logger.warn('pinnedNotificationService: Failed to clear pinned snap', {
      pinnedActivityId,
      error: error.message,
    });
  }
};

/**
 * Check for tracked pinned snaps whose notifications were swiped away
 * and re-deliver them as local notifications.
 * Called on app foreground transition.
 * Best-effort — errors are logged but not thrown.
 */
export const checkAndRedeliverPinnedSnaps = async () => {
  if (Platform.OS !== 'ios') return;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const list = JSON.parse(raw);
    if (list.length === 0) return;

    // Get currently presented notifications
    const presented = await Notifications.getPresentedNotificationsAsync();
    const presentedIds = new Set(
      presented.map(n => n.request.content.data?.pinnedActivityId).filter(Boolean)
    );

    // Find tracked snaps missing from presented notifications
    const missing = list.filter(snap => !presentedIds.has(snap.pinnedActivityId));

    if (missing.length === 0) return;

    // Re-deliver each missing notification
    for (const snap of missing) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: snap.senderName,
          body: snap.caption || '',
          data: {
            type: 'snap',
            conversationId: snap.conversationId,
            pinnedActivityId: snap.pinnedActivityId,
            pinned: 'true',
          },
        },
        trigger: null, // Deliver immediately
      });
    }

    logger.info('pinnedNotificationService: Re-delivered pinned snap notifications', {
      count: missing.length,
    });
  } catch (error) {
    logger.warn('pinnedNotificationService: Failed to re-deliver pinned notifications', {
      error: error.message,
    });
  }
};
