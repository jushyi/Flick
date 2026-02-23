import { createRef, useRef, useEffect } from 'react';
import { View, Alert } from 'react-native';
import PixelSpinner from '../components/PixelSpinner';
import {
  NavigationContainer,
  DarkTheme,
  getFocusedRouteNameFromRoute,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useAuth } from '../context/AuthContext';
import { PhoneAuthProvider } from '../context/PhoneAuthContext';
import { PhotoDetailProvider } from '../context/PhotoDetailContext';
import useMessages from '../hooks/useMessages';
import * as Contacts from 'expo-contacts';
import { colors } from '../constants/colors';
import CustomBottomTabBar from '../components/CustomBottomTabBar';
import DeletionRecoveryModal from '../components/DeletionRecoveryModal';
import {
  checkNotificationPermissions,
  requestNotificationPermission,
  getNotificationToken,
  storeNotificationToken,
} from '../services/firebase/notificationService';
import { getContactsPermissionStatus } from '../services/firebase/contactSyncService';
import logger from '../utils/logger';

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
import ContactsSettingsScreen from '../screens/ContactsSettingsScreen';
import ContributionsScreen from '../screens/ContributionsScreen';
import SoundSettingsScreen from '../screens/SoundSettingsScreen';
import ReadReceiptsSettingsScreen from '../screens/ReadReceiptsSettingsScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ConversationScreen from '../screens/ConversationScreen';
import NewMessageScreen from '../screens/NewMessageScreen';

// Create navigation reference for programmatic navigation
export const navigationRef = createRef();

const Stack = createNativeStackNavigator();
const Tab = createMaterialTopTabNavigator();
const ProfileModalStack = createNativeStackNavigator();
const MessagesStack = createNativeStackNavigator();

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
        name="ContactsSettings"
        component={ContactsSettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SoundSettings"
        component={SoundSettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ReadReceiptsSettings"
        component={ReadReceiptsSettingsScreen}
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
 * Messages Stack Navigator (MessagesList, Conversation, NewMessage)
 */
const MessagesStackNavigator = () => {
  return (
    <MessagesStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
      }}
    >
      <MessagesStack.Screen name="MessagesList" component={MessagesScreen} />
      <MessagesStack.Screen
        name="Conversation"
        component={ConversationScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <MessagesStack.Screen
        name="NewMessage"
        component={NewMessageScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </MessagesStack.Navigator>
  );
};

/**
 * Main Tab Navigator (Feed, Messages, Camera, Profile) - 4-tab layout
 */
const MainTabNavigator = () => {
  const { userProfile, user } = useAuth();
  const { totalUnreadCount } = useMessages(user?.uid);

  return (
    <Tab.Navigator
      initialRouteName="Camera"
      tabBarPosition="bottom"
      tabBar={props => (
        <CustomBottomTabBar
          {...props}
          userProfile={userProfile}
          totalUnreadCount={totalUnreadCount}
        />
      )}
      screenOptions={{
        lazy: false,
        swipeEnabled: true,
        animationEnabled: false,
        sceneStyle: { backgroundColor: colors.background.primary },
      }}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen
        name="Messages"
        component={MessagesStackNavigator}
        options={({ route }) => {
          const routeName = getFocusedRouteNameFromRoute(route) ?? 'MessagesList';
          return { swipeEnabled: routeName === 'MessagesList' };
        }}
      />
      <Tab.Screen name="Camera" component={CameraScreen} />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={({ route }) => {
          const routeName = getFocusedRouteNameFromRoute(route) ?? 'ProfileMain';
          return { swipeEnabled: routeName === 'ProfileMain' };
        }}
      />
    </Tab.Navigator>
  );
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
          Messages: {
            screens: {
              MessagesList: 'messages',
              Conversation: 'messages/:conversationId',
              NewMessage: 'messages/new',
            },
          },
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

  // Reconcile iOS permissions that may have been reset after a TestFlight update/reinstall.
  // iOS resets permission status to 'undetermined' on full reinstall. When we detect that a
  // previously-completed permission is now undetermined, re-request it automatically so the
  // user just taps "Allow" instead of navigating through settings manually.
  const hasReconciled = useRef(false);
  useEffect(() => {
    if (!user || !userProfile || hasReconciled.current) return;

    // Only reconcile for users who completed onboarding
    const isOnboarded =
      userProfile.profileSetupCompleted === true &&
      userProfile.selectsCompleted === true &&
      userProfile.contactsSyncCompleted !== undefined;

    if (!isOnboarded) return;

    hasReconciled.current = true;

    const reconcilePermissions = async () => {
      try {
        // Notification permissions: re-request if previously completed but now undetermined
        if (userProfile.notificationPermissionCompleted) {
          const notifResult = await checkNotificationPermissions();
          if (notifResult.success && notifResult.data.status === 'undetermined') {
            logger.info('AppNavigator: Notification permission was reset, re-requesting');
            const permResult = await requestNotificationPermission();
            if (permResult.success) {
              const tokenResult = await getNotificationToken();
              if (tokenResult.success && tokenResult.data) {
                await storeNotificationToken(user.uid, tokenResult.data);
              }
            }
          }
        }

        // Contacts permissions: re-request if previously synced but now undetermined
        // Uses expo-contacts directly to avoid the Alert shown by the service wrapper
        if (userProfile.contactsSyncCompleted === true) {
          const contactsResult = await getContactsPermissionStatus();
          if (contactsResult.success && contactsResult.data.status === 'undetermined') {
            logger.info('AppNavigator: Contacts permission was reset, re-requesting');
            await Contacts.requestPermissionsAsync();
          }
        }
      } catch (error) {
        logger.error('AppNavigator: Permission reconciliation failed', {
          error: error.message,
        });
      }
    };

    reconcilePermissions();
  }, [user, userProfile]);

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

  // Determine if user needs onboarding (profile setup, selects, or contacts sync)
  // NotificationPermission is reached via ContactsSync navigation during onboarding,
  // not auto-routed on startup for returning users
  const needsOnboarding = needsProfileSetup || needsSelects || needsContactsSync;

  // Start at appropriate screen (furthest progress first)
  let onboardingInitialRoute = 'ProfileSetup';
  if (needsContactsSync) {
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
                    animation: 'none',
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
