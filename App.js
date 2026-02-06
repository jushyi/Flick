import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from './src/constants/colors';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { getAuth } from '@react-native-firebase/auth';
import { AuthProvider, ThemeProvider } from './src/context';
import AppNavigator, { navigationRef } from './src/navigation/AppNavigator';
import { ErrorBoundary, AnimatedSplash } from './src/components';
import {
  initializeNotifications,
  handleNotificationReceived,
  handleNotificationTapped,
  requestNotificationPermission,
  getNotificationToken,
  storeNotificationToken,
} from './src/services/firebase/notificationService';
import {
  isDarkroomReadyToReveal,
  scheduleNextReveal,
} from './src/services/firebase/darkroomService';
import { revealPhotos } from './src/services/firebase/photoService';
import { initializeGiphy } from './src/components/comments/GifPicker';
import logger from './src/utils/logger';
import { GIPHY_API_KEY } from '@env';

// Prevent the native splash screen from auto-hiding
// This keeps it visible while our animated splash runs
SplashScreen.preventAutoHideAsync();

// Initialize Giphy SDK for GIF picker functionality
// Get your free API key at https://developers.giphy.com/
initializeGiphy(GIPHY_API_KEY);

export default function App() {
  const notificationListener = useRef();
  const responseListener = useRef();
  const tokenRefreshListener = useRef();
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);

  /**
   * Handle animated splash completion
   * Hides the native splash and removes the animated overlay
   */
  const handleSplashComplete = async () => {
    try {
      // Hide the native splash screen
      await SplashScreen.hideAsync();
    } catch (_err) {
      // Ignore errors - splash may have already been hidden
    }
    // Remove the animated splash overlay
    setShowAnimatedSplash(false);
  };

  useEffect(() => {
    // Initialize notifications on app launch
    initializeNotifications();

    // Request notification permissions and store token for authenticated users
    // This ensures existing users who already completed profile setup get prompted
    const requestPermissionsAndToken = async () => {
      const currentUser = getAuth().currentUser;
      if (currentUser) {
        try {
          const permResult = await requestNotificationPermission();
          if (permResult.success) {
            const tokenResult = await getNotificationToken();
            if (tokenResult.success && tokenResult.data) {
              await storeNotificationToken(currentUser.uid, tokenResult.data);
              logger.info('App: Notification token stored on startup', {
                userId: currentUser.uid,
              });
            }
          }
        } catch (error) {
          logger.error('App: Failed to setup notifications', { error: error.message });
        }
      }
    };

    // Small delay to ensure auth state is ready
    const timeoutId = setTimeout(requestPermissionsAndToken, 1000);

    // Listener for token refresh (handles token changes on app reinstall)
    tokenRefreshListener.current = Notifications.addPushTokenListener(async ({ data }) => {
      const currentUser = getAuth().currentUser;
      if (currentUser && data) {
        try {
          await storeNotificationToken(currentUser.uid, data);
          logger.info('App: Token refreshed and stored', {
            userId: currentUser.uid,
          });
        } catch (error) {
          logger.error('App: Failed to store refreshed token', { error: error.message });
        }
      }
    });

    // Listener for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      handleNotificationReceived(notification);
    });

    // Listener for when user taps a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const navigationData = handleNotificationTapped(response.notification);

      if (navigationData.success && navigationRef.current?.isReady()) {
        const { screen, params } = navigationData.data;
        logger.info('App: Notification tap navigating', { screen, params });

        // Navigate to the appropriate screen based on notification type
        if (screen === 'Camera') {
          // Navigate to Camera tab with all params (openDarkroom, revealAll, revealedCount)
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
          // Navigate to Profile tab
          navigationRef.current.navigate('MainTabs', { screen });
        } else if (screen === 'FriendRequests') {
          // Navigate to Friends tab, then to FriendRequests screen
          navigationRef.current.navigate('MainTabs', {
            screen: 'Friends',
            params: { screen: 'FriendRequests' },
          });
        }
      }
    });

    // Cleanup listeners on unmount
    return () => {
      clearTimeout(timeoutId);
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
        // Check for pending reveals when app comes to foreground
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <AppNavigator />
              <StatusBar style="auto" />
              {showAnimatedSplash && <AnimatedSplash onAnimationComplete={handleSplashComplete} />}
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </View>
  );
}
