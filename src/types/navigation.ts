/**
 * Navigation type definitions for React Navigation
 *
 * Typed param lists for all navigators in the app.
 * Extracted from src/navigation/AppNavigator.js.
 */

import type { NavigatorScreenParams } from '@react-navigation/native';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  SongSearch: undefined;
  Settings: undefined;
  NotificationSettings: undefined;
  ContactsSettings: undefined;
  SoundSettings: undefined;
  ReadReceiptsSettings: undefined;
  EditProfile: undefined;
  Contributions: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  DeleteAccount: undefined;
  RecentlyDeleted: undefined;
  BlockedUsers: undefined;
  CreateAlbum: undefined;
  AlbumPhotoPicker: { albumId?: string };
  AlbumGrid: { albumId: string; title: string };
  MonthlyAlbumGrid: { year: number; month: number };
  ProfilePhotoCrop: { imageUri: string };
  HelpSupport: undefined;
};

export type MessagesStackParamList = {
  MessagesList: undefined;
  Conversation: { conversationId: string; recipientId: string };
  NewMessage: undefined;
};

export type MainTabsParamList = {
  Feed: undefined;
  Messages: NavigatorScreenParams<MessagesStackParamList>;
  Camera: { openDarkroom?: boolean } | undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

export type OnboardingStackParamList = {
  ProfileSetup: undefined;
  Selects: undefined;
  ContactsSync: undefined;
  NotificationPermission: undefined;
  SongSearch: undefined;
  ProfilePhotoCrop: { imageUri: string };
};

export type RootStackParamList = {
  // Auth screens
  PhoneInput: undefined;
  Verification: { phoneNumber: string; verificationId?: string };

  // Onboarding
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;

  // Main app
  MainTabs: NavigatorScreenParams<MainTabsParamList>;

  // Modal/overlay screens
  PhotoDetail: { photoId: string; mode: 'feed' | 'stories' };
  ProfileFromPhotoDetail: { userId: string; username?: string };
  Darkroom: undefined;
  Success: { message?: string };
  Activity: undefined;
  FriendsList: { userId: string };
  OtherUserProfile: { userId: string; username?: string };
  AlbumGrid: { albumId: string; title: string };
  MonthlyAlbumGrid: { year: number; month: number };
  ReportUser: { userId: string; username: string };
  HelpSupport: undefined;
  SnapCamera: { recipientId?: string; conversationId?: string } | undefined;
  SnapPreviewScreen: { photoUri: string; recipientId: string; conversationId?: string };
};

/**
 * ProfileFromPhotoDetail navigator reuses ProfileStackParamList screens
 * but is a separate stack with subset of screens.
 */
export type ProfileFromPhotoDetailParamList = {
  ProfileMain: { userId: string; username?: string };
  AlbumGrid: { albumId: string; title: string };
  MonthlyAlbumGrid: { year: number; month: number };
};

// Augment the global namespace for useNavigation/useRoute type inference
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
