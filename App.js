import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import * as Updates from 'expo-updates';
import * as FileSystem from 'expo-file-system/legacy';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { Silkscreen_400Regular, Silkscreen_700Bold } from '@expo-google-fonts/silkscreen';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { colors } from './src/constants/colors';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { AuthProvider, ThemeProvider } from './src/context';
import { VideoMuteProvider } from './src/context/VideoMuteContext';
import AppNavigator, { navigationRef } from './src/navigation/AppNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ErrorBoundary,
  AnimatedSplash,
  InAppNotificationBanner,
  WhatsNewModal,
} from './src/components';
import {
  initializeNotifications,
  handleNotificationReceived,
  handleNotificationTapped,
  checkNotificationPermissions,
  getNotificationToken,
  storeNotificationToken,
  markNotificationReadFromPushData,
  storePinnedNotifId,
} from './src/services/firebase/notificationService';
import {
  isDarkroomReadyToReveal,
  scheduleNextReveal,
  clearRevealCache,
} from './src/services/firebase/darkroomService';
import { revealPhotos, getPhotoById } from './src/services/firebase/photoService';
import { initializeGiphy } from './src/components/comments/GifPicker';
import { initPerformanceMonitoring } from './src/services/firebase/performanceService';
import { usePhotoDetailActions } from './src/context/PhotoDetailContext';
import logger from './src/utils/logger';
import {
  startPinnedSnapActivity,
  getActiveActivityIds,
  registerPushToStartToken,
} from './src/services/liveActivityService';
import { WHATS_NEW } from './src/config/whatsNew';
import { GIPHY_API_KEY } from '@env';

const WHATS_NEW_STORAGE_KEY = '@whats_new_last_seen_id';

// Prevent the native splash screen from auto-hiding
// This keeps it visible while our animated splash runs
SplashScreen.preventAutoHideAsync();

// Initialize Giphy SDK for GIF picker functionality
// Get your free API key at https://developers.giphy.com/
initializeGiphy(GIPHY_API_KEY);

// Initialize Firebase Performance Monitoring
// Disables collection in __DEV__ to prevent polluting production metrics
initPerformanceMonitoring();

export default function App() {
  const notificationListener = useRef();
  const responseListener = useRef();
  const tokenRefreshListener = useRef();

  // Actively check for OTA updates on launch and reload immediately if one is found.
  // This runs while the splash screen is still visible so the reload is seamless.
  // Skipped in dev because expo-updates doesn't run in development.
  useEffect(() => {
    if (__DEV__) return;
    Updates.checkForUpdateAsync()
      .then(update => {
        if (update.isAvailable) {
          return Updates.fetchUpdateAsync().then(() => Updates.reloadAsync());
        }
      })
      .catch(err => logger.warn('App: OTA update check failed', { error: err.message }));
  }, []);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const [animationDone, setAnimationDone] = useState(false);
  const [bannerData, setBannerData] = useState(null);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  // Load retro pixel fonts - gate splash screen on this
  const [fontsLoaded] = useFonts({
    PressStart2P_400Regular,
    Silkscreen_400Regular,
    Silkscreen_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  /**
   * Handle animated splash completion
   * Marks animation as done; actual hide happens in useEffect below
   */
  const handleSplashComplete = () => {
    setAnimationDone(true);
  };

  // Hide splash only when BOTH fonts are loaded AND animation is done
  useEffect(() => {
    if (!fontsLoaded || !animationDone) return;
    const hideSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (_err) {
        // Ignore errors - splash may have already been hidden
      }
      setShowAnimatedSplash(false);
    };
    hideSplash();
  }, [fontsLoaded, animationDone]);

  // Show "What's New" modal once per OTA update after splash finishes
  useEffect(() => {
    if (showAnimatedSplash) return;
    if (__DEV__) return;

    const updateId = Updates.updateId;
    if (!updateId) return;

    const checkWhatsNew = async () => {
      try {
        const lastSeenId = await AsyncStorage.getItem(WHATS_NEW_STORAGE_KEY);

        if (!lastSeenId) {
          // First install — store current ID without showing modal
          await AsyncStorage.setItem(WHATS_NEW_STORAGE_KEY, updateId);
          return;
        }

        if (lastSeenId === updateId) return;

        if (WHATS_NEW.items.length === 0) {
          // Silent patch — store ID without showing modal
          await AsyncStorage.setItem(WHATS_NEW_STORAGE_KEY, updateId);
          return;
        }

        setShowWhatsNew(true);
      } catch (err) {
        logger.warn("App: Failed to check what's new", { error: err.message });
      }
    };

    checkWhatsNew();
  }, [showAnimatedSplash]);

  const handleDismissWhatsNew = async () => {
    setShowWhatsNew(false);
    try {
      const updateId = Updates.updateId;
      if (updateId) {
        await AsyncStorage.setItem(WHATS_NEW_STORAGE_KEY, updateId);
      }
    } catch (err) {
      logger.warn("App: Failed to store what's new dismissal", { error: err.message });
    }
  };

  /**
   * Shared navigation helper for notification taps
   * Used by both the system notification tap listener and the in-app banner press
   */
  const navigateToNotification = navData => {
    if (!navData.success) return;
    const { screen, params } = navData.data;
    logger.info('App: Notification navigating', { screen, params });

    // Wait for navigation to be ready (important for cold starts)
    let attempts = 0;
    const maxAttempts = 600; // 60 seconds max wait time (for Metro bundler in dev mode)
    const attemptNavigation = () => {
      attempts++;
      if (!navigationRef.current?.isReady()) {
        if (attempts >= maxAttempts) {
          logger.error('Navigation not ready after 60s, giving up', { screen, attempts });
          return;
        }
        logger.debug('Navigation not ready, retrying', { attempts, screen });
        setTimeout(attemptNavigation, 100);
        return;
      }

      logger.info('Navigation ready, executing navigation', { screen, attempts });

      // Extra delay on cold start to ensure MainTabs is mounted
      const executeNavigation = () => {
        logger.info('App: Executing navigation to', { screen, params });

        if (screen === 'Camera') {
          // Navigate to Camera tab with all params (openDarkroom, etc.)
          // First navigate to ensure we're on the right tab
          navigationRef.current.navigate('MainTabs', { screen: 'Camera' });
          // Then set params after a small delay to ensure the screen is focused
          // This works around React Navigation's nested navigator param propagation issue
          setTimeout(() => {
            navigationRef.current.navigate('MainTabs', {
              screen: 'Camera',
              params: params,
            });
          }, 100);
        } else if (screen === 'Feed') {
          // Navigate to Feed tab with params (e.g., highlightUserId for story notifications)
          navigationRef.current.navigate('MainTabs', {
            screen: 'Feed',
            params: params,
          });
        } else if (screen === 'Profile') {
          navigationRef.current.navigate('MainTabs', { screen });
        } else if (screen === 'FriendsList') {
          // Navigate to FriendsList screen (opens on requests tab by default)
          navigationRef.current.navigate('FriendsList', params);
        } else if (screen === 'OtherUserProfile') {
          // Navigate to another user's profile (e.g., friend accepted notification)
          navigationRef.current.navigate('OtherUserProfile', params);
        } else if (screen === 'Activity') {
          // Navigate to Activity screen (notifications) for comment/mention/reaction
          // ActivityScreen handles opening PhotoDetail with proper context
          navigationRef.current.navigate('Activity', params);
        } else if (screen === 'Conversation') {
          // Check if we're already on this conversation
          const currentRoute = navigationRef.current?.getCurrentRoute?.();
          const alreadyOnConvo =
            currentRoute?.name === 'Conversation' &&
            currentRoute?.params?.conversationId === params.conversationId;

          if (alreadyOnConvo && params.autoOpenSnapId) {
            // Already viewing this conversation — inject autoOpenSnapId via setParams
            // so the existing ConversationScreen's effect picks it up
            navigationRef.current.setParams({
              autoOpenSnapId: params.autoOpenSnapId,
            });
          } else if (alreadyOnConvo) {
            // Already on conversation, no snap to open — nothing to do
          } else {
            // Not on this conversation — navigate directly
            navigationRef.current.navigate('MainTabs', {
              screen: 'Messages',
              params: {
                screen: 'Conversation',
                params: params,
              },
            });
          }
        }
      };

      // Add small delay to ensure app is fully initialized (especially on cold start)
      setTimeout(executeNavigation, attempts > 10 ? 500 : 0);
    };

    // Start attempting navigation
    attemptNavigation();
  };

  /**
   * Handle banner tap — builds a fake notification object and navigates
   */
  const handleBannerPress = () => {
    if (!bannerData?.notificationData) return;
    // Mark as read — user tapped the banner
    const userId = getAuth().currentUser?.uid;
    if (userId) {
      markNotificationReadFromPushData(userId, bannerData.notificationData);
    }
    // Build a minimal notification object for handleNotificationTapped
    const fakeNotification = {
      request: { content: { data: bannerData.notificationData } },
    };
    const navigationData = handleNotificationTapped(fakeNotification);
    navigateToNotification(navigationData);
    setBannerData(null);
  };

  useEffect(() => {
    initializeNotifications();

    // Check for notification that opened the app (cold start)
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) {
        const pushData = response.notification.request.content.data;
        logger.info('App: Found cold start notification', { data: pushData });
        const navigationData = handleNotificationTapped(response.notification);
        logger.info('App: Cold start navigation data', { navigationData });
        // Mark as read — user tapped this notification to open the app
        const userId = getAuth().currentUser?.uid;
        if (userId && pushData) {
          markNotificationReadFromPushData(userId, pushData);
        }
        // Small delay to let app initialize
        setTimeout(() => {
          navigateToNotification(navigationData);
        }, 1000);
      }
    });

    // Register notification token whenever a user authenticates
    // This handles: app startup with existing session, fresh login, and re-login after logout
    const auth = getAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, async firebaseUser => {
      if (firebaseUser) {
        try {
          const permResult = await checkNotificationPermissions();
          if (permResult.success && permResult.data.granted) {
            const tokenResult = await getNotificationToken();
            if (tokenResult.success && tokenResult.data) {
              await storeNotificationToken(firebaseUser.uid, tokenResult.data);
              logger.info('App: Notification token stored for user', {
                userId: firebaseUser.uid,
              });
            }
          }
        } catch (error) {
          logger.error('App: Failed to setup notifications', { error: error.message });
        }

        // Register push-to-start token for Live Activities (iOS 17.2+)
        if (Platform.OS === 'ios') {
          registerPushToStartToken(firebaseUser.uid).catch(err => {
            logger.warn('App: Push-to-start registration failed', { error: err?.message });
          });
        }
      }
    });

    // Listener for Expo push token refresh (handles token changes on app reinstall)
    tokenRefreshListener.current = Notifications.addPushTokenListener(async ({ data }) => {
      // data here is the raw device token — ignore it, only use as a signal to re-register
      // Guard against re-entrancy (getExpoPushTokenAsync can trigger this listener)
      if (tokenRefreshListener.current?._isRefreshing) return;
      tokenRefreshListener.current._isRefreshing = true;
      const currentUser = getAuth().currentUser;
      if (currentUser) {
        try {
          const tokenResult = await getNotificationToken();
          if (tokenResult.success && tokenResult.data) {
            await storeNotificationToken(currentUser.uid, tokenResult.data);
            logger.info('App: Token refreshed and stored', {
              userId: currentUser.uid,
            });
          }
        } catch (error) {
          logger.error('App: Failed to store refreshed token', { error: error.message });
        }
      }
      tokenRefreshListener.current._isRefreshing = false;
    });

    // Listener for notifications received while app is in foreground
    // Shows custom InAppNotificationBanner instead of system notification
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      // Suppress DM and snap notifications if user is currently viewing that conversation
      const notifData = notification.request.content.data;
      if (
        (notifData?.type === 'direct_message' || notifData?.type === 'snap') &&
        notifData?.conversationId
      ) {
        const currentRoute = navigationRef.current?.getCurrentRoute?.();
        if (
          currentRoute?.name === 'Conversation' &&
          currentRoute?.params?.conversationId === notifData.conversationId
        ) {
          return; // Skip banner — user is already viewing this conversation
        }
      }

      // Start Live Activity from JS when a pinned snap notification is received.
      // This handles the foreground/background case. The NSE handles the killed-app case.
      if (Platform.OS === 'ios' && notifData?.pinned === 'true' && notifData?.pinnedActivityId) {
        (async () => {
          try {
            logger.info('App: [PIN-STEP-1] Pinned snap notification received', {
              activityId: notifData.pinnedActivityId,
              hasThumbnailUrl: !!notifData.pinnedThumbnailUrl,
              thumbnailUrlLength: (notifData.pinnedThumbnailUrl || '').length,
              thumbnailUrlPrefix: (notifData.pinnedThumbnailUrl || '').substring(0, 60),
              senderName: notifData.senderName,
              hasCaption: !!notifData.caption,
              allDataKeys: Object.keys(notifData),
            });

            let thumbnailUri = '';
            if (notifData.pinnedThumbnailUrl) {
              try {
                const localPath = `${FileSystem.cacheDirectory}pinned-thumb-${notifData.pinnedActivityId}.jpg`;
                logger.info('App: [PIN-STEP-2] Downloading thumbnail', {
                  from: notifData.pinnedThumbnailUrl.substring(0, 80),
                  to: localPath,
                });
                const downloadResult = await FileSystem.downloadAsync(
                  notifData.pinnedThumbnailUrl,
                  localPath
                );
                thumbnailUri = downloadResult.uri;
                logger.info('App: [PIN-STEP-3] Thumbnail downloaded', {
                  uri: thumbnailUri,
                  status: downloadResult.status,
                  headers: downloadResult.headers ? Object.keys(downloadResult.headers) : [],
                });
              } catch (dlErr) {
                logger.warn('App: [PIN-STEP-2-FAIL] Thumbnail download failed', {
                  error: dlErr.message,
                  url: notifData.pinnedThumbnailUrl.substring(0, 80),
                });
              }
            } else {
              logger.warn('App: [PIN-STEP-2-SKIP] No thumbnailUrl in notification data');
            }

            logger.info('App: [PIN-STEP-4] Starting Live Activity', {
              activityId: notifData.pinnedActivityId,
              thumbnailUri: thumbnailUri ? 'present (' + thumbnailUri.length + ' chars)' : 'empty',
              senderName: notifData.senderName || 'Someone',
            });

            const laResult = await startPinnedSnapActivity({
              activityId: notifData.pinnedActivityId,
              senderName: notifData.senderName || 'Someone',
              caption: notifData.caption || null,
              conversationId: notifData.conversationId,
              thumbnailUri,
            });
            logger.info('App: [PIN-STEP-5] Live Activity result', {
              success: laResult.success,
              nativeActivityId: laResult.nativeActivityId,
              error: laResult.error,
            });
          } catch (err) {
            logger.error('App: [PIN-FAIL] Failed to start Live Activity', {
              error: err.message,
              stack: err.stack?.substring(0, 200),
            });
          }
        })();
        return; // Suppress in-app banner — Live Activity is the visible indicator
      }

      // Store notification identifier for Android pinned snap dismissal.
      // When the snap is viewed, ConversationScreen calls dismissPinnedNotif
      // which reads this stored ID to call Notifications.dismissNotificationAsync.
      if (Platform.OS === 'android' && notifData?.type === 'pinned_snap' && notifData?.senderId) {
        storePinnedNotifId(notifData.senderId, notification.request.identifier);
      }

      const result = handleNotificationReceived(notification);
      if (result.success) {
        setBannerData(result.data);
      }
    });

    // Listener for when user taps a notification (background/killed-app)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const pushData = response.notification.request.content.data;
      logger.info('App: Notification response received', { data: pushData });
      const navigationData = handleNotificationTapped(response.notification);
      logger.info('App: Navigation data from handler', { navigationData });
      // Mark as read immediately on tap
      const userId = getAuth().currentUser?.uid;
      if (userId && pushData) {
        markNotificationReadFromPushData(userId, pushData);
      }
      navigateToNotification(navigationData);
    });

    return () => {
      unsubscribeAuth();
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
      if (tokenRefreshListener.current) {
        tokenRefreshListener.current.remove();
      }
    };
  }, []);

  // Check for pending photo reveals when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async nextAppState => {
      if (nextAppState === 'active') {
        const currentUser = getAuth().currentUser;
        if (currentUser) {
          logger.debug('App: Checking for pending reveals on foreground', {
            userId: currentUser.uid,
          });
          try {
            const isReady = await isDarkroomReadyToReveal(currentUser.uid);
            if (isReady) {
              logger.info('App: Revealing photos on foreground', {
                userId: currentUser.uid,
              });
              const revealResult = await revealPhotos(currentUser.uid);
              await scheduleNextReveal(currentUser.uid);
              clearRevealCache(); // Invalidate cache so next foreground check re-fetches fresh nextRevealAt
              logger.info('App: Foreground reveal complete', {
                userId: currentUser.uid,
                revealedCount: revealResult.count,
              });
            }
          } catch (error) {
            logger.error('App: Failed to check/reveal photos on foreground', {
              userId: currentUser.uid,
              error: error.message,
            });
          }
        }
      }
    });

    return () => subscription.remove();
  }, []);

  // Foreground-resume fallback: when app returns from background, check for
  // pinned snap notifications that didn't get a Live Activity (e.g., NSE failed).
  // Belt-and-suspenders for Issue 2 — ensures Live Activities appear even if
  // the NSE doesn't fire or fails in background/killed state.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const subscription = AppState.addEventListener('change', async nextAppState => {
      if (nextAppState === 'active') {
        try {
          // Get all delivered notifications still in the notification center
          const presented = await Notifications.getPresentedNotificationsAsync();
          const pinnedNotifs = presented.filter(
            n =>
              n.request.content.data?.pinned === 'true' && n.request.content.data?.pinnedActivityId
          );

          if (pinnedNotifs.length === 0) return;

          logger.info('App: [RESUME-CHECK] Found pinned snap notifications on foreground', {
            count: pinnedNotifs.length,
            activityIds: pinnedNotifs.map(n => n.request.content.data.pinnedActivityId),
          });

          // Get IDs of already-running Live Activities to avoid duplicates
          const activeIds = await getActiveActivityIds();
          const activeIdSet = new Set(activeIds);

          logger.info('App: [RESUME-CHECK] Active Live Activities', {
            activeCount: activeIds.length,
            activeIds,
          });

          // Start Live Activities for pinned notifications that don't have one yet
          for (const notif of pinnedNotifs) {
            const notifData = notif.request.content.data;
            const activityId = notifData.pinnedActivityId;

            if (activeIdSet.has(activityId)) {
              logger.debug('App: [RESUME-SKIP] Activity already exists', { activityId });
              continue;
            }

            logger.info('App: [RESUME-START] Starting Live Activity for missed pinned snap', {
              activityId,
              hasThumbnailUrl: !!notifData.pinnedThumbnailUrl,
            });

            // Download thumbnail
            let thumbnailUri = '';
            if (notifData.pinnedThumbnailUrl) {
              try {
                const localPath = `${FileSystem.cacheDirectory}pinned-thumb-${activityId}.jpg`;
                const downloadResult = await FileSystem.downloadAsync(
                  notifData.pinnedThumbnailUrl,
                  localPath
                );
                thumbnailUri = downloadResult.uri;
              } catch (dlErr) {
                logger.warn('App: [RESUME-DL-FAIL] Thumbnail download failed', {
                  activityId,
                  error: dlErr.message,
                });
              }
            }

            try {
              const result = await startPinnedSnapActivity({
                activityId,
                senderName: notifData.senderName || 'Someone',
                caption: notifData.caption || null,
                conversationId: notifData.conversationId,
                thumbnailUri,
              });
              logger.info('App: [RESUME-RESULT] Live Activity start result', {
                activityId,
                success: result.success,
                error: result.error,
              });
            } catch (err) {
              logger.error('App: [RESUME-FAIL] Failed to start Live Activity', {
                activityId,
                error: err.message,
              });
            }
          }
        } catch (err) {
          logger.warn('App: [RESUME-ERROR] Foreground resume check failed', {
            error: err.message,
          });
        }
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
        <SafeAreaProvider>
          <ErrorBoundary>
            <ThemeProvider>
              <VideoMuteProvider>
                <AuthProvider>
                  <AppNavigator />
                  <StatusBar style="auto" />
                  {showAnimatedSplash && (
                    <AnimatedSplash
                      onAnimationComplete={handleSplashComplete}
                      fontsLoaded={fontsLoaded}
                    />
                  )}
                </AuthProvider>
              </VideoMuteProvider>
            </ThemeProvider>
          </ErrorBoundary>
          <WhatsNewModal
            visible={showWhatsNew}
            title={WHATS_NEW.title}
            items={WHATS_NEW.items}
            onDismiss={handleDismissWhatsNew}
          />
          <InAppNotificationBanner
            visible={!!bannerData}
            title={bannerData?.title || ''}
            body={bannerData?.body || ''}
            avatarUrl={bannerData?.avatarUrl}
            onPress={handleBannerPress}
            onDismiss={() => setBannerData(null)}
          />
        </SafeAreaProvider>
      </View>
    </GestureHandlerRootView>
  );
}
