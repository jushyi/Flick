// Firebase services - All using React Native Firebase SDK
// Auth: @react-native-firebase/auth (via AuthContext and phoneAuthService)
// Firestore: @react-native-firebase/firestore (via service files)
// Storage: @react-native-firebase/storage (via storageService)

// Export Storage service functions
export {
  uploadProfilePhoto,
  uploadPhoto,
  deleteProfilePhoto,
  deletePhoto,
  getPhotoURL,
} from './storageService';

// Export Notification service functions
export {
  initializeNotifications,
  requestNotificationPermission,
  getNotificationToken,
  storeNotificationToken,
  handleNotificationReceived,
  handleNotificationTapped,
  checkNotificationPermissions,
  scheduleTestNotification,
} from './notificationService';

// Export Phone Auth service functions (React Native Firebase)
export {
  validatePhoneNumber,
  sendVerificationCode,
  verifyCode,
  getCurrentUser as getPhoneAuthCurrentUser,
  signOut as phoneAuthSignOut,
  onAuthStateChanged as phoneAuthOnAuthStateChanged,
  getPhoneAuthErrorMessage,
} from './phoneAuthService';
