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

// Export Signed URL service functions (for secure photo access)
export { getSignedPhotoUrl, convertToSignedUrl } from './signedUrlService';

// Export Account service functions (account deletion)
export { deleteUserAccount } from './accountService';

// Export Album service functions (user-created photo albums)
export {
  createAlbum,
  getAlbum,
  getUserAlbums,
  updateAlbum,
  deleteAlbum,
  addPhotosToAlbum,
  removePhotoFromAlbum,
  setCoverPhoto,
} from './albumService';

// Export Photo service functions
export { getPhotosByIds } from './photoService';

// Export Monthly Album service functions (auto-generated monthly albums)
export { getUserPhotosByMonth, getMonthPhotos } from './monthlyAlbumService';

// Export User service functions
export { getUserProfile, cancelProfileSetup } from './userService';

// Export Friendship service functions
export {
  checkFriendshipStatus,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  generateFriendshipId,
} from './friendshipService';

// Export Contact Sync service functions (friend suggestions via contacts)
export {
  normalizeToE164,
  requestContactsPermission,
  checkContactsPermission,
  getAllContactPhoneNumbers,
  findUsersByPhoneNumbers,
} from './contactSyncService';
