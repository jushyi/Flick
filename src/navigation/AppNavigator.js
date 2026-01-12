import { useState, useEffect, createRef } from 'react';
import { Text, ActivityIndicator, View, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { getDevelopingPhotoCount } from '../services/firebase/photoService';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

// Create navigation reference for programmatic navigation
export const navigationRef = createRef();

// Import auth screens
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';

// Import main app screens
import FeedScreen from '../screens/FeedScreen';
import CameraScreen from '../screens/CameraScreen';
import DarkroomScreen from '../screens/DarkroomScreen';
import ProfileScreen from '../screens/ProfileScreen';
import FriendsListScreen from '../screens/FriendsListScreen';
import UserSearchScreen from '../screens/UserSearchScreen';
import FriendRequestsScreen from '../screens/FriendRequestsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * Friends Stack Navigator (FriendsList, UserSearch, FriendRequests)
 */
const FriendsStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="FriendsList" component={FriendsListScreen} />
      <Stack.Screen name="UserSearch" component={UserSearchScreen} />
      <Stack.Screen name="FriendRequests" component={FriendRequestsScreen} />
    </Stack.Navigator>
  );
};

/**
 * Main Tab Navigator (Feed, Camera, Friends, Darkroom, Profile)
 */
const MainTabNavigator = () => {
  const { user } = useAuth();
  const [darkroomCount, setDarkroomCount] = useState(0);

  // Load darkroom count on mount and when tab becomes active
  useEffect(() => {
    if (!user) return;

    const loadDarkroomCount = async () => {
      const count = await getDevelopingPhotoCount(user.uid);
      setDarkroomCount(count);
    };

    loadDarkroomCount();

    // Poll every 30 seconds to update count
    const interval = setInterval(loadDarkroomCount, 30000);

    return () => clearInterval(interval);
  }, [user]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 12,
          position: 'absolute',
        },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#666666',
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarIcon: ({ color }) => <FeedIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Camera"
        component={CameraScreen}
        options={{
          tabBarIcon: ({ color }) => <CameraIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Friends"
        component={FriendsStackNavigator}
        options={{
          tabBarIcon: ({ color }) => <FriendsIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color }) => <ProfileIcon color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

/**
 * Minimalist Tab Icons (SVG-based)
 */

// Feed Icon - Two people silhouettes
const FeedIcon = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Circle cx="9" cy="7" r="3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <Circle cx="15" cy="9" r="2.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <Path
      d="M3 20c0-3.314 2.686-6 6-6s6 2.686 6 6"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <Path
      d="M15 20c0-2.21 1.343-4.105 3.25-4.917"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </Svg>
);

// Camera Icon - Classic camera shape
const CameraIcon = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Rect
      x="2"
      y="7"
      width="20"
      height="13"
      rx="2"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle
      cx="12"
      cy="13.5"
      r="3.5"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </Svg>
);

// Friends Icon - Two people side by side
const FriendsIcon = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Circle cx="9" cy="7" r="4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <Circle cx="17" cy="7" r="4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <Path
      d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <Path
      d="M16 20c0-3.5 2.5-6 6-6"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </Svg>
);

// Darkroom Icon - Moon/dark circle with badge
const DarkroomIcon = ({ color, count }) => (
  <View style={{ position: 'relative' }}>
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
    {count > 0 && (
      <View
        style={{
          position: 'absolute',
          top: -6,
          right: -8,
          backgroundColor: '#FF3B30',
          borderRadius: 10,
          minWidth: 18,
          height: 18,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 4,
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' }}>
          {count > 99 ? '99+' : count}
        </Text>
      </View>
    )}
  </View>
);

// Profile Icon - Simple user silhouette
const ProfileIcon = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Circle
      cx="12"
      cy="8"
      r="4"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <Path
      d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </Svg>
);

/**
 * Deep linking configuration for notifications
 */
const linking = {
  prefixes: ['lapse://', 'com.lapseclone.app://'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Feed: 'feed',
          Camera: 'camera',
          Darkroom: 'darkroom',
          Profile: 'profile',
          Friends: {
            screens: {
              FriendsList: 'friends',
              UserSearch: 'friends/search',
              FriendRequests: 'friends/requests',
            },
          },
        },
      },
      Login: 'login',
      SignUp: 'signup',
      ProfileSetup: 'profile-setup',
    },
  },
};

/**
 * Root Stack Navigator (handles auth flow)
 */
const AppNavigator = () => {
  const { user, userProfile, initializing } = useAuth();

  // Show loading screen while checking auth state
  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  const isAuthenticated = !!user;
  const needsProfileSetup = isAuthenticated && userProfile && (userProfile.profileSetupCompleted === false);

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      >
        {!isAuthenticated ? (
          // Auth Stack - User not logged in
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen
              name="SignUp"
              component={SignUpScreen}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
            />
          </>
        ) : needsProfileSetup ? (
          // Profile Setup - User logged in but needs to complete profile
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        ) : (
          // Main App - User fully authenticated and profile complete
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;