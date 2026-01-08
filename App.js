import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator, { navigationRef } from './src/navigation/AppNavigator';
import {
  initializeNotifications,
  handleNotificationReceived,
  handleNotificationTapped,
} from './src/services/firebase/notificationService';

export default function App() {
  const notificationListener = useRef();
  const responseListener = useRef();

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
      <AuthProvider>
        <AppNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
