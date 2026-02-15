import { useState, useEffect, createRef } from 'react';
import { Text, View, Platform, Alert } from 'react-native';
import { Image } from 'expo-image';
import PixelSpinner from '../components/PixelSpinner';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { PhoneAuthProvider } from '../context/PhoneAuthContext';
import { PhotoDetailProvider } from '../context/PhotoDetailContext';
import { getDevelopingPhotoCount } from '../services/firebase/photoService';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import PixelIcon from '../components/PixelIcon';
import DeletionRecoveryModal from '../components/DeletionRecoveryModal';

// Import auth screens (phone-only authentication)
import PhoneInputScreen from '../screens/PhoneInputScreen';
import VerificationScreen from '../screens/VerificationScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import SelectsScreen from '../screens/SelectsScreen';
import ContactsSyncScreen from '../screens/ContactsSyncScreen';
import NotificationPermissionScreen from '../screens/NotificationPermissionScreen';

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
import PhotoDetailScreen from '../screens/PhotoDetailScreen';
import ReportUserScreen from '../screens/ReportUserScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import RecentlyDeletedScreen from '../screens/RecentlyDeletedScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';
import ProfilePhotoCropScreen from '../screens/ProfilePhotoCropScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import ContributionsScreen from '../screens/ContributionsScreen';
import SoundSettingsScreen from '../screens/SoundSettingsScreen';

// Create navigation reference for programmatic navigation
export const navigationRef = createRef();

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const ProfileModalStack = createNativeStackNavigator();

/**
 * ProfileFromPhotoDetail Navigator
 * Nested stack navigator used when navigating to a profile from PhotoDetail.
 * Uses fullScreenModal presentation to render above PhotoDetail's transparentModal.
 * Contains ProfileMain, AlbumGrid, and MonthlyAlbumGrid for child navigation.
 */
function ProfileFromPhotoDetailNavigator({ route }) {
  const { userId, username } = route.params;
  return (
    <ProfileModalStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
      }}
    >
      <ProfileModalStack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        initialParams={{ userId, username }}
        options={{ animation: 'none' }}
      />
      <ProfileModalStack.Screen
        name="AlbumGrid"
        component={AlbumGridScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <ProfileModalStack.Screen
        name="MonthlyAlbumGrid"
        component={MonthlyAlbumGridScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </ProfileModalStack.Navigator>
  );
}

/**
 * Onboarding Stack Navigator (ProfileSetup -> Selects -> ContactsSync)
 * All screens are in the same stack so back navigation works correctly
 */
const OnboardingStackNavigator = ({ initialRouteName }) => {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        contentStyle: { backgroundColor: colors.background.primary },
      }}
    >
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <Stack.Screen name="Selects" component={SelectsScreen} />
      <Stack.Screen name="ContactsSync" component={ContactsSyncScreen} />
      <Stack.Screen name="NotificationPermission" component={NotificationPermissionScreen} />
      <Stack.Screen
        name="SongSearch"
        component={SongSearchScreen}
        options={{
          presentation: 'card',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="ProfilePhotoCrop"
        component={ProfilePhotoCropScreen}
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          contentStyle: { backgroundColor: colors.background.primary },
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
        contentStyle: { backgroundColor: colors.background.primary },
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
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SoundSettings"
        component={SoundSettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Contributions" component={ContributionsScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <Stack.Screen name="RecentlyDeleted" component={RecentlyDeletedScreen} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Stack.Screen name="CreateAlbum" component={CreateAlbumScreen} />
      <Stack.Screen name="AlbumPhotoPicker" component={AlbumPhotoPickerScreen} />
      <Stack.Screen name="AlbumGrid" component={AlbumGridScreen} />
      <Stack.Screen name="MonthlyAlbumGrid" component={MonthlyAlbumGridScreen} />
      <Stack.Screen
        name="ProfilePhotoCrop"
        component={ProfilePhotoCropScreen}
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          contentStyle: { backgroundColor: colors.background.primary },
        }}
      />
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
          backgroundColor: colors.background.primary,
          borderTopWidth: 1,
          borderTopColor: colors.border.subtle,
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 12,
          position: 'absolute',
        },
        tabBarActiveTintColor: colors.icon.primary,
        tabBarInactiveTintColor: colors.icon.inactive,
        tabBarShowLabel: false,
        sceneContainerStyle: { backgroundColor: colors.background.primary },
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
 * Pixel Art Tab Icons (16-bit retro style)
 */

// Feed Icon - Two people pixel silhouettes
const FeedIcon = ({ color }) => <PixelIcon name="tab-feed" size={24} color={color} />;

// Camera Icon - Pixel camera
const CameraIcon = ({ color }) => <PixelIcon name="tab-camera" size={24} color={color} />;

// Darkroom Icon - Pixel crescent moon with badge
const DarkroomIcon = ({ color, count }) => (
  <View style={{ position: 'relative' }}>
    <PixelIcon name="tab-darkroom" size={24} color={color} />
    {count > 0 && (
      <View
        style={{
          position: 'absolute',
          top: -6,
          right: -8,
          backgroundColor: colors.status.danger,
          borderRadius: 2,
          minWidth: 18,
          height: 18,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 4,
        }}
      >
        <Text
          style={{
            color: colors.text.primary,
            fontSize: typography.size.xs,
            fontFamily: typography.fontFamily.bodyBold,
          }}
        >
          {count > 99 ? '99+' : count}
        </Text>
      </View>
    )}
  </View>
);

// Profile Icon - Pixel user silhouette (fallback when no photo)
const ProfileIcon = ({ color }) => <PixelIcon name="tab-profile" size={24} color={color} />;

// Profile Tab Icon - Shows user photo or fallback pixel icon
const ProfileTabIcon = ({ color, focused, photoURL }) => {
  if (photoURL) {
    return (
      <Image
        source={{ uri: photoURL, cacheKey: 'profile-tab-icon' }}
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: focused ? 2 : 1,
          borderColor: focused ? color : 'transparent',
        }}
        cachePolicy="memory-disk"
        transition={0}
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
          ContactsSync: 'contacts-sync',
        },
      },
    },
  },
};

/**
 * Root Stack Navigator (handles auth flow)
 */
const AppNavigator = () => {
  const { user, userProfile, initializing, pendingDeletion, cancelDeletion, signOut } = useAuth();

  const handleCancelDeletion = async () => {
    const result = await cancelDeletion();
    if (!result.success) {
      Alert.alert('Error', 'Failed to cancel deletion. Please try again.');
    }
    // Modal auto-hides when pendingDeletion becomes null
  };

  const handleProceedWithDeletion = () => {
    signOut();
    // User is signed out, returns to login screen
  };

  // Show loading screen while checking auth state
  if (initializing) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background.primary,
        }}
      >
        <PixelSpinner size="large" color={colors.text.primary} />
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
          backgroundColor: colors.background.primary,
        }}
      >
        <PixelSpinner size="large" color={colors.text.primary} />
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

  // Show ContactsSync if user completed selects but hasn't synced contacts
  // Note: contactsSyncCompleted can be true (synced) or false (skipped) - both mean done
  // Only show if contactsSyncCompleted is undefined (never prompted)
  const needsContactsSync =
    isAuthenticated &&
    userProfile &&
    userProfile.profileSetupCompleted === true &&
    userProfile.selectsCompleted === true &&
    userProfile.contactsSyncCompleted === undefined;

  // Show NotificationPermission if user completed contacts sync but hasn't been prompted for notifications
  // Skip for existing users who already have a push token registered
  const needsNotificationPermission =
    isAuthenticated &&
    userProfile &&
    userProfile.profileSetupCompleted === true &&
    userProfile.selectsCompleted === true &&
    userProfile.contactsSyncCompleted !== undefined &&
    userProfile.notificationPermissionCompleted !== true &&
    !userProfile.fcmToken;

  // Determine if user needs onboarding (profile setup, selects, contacts sync, or notification permission)
  const needsOnboarding =
    needsProfileSetup || needsSelects || needsContactsSync || needsNotificationPermission;

  // Start at appropriate screen (furthest progress first)
  let onboardingInitialRoute = 'ProfileSetup';
  if (needsNotificationPermission) {
    onboardingInitialRoute = 'NotificationPermission';
  } else if (needsContactsSync) {
    onboardingInitialRoute = 'ContactsSync';
  } else if (needsSelects) {
    onboardingInitialRoute = 'Selects';
  }

  // Always wrap with PhoneAuthProvider to share confirmation ref
  // between PhoneInputScreen/VerificationScreen during auth, and for
  // DeleteAccountScreen re-authentication flow when already logged in

  // Navigation theme using color constants - prevents white bleeding during transitions
  const navTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: colors.brand.purple,
      background: colors.background.primary,
      card: colors.background.secondary,
      text: colors.text.primary,
      border: colors.border.subtle,
      notification: colors.status.danger,
    },
  };

  return (
    <PhotoDetailProvider>
      <PhoneAuthProvider>
        <NavigationContainer ref={navigationRef} linking={linking} theme={navTheme}>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              gestureEnabled: true,
              gestureDirection: 'horizontal',
              contentStyle: { backgroundColor: colors.background.primary },
            }}
          >
            {!isAuthenticated ? (
              // Auth Stack - Phone-only authentication
              // PhoneAuthProvider wraps NavigationContainer (see below) to share
              // confirmation ref between screens without serialization crash
              <>
                <Stack.Screen
                  name="PhoneInput"
                  component={PhoneInputScreen}
                  options={{
                    animation: 'slide_from_left',
                  }}
                />
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
                  name="PhotoDetail"
                  component={PhotoDetailScreen}
                  options={{
                    presentation: 'transparentModal',
                    headerShown: false,
                    animation: 'slide_from_bottom',
                    gestureEnabled: true,
                    gestureDirection: 'vertical',
                    contentStyle: { backgroundColor: 'transparent' },
                  }}
                />
                <Stack.Screen
                  name="ProfileFromPhotoDetail"
                  component={ProfileFromPhotoDetailNavigator}
                  options={{
                    presentation: 'fullScreenModal',
                    headerShown: false,
                    animation: 'slide_from_right',
                    gestureEnabled: true,
                    contentStyle: { backgroundColor: colors.background.primary },
                  }}
                />
                <Stack.Screen
                  name="Darkroom"
                  component={DarkroomScreen}
                  options={{
                    presentation: 'card',
                    animation: 'slide_from_bottom',
                    gestureEnabled: false, // Disable back swipe to prevent accidental exit
                    contentStyle: { backgroundColor: colors.background.primary },
                  }}
                />
                <Stack.Screen
                  name="Success"
                  component={SuccessScreen}
                  options={{
                    presentation: 'card',
                    animation: 'slide_from_right',
                    gestureEnabled: false, // Prevent accidental back swipe
                    contentStyle: { backgroundColor: colors.background.primary },
                  }}
                />
                <Stack.Screen
                  name="Activity"
                  component={ActivityScreen}
                  options={{
                    presentation: 'card',
                    animation: 'slide_from_right',
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background.primary },
                  }}
                />
                <Stack.Screen
                  name="FriendsList"
                  component={FriendsScreen}
                  options={{
                    presentation: 'card',
                    animation: 'slide_from_right',
                    contentStyle: { backgroundColor: colors.background.primary },
                  }}
                />
                <Stack.Screen
                  name="OtherUserProfile"
                  component={ProfileScreen}
                  options={{
                    presentation: 'card', // Card (not modal) so AlbumGrid/MonthlyAlbumGrid can push on top
                    animation: 'slide_from_right',
                    headerShown: false,
                    gestureEnabled: true,
                    contentStyle: { backgroundColor: colors.background.primary },
                  }}
                />
                <Stack.Screen
                  name="AlbumGrid"
                  component={AlbumGridScreen}
                  options={{
                    presentation: 'card',
                    animation: 'slide_from_right',
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background.primary },
                  }}
                />
                <Stack.Screen
                  name="MonthlyAlbumGrid"
                  component={MonthlyAlbumGridScreen}
                  options={{
                    presentation: 'card',
                    animation: 'slide_from_right',
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background.primary },
                  }}
                />
                <Stack.Screen
                  name="ReportUser"
                  component={ReportUserScreen}
                  options={{
                    presentation: 'modal',
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background.primary },
                  }}
                />
                <Stack.Screen
                  name="HelpSupport"
                  component={HelpSupportScreen}
                  options={{
                    presentation: 'modal',
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background.primary },
                  }}
                />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
        <DeletionRecoveryModal
          visible={isAuthenticated && !!pendingDeletion?.isScheduled}
          scheduledDate={pendingDeletion?.scheduledDate}
          onCancel={handleCancelDeletion}
          onProceed={handleProceedWithDeletion}
        />
      </PhoneAuthProvider>
    </PhotoDetailProvider>
  );
};

export default AppNavigator;
