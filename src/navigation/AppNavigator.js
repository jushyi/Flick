import { useState, useEffect, createRef } from 'react';
import { Text, ActivityIndicator, View, Platform, Image } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
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
import SelectsScreen from '../screens/SelectsScreen';

// Import main app screens
import FeedScreen from '../screens/FeedScreen';
import CameraScreen from '../screens/CameraScreen';
import DarkroomScreen from '../screens/DarkroomScreen';
import SuccessScreen from '../screens/SuccessScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SongSearchScreen from '../screens/SongSearchScreen';
import FriendsScreen from '../screens/FriendsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ActivityScreen from '../screens/ActivityScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../screens/TermsOfServiceScreen';
import DeleteAccountScreen from '../screens/DeleteAccountScreen';
import CreateAlbumScreen from '../screens/CreateAlbumScreen';
import AlbumPhotoPickerScreen from '../screens/AlbumPhotoPickerScreen';
import AlbumGridScreen from '../screens/AlbumGridScreen';
import MonthlyAlbumGridScreen from '../screens/MonthlyAlbumGridScreen';

// Create navigation reference for programmatic navigation
export const navigationRef = createRef();

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * Onboarding Stack Navigator (ProfileSetup -> Selects)
 * Both screens are in the same stack so back navigation works correctly
 */
const OnboardingStackNavigator = ({ initialRouteName }) => {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        contentStyle: { backgroundColor: '#000000' },
      }}
    >
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <Stack.Screen name="Selects" component={SelectsScreen} />
      <Stack.Screen
        name="SongSearch"
        component={SongSearchScreen}
        options={{
          presentation: 'card',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack.Navigator>
  );
};

/**
 * Profile Stack Navigator (Profile, Settings, PrivacyPolicy, TermsOfService, DeleteAccount)
 */
const ProfileStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000000' },
      }}
    >
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen
        name="SongSearch"
        component={SongSearchScreen}
        options={{
          presentation: 'card',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <Stack.Screen name="CreateAlbum" component={CreateAlbumScreen} />
      <Stack.Screen name="AlbumPhotoPicker" component={AlbumPhotoPickerScreen} />
      <Stack.Screen name="AlbumGrid" component={AlbumGridScreen} />
      <Stack.Screen name="MonthlyAlbumGrid" component={MonthlyAlbumGridScreen} />
    </Stack.Navigator>
  );
};

/**
 * Main Tab Navigator (Feed, Camera, Profile) - 3-tab layout
 */
const MainTabNavigator = () => {
  const { user, userProfile } = useAuth();
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
        sceneContainerStyle: { backgroundColor: '#000000' },
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
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <ProfileTabIcon color={color} focused={focused} photoURL={userProfile?.photoURL} />
          ),
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

// Profile Icon - Simple user silhouette (fallback when no photo)
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

// Profile Tab Icon - Shows user photo or fallback icon
const ProfileTabIcon = ({ color, focused, photoURL }) => {
  if (photoURL) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: focused ? 2 : 1,
          borderColor: focused ? color : 'transparent',
        }}
      />
    );
  }
  return <ProfileIcon color={color} />;
};

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
              SongSearch: 'profile/song-search',
              Settings: 'profile/settings',
              PrivacyPolicy: 'profile/privacy',
              TermsOfService: 'profile/terms',
              DeleteAccount: 'profile/delete-account',
            },
          },
        },
      },
      Darkroom: 'darkroom',
      Activity: 'notifications',
      FriendsList: 'friends',
      PhoneInput: 'phone-input',
      Verification: 'verification',
      Onboarding: {
        screens: {
          ProfileSetup: 'profile-setup',
          Selects: 'selects',
        },
      },
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
          backgroundColor: '#000000',
        }}
      >
        <ActivityIndicator size="large" color="#FFFFFF" />
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
          backgroundColor: '#000000',
        }}
      >
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  // Show ProfileSetup if user is authenticated but hasn't completed profile setup
  // Check for both false AND undefined/missing (for users created before this field existed)
  const needsProfileSetup =
    isAuthenticated && userProfile && userProfile.profileSetupCompleted !== true;

  // Show Selects if user completed profile setup but hasn't completed selects
  const needsSelects =
    isAuthenticated &&
    userProfile &&
    userProfile.profileSetupCompleted === true &&
    userProfile.selectsCompleted !== true;

  // Determine if user needs onboarding (either profile setup or selects)
  const needsOnboarding = needsProfileSetup || needsSelects;
  // Start at Selects if profile is done but selects aren't
  const onboardingInitialRoute = needsSelects ? 'Selects' : 'ProfileSetup';

  // Always wrap with PhoneAuthProvider to share confirmation ref
  // between PhoneInputScreen/VerificationScreen during auth, and for
  // DeleteAccountScreen re-authentication flow when already logged in

  // Dark theme to prevent white bleeding through during screen transitions
  const darkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#000000',
      card: '#000000',
    },
  };

  return (
    <PhoneAuthProvider>
      <NavigationContainer ref={navigationRef} linking={linking} theme={darkTheme}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            contentStyle: { backgroundColor: '#000000' },
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
          ) : needsOnboarding ? (
            // Onboarding Stack - ProfileSetup and Selects in same navigator for back navigation
            <Stack.Screen name="Onboarding">
              {() => <OnboardingStackNavigator initialRouteName={onboardingInitialRoute} />}
            </Stack.Screen>
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
                name="Activity"
                component={ActivityScreen}
                options={{
                  presentation: 'card',
                  animation: 'slide_from_right',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="FriendsList"
                component={FriendsScreen}
                options={{
                  presentation: 'card',
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="OtherUserProfile"
                component={ProfileScreen}
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
    </PhoneAuthProvider>
  );
};

export default AppNavigator;
