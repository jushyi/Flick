// Export Firebase configuration and instances
export { app, auth, db, storage } from './firebaseConfig';

// Export Auth service functions
export {
  signUpWithEmail,
  signInWithEmail,
  signOutUser,
  resetPassword,
  updateUserProfile,
  getCurrentUser,
} from './authService';

// Export Firestore service functions
export {
  createUserDocument,
  getUserDocument,
  updateUserDocument,
  createPhotoDocument,
  getUserPhotos,
  updatePhotoDocument,
  deletePhotoDocument,
  createFriendship,
  acceptFriendship,
  getUserFriends,
  createNotification,
  markNotificationAsRead,
  createPhotoView,
  hasUserViewedPhoto,
} from './firestoreService';

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