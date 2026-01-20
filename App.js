import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator, { navigationRef } from './src/navigation/AppNavigator';
import { ErrorBoundary, AnimatedSplash } from './src/components';
import {
  initializeNotifications,
  handleNotificationReceived,
  handleNotificationTapped,
} from './src/services/firebase/notificationService';

// Prevent the native splash screen from auto-hiding
// This keeps it visible while our animated splash runs
SplashScreen.preventAutoHideAsync();

export default function App() {
  const notificationListener = useRef();
  const responseListener = useRef();
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);

  /**
   * Handle animated splash completion
   * Hides the native splash and removes the animated overlay
   */
  const handleSplashComplete = async () => {
    try {
      // Hide the native splash screen
      await SplashScreen.hideAsync();
    } catch (e) {
      // Ignore errors - splash may have already been hidden
    }
    // Remove the animated splash overlay
    setShowAnimatedSplash(false);
  };

  useEffect(() => {
    // Initialize notifications on app launch
    initializeNotifications();

    // Listener for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        handleNotificationReceived(notification);
      }
    );

    // Listener for when user taps a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const navigationData = handleNotificationTapped(response.notification);

        if (navigationData.success && navigationRef.current?.isReady()) {
          const { screen, params } = navigationData.data;
          console.log('Navigating to:', screen, 'with params:', params);

          // Navigate to the appropriate screen based on notification type
          if (screen === 'Darkroom' || screen === 'Feed' || screen === 'Profile') {
            // Navigate to tab screen
            navigationRef.current.navigate('MainTabs', { screen });
          } else if (screen === 'FriendRequests') {
            // Navigate to Friends tab, then to FriendRequests screen
            navigationRef.current.navigate('MainTabs', {
              screen: 'Friends',
              params: { screen: 'FriendRequests' },
            });
          }
        }
      }
    );

    // Cleanup listeners on unmount
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <AppNavigator />
          <StatusBar style="auto" />
          {showAnimatedSplash && (
            <AnimatedSplash onAnimationComplete={handleSplashComplete} />
          )}
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
