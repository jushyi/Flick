import { useState, useEffect, createRef } from 'react';
import { Text, ActivityIndicator, View, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { PhoneAuthProvider } from '../context/PhoneAuthContext';
import { getDevelopingPhotoCount } from '../services/firebase/photoService';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

// Import auth screens (phone-only authentication)
import PhoneInputScreen from '../screens/PhoneInputScreen';
import VerificationScreen from '../screens/VerificationScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';

// Import main app screens
import FeedScreen from '../screens/FeedScreen';
import CameraScreen from '../screens/CameraScreen';
import DarkroomScreen from '../screens/DarkroomScreen';
import SuccessScreen from '../screens/SuccessScreen';
import ProfileScreen from '../screens/ProfileScreen';
import FriendsListScreen from '../screens/FriendsListScreen';
import UserSearchScreen from '../screens/UserSearchScreen';
import FriendRequestsScreen from '../screens/FriendRequestsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../screens/TermsOfServiceScreen';

// Create navigation reference for programmatic navigation
export const navigationRef = createRef();

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
 * Profile Stack Navigator (Profile, Settings, PrivacyPolicy, TermsOfService)
 */
const ProfileStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
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
      initialRouteName="Camera"
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
        component={ProfileStackNavigator}
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
    <Circle cx="12" cy="13.5" r="3.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
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
    <Path d="M16 20c0-3.5 2.5-6 6-6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
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
    <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
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
          Profile: {
            screens: {
              ProfileMain: 'profile',
              Settings: 'profile/settings',
              PrivacyPolicy: 'profile/privacy',
              TermsOfService: 'profile/terms',
            },
          },
          Friends: {
            screens: {
              FriendsList: 'friends',
              UserSearch: 'friends/search',
              FriendRequests: 'friends/requests',
            },
          },
        },
      },
      Darkroom: 'darkroom',
      Notifications: 'notifications',
      PhoneInput: 'phone-input',
      Verification: 'verification',
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
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
        }}
      >
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  const isAuthenticated = !!user;

  // Wait for userProfile to be loaded/created before making navigation decisions
  // This prevents briefly showing MainTabs while profile is being created for new users
  if (isAuthenticated && userProfile === null) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
        }}
      >
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  // Show ProfileSetup if user is authenticated but hasn't completed profile setup
  // Check for both false AND undefined/missing (for users created before this field existed)
  const needsProfileSetup =
    isAuthenticated && userProfile && userProfile.profileSetupCompleted !== true;

  // Wrap with PhoneAuthProvider when not authenticated to share confirmation ref
  // between PhoneInputScreen and VerificationScreen without serialization crash
  const Wrapper = !isAuthenticated ? PhoneAuthProvider : ({ children }) => children;

  return (
    <Wrapper>
      <NavigationContainer ref={navigationRef} linking={linking}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            gestureEnabled: true,
            gestureDirection: 'horizontal',
          }}
        >
          {!isAuthenticated ? (
            // Auth Stack - Phone-only authentication
            // PhoneAuthProvider wraps NavigationContainer (see below) to share
            // confirmation ref between screens without serialization crash
            <>
              <Stack.Screen name="PhoneInput" component={PhoneInputScreen} />
              <Stack.Screen name="Verification" component={VerificationScreen} />
            </>
          ) : needsProfileSetup ? (
            // Profile Setup - User logged in but needs to complete profile
            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
          ) : (
            // Main App - User fully authenticated and profile complete
            <>
              <Stack.Screen name="MainTabs" component={MainTabNavigator} />
              <Stack.Screen
                name="Darkroom"
                component={DarkroomScreen}
                options={{
                  presentation: 'card',
                  animation: 'slide_from_bottom',
                  gestureEnabled: false, // Disable back swipe to prevent accidental exit
                }}
              />
              <Stack.Screen
                name="Success"
                component={SuccessScreen}
                options={{
                  presentation: 'card',
                  animation: 'slide_from_right',
                  gestureEnabled: false, // Prevent accidental back swipe
                }}
              />
              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
                options={{
                  presentation: 'card',
                  animation: 'slide_from_right',
                  headerShown: false,
                }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </Wrapper>
  );
};

export default AppNavigator;
