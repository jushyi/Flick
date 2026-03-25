import { Platform } from 'react-native';

import { NativeModulesProxy, EventEmitter } from 'expo-modules-core';
import * as Notifications from 'expo-notifications';

import { supabase } from '../lib/supabase';
import logger from '../utils/logger';

interface LiveActivityModule {
  startActivity: (
    activityId: string,
    senderName: string,
    caption: string | null,
    deepLinkUrl: string,
    thumbnailUri: string
  ) => Promise<string | null>;
  removeFromStack: (snapActivityId: string) => Promise<void>;
  endActivity: (activityId: string) => Promise<void>;
  endAllActivities: () => Promise<void>;
  getActiveActivityIds: () => Promise<string[]>;
  observePushToStartToken: () => Promise<void>;
  getPushToStartToken: () => Promise<string | null>;
}

interface ServiceResult {
  success: boolean;
  error?: string;
}

interface StartActivityResult extends ServiceResult {
  nativeActivityId?: string | null;
}

interface StartActivityParams {
  activityId: string;
  senderName: string;
  caption: string | null;
  conversationId: string;
  friendId: string;
  thumbnailUri: string;
}

let LiveActivityManager: LiveActivityModule | null = null;
if (Platform.OS === 'ios') {
  try {
    LiveActivityManager = require('../../modules/live-activity-manager') as LiveActivityModule;
  } catch (e) {
    const err = e as Error;
    logger.warn('liveActivityService: Native module not available', { error: err.message });
  }
}

export const startPinnedSnapActivity = async ({
  activityId,
  senderName,
  caption,
  conversationId,
  thumbnailUri,
}: StartActivityParams): Promise<StartActivityResult> => {
  logger.info('liveActivityService: DEBUG module check', {
    hasManager: !!LiveActivityManager,
    managerKeys: LiveActivityManager ? Object.keys(LiveActivityManager) : [],
    hasStartActivity: LiveActivityManager ? typeof LiveActivityManager.startActivity : 'N/A',
  });

  if (Platform.OS !== 'ios' || !LiveActivityManager) {
    logger.error('liveActivityService: NOT SUPPORTED', {
      platform: Platform.OS,
      hasManager: !!LiveActivityManager,
    });
    return { success: false, error: 'Not supported' };
  }

  try {
    const deepLinkUrl = `lapse://messages/${conversationId}`;

    logger.info('liveActivityService: Calling native startActivity', {
      activityId,
      senderName,
      deepLinkUrl,
      thumbnailUri: thumbnailUri ? 'present' : 'empty',
    });

    const nativeActivityId = await LiveActivityManager.startActivity(
      activityId,
      senderName,
      caption || null,
      deepLinkUrl,
      thumbnailUri
    );

    logger.info('liveActivityService: Native returned', {
      activityId,
      nativeActivityId,
      type: typeof nativeActivityId,
    });

    return { success: true, nativeActivityId };
  } catch (err) {
    const error = err as Error & { code?: string };
    logger.error('liveActivityService: NATIVE THREW ERROR', {
      activityId,
      error: error.message,
      code: error.code,
      full: String(error),
    });
    return { success: false, error: error.message };
  }
};

export const removePinnedSnap = async (snapActivityId: string): Promise<ServiceResult> => {
  if (Platform.OS !== 'ios' || !LiveActivityManager) {
    return { success: false, error: 'Not supported' };
  }

  try {
    await LiveActivityManager.removeFromStack(snapActivityId);
    logger.info('liveActivityService: Removed snap from stack', { snapActivityId });
    return { success: true };
  } catch (err) {
    const error = err as Error;
    logger.error('liveActivityService: Failed to remove snap from stack', {
      snapActivityId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

export const endPinnedSnapActivity = async (activityId: string): Promise<ServiceResult> => {
  if (Platform.OS !== 'ios' || !LiveActivityManager) {
    return { success: false, error: 'Not supported' };
  }

  try {
    await LiveActivityManager.endActivity(activityId);
    logger.info('liveActivityService: Ended pinned snap activity', { activityId });
    return { success: true };
  } catch (err) {
    const error = err as Error;
    logger.error('liveActivityService: Failed to end activity', {
      activityId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};

export const endAllPinnedActivities = async (): Promise<ServiceResult> => {
  if (Platform.OS !== 'ios' || !LiveActivityManager) {
    return { success: false, error: 'Not supported' };
  }

  try {
    await LiveActivityManager.endAllActivities();
    logger.info('liveActivityService: Ended all pinned snap activities');
    return { success: true };
  } catch (err) {
    const error = err as Error;
    logger.error('liveActivityService: Failed to end all activities', { error: error.message });
    return { success: false, error: error.message };
  }
};

export const getActiveActivityIds = async (): Promise<string[]> => {
  if (Platform.OS !== 'ios' || !LiveActivityManager) {
    return [];
  }

  try {
    const ids = await LiveActivityManager.getActiveActivityIds();
    return ids || [];
  } catch (err) {
    const error = err as Error;
    logger.warn('liveActivityService: Failed to get active activity IDs', { error: error.message });
    return [];
  }
};

export const getFCMRegistrationToken = async (): Promise<string | null> => {
  if (Platform.OS !== 'ios') return null;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData?.data || null;
  } catch (err) {
    const error = err as Error;
    logger.warn('liveActivityService: Failed to get push token', { error: error.message });
    return null;
  }
};

export const registerPushToStartToken = async (
  userId: string
): Promise<{ remove: () => void } | null> => {
  if (Platform.OS !== 'ios' || !LiveActivityManager) {
    return null;
  }

  try {
    const fcmToken = await getFCMRegistrationToken();
    if (fcmToken) {
      const { error: fcmError } = await supabase
        .from('users')
        .update({ fcm_registration_token: fcmToken })
        .eq('id', userId);
      if (fcmError) {
        logger.error('liveActivityService: Failed to store FCM registration token', {
          error: fcmError.message,
        });
      } else {
        logger.info('liveActivityService: Stored FCM registration token', { userId });
      }
    }

    await LiveActivityManager.observePushToStartToken();
    await _pollAndStorePushToStartToken(userId);

    const emitter: any = new EventEmitter(NativeModulesProxy.LiveActivityManager as any);
    const subscription = emitter.addListener(
      'onPushToStartToken',
      async (event: { token?: string }) => {
        logger.info('liveActivityService: onPushToStartToken EVENT RECEIVED', {
          tokenLength: event.token?.length,
        });
        try {
          const { error: tokenError } = await supabase
            .from('users')
            .update({ push_to_start_token: event.token })
            .eq('id', userId);
          if (tokenError) {
            logger.error('liveActivityService: Failed to store push-to-start token', {
              error: tokenError.message,
            });
          } else {
            logger.info('liveActivityService: Stored push-to-start token via event');
          }
        } catch (err) {
          const error = err as Error;
          logger.error('liveActivityService: Failed to store push-to-start token', {
            error: error.message,
          });
        }
      }
    );

    return subscription;
  } catch (err) {
    const error = err as Error;
    logger.error('liveActivityService: Push-to-start registration FAILED', {
      error: error.message,
    });
    return null;
  }
};

const _pollAndStorePushToStartToken = async (userId: string): Promise<void> => {
  if (!LiveActivityManager) return;

  for (let i = 0; i < 5; i++) {
    const token = await LiveActivityManager.getPushToStartToken();
    if (token) {
      logger.info('liveActivityService: Got push-to-start token via poll', {
        attempt: i + 1,
        tokenLength: token.length,
      });
      const { error: pollError } = await supabase
        .from('users')
        .update({ push_to_start_token: token })
        .eq('id', userId);
      if (pollError) {
        logger.error('liveActivityService: Failed to store push-to-start token via poll', {
          error: pollError.message,
        });
      } else {
        logger.info('liveActivityService: Stored push-to-start token in Supabase');
      }
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  logger.info('liveActivityService: No push-to-start token after 5 polls (10s)');
};
