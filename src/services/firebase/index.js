// Firebase services - All using React Native Firebase SDK
// Auth: @react-native-firebase/auth (via AuthContext and phoneAuthService)
// Firestore: @react-native-firebase/firestore (via service files)
// Storage: @react-native-firebase/storage (via storageService)

export {
  uploadProfilePhoto,
  uploadPhoto,
  deleteProfilePhoto,
  deletePhoto,
  getPhotoURL,
} from './storageService';

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

export {
  validatePhoneNumber,
  sendVerificationCode,
  verifyCode,
  getCurrentUser as getPhoneAuthCurrentUser,
  signOut as phoneAuthSignOut,
  onAuthStateChanged as phoneAuthOnAuthStateChanged,
  getPhoneAuthErrorMessage,
} from './phoneAuthService';

export { getSignedPhotoUrl, convertToSignedUrl } from './signedUrlService';

export { deleteUserAccount } from './accountService';

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

export { getPhotosByIds } from './photoService';

export { getUserPhotosByMonth, getMonthPhotos } from './monthlyAlbumService';

export { getUserProfile, cancelProfileSetup } from './userService';

export {
  checkFriendshipStatus,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  generateFriendshipId,
} from './friendshipService';

export {
  normalizeToE164,
  requestContactsPermission,
  checkContactsPermission,
  getAllContactPhoneNumbers,
  findUsersByPhoneNumbers,
  getUserCountryCode,
  syncContactsAndFindSuggestions,
  getDismissedSuggestionIds,
  filterDismissedSuggestions,
  dismissSuggestion,
  markContactsSyncCompleted,
  hasUserSyncedContacts,
  clearDismissedSuggestions,
} from './contactSyncService';

export {
  blockUser,
  unblockUser,
  isBlocked,
  getBlockedByUserIds,
  getBlockedUserIds,
  getBlockedUsersWithProfiles,
} from './blockService';

export { submitReport, REPORT_REASONS } from './reportService';

export { initPerformanceMonitoring, withTrace } from './performanceService';

export { getMutualFriendsForTagging } from './mentionService';
