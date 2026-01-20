import storage from '@react-native-firebase/storage';
import * as ImageManipulator from 'expo-image-manipulator';
import logger from '../../utils/logger';

/**
 * Convert URI to local file path for RN Firebase putFile
 * @param {string} uri - File URI (may start with file://)
 * @returns {string} - Local file path without file:// prefix
 */
const uriToFilePath = (uri) => {
  // RN Firebase putFile needs path without file:// prefix
  if (uri.startsWith('file://')) {
    return uri.substring(7);
  }
  return uri;
};

/**
 * Compress image before upload
 * @param {string} uri - Local image URI
 * @param {number} quality - Compression quality (0-1)
 * @returns {Promise<string>} - Compressed image URI
 */
const compressImage = async (uri, quality = 0.7) => {
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1080 } }], // Resize to max 1080px width
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );
    return manipResult.uri;
  } catch (error) {
    logger.error('Image compression error', error);
    return uri; // Return original if compression fails
  }
};

/**
 * Upload profile photo to Firebase Storage
 * @param {string} userId - User ID
 * @param {string} localUri - Local image URI
 * @returns {Promise}
 */
export const uploadProfilePhoto = async (userId, localUri) => {
  try {
    logger.debug('StorageService.uploadProfilePhoto: Starting', { userId });

    // Compress image first
    const compressedUri = await compressImage(localUri, 0.7);

    // Convert URI to file path for RN Firebase
    const filePath = uriToFilePath(compressedUri);

    // Create storage reference (RN Firebase pattern)
    const storageRef = storage().ref(`profile_photos/${userId}.jpg`);

    // Upload file directly (no blob needed with RN Firebase)
    await storageRef.putFile(filePath);

    // Get download URL
    const downloadURL = await storageRef.getDownloadURL();

    logger.info('StorageService.uploadProfilePhoto: Upload successful', { userId });
    return { success: true, url: downloadURL };
  } catch (error) {
    logger.error('StorageService.uploadProfilePhoto: Failed', { userId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Upload photo to Firebase Storage
 * @param {string} photoId - Photo document ID
 * @param {string} localUri - Local image URI
 * @returns {Promise}
 */
export const uploadPhoto = async (photoId, localUri) => {
  try {
    logger.debug('StorageService.uploadPhoto: Starting', { photoId });

    // Compress image first
    const compressedUri = await compressImage(localUri, 0.8);

    // Convert URI to file path for RN Firebase
    const filePath = uriToFilePath(compressedUri);

    // Create storage reference (RN Firebase pattern)
    const storageRef = storage().ref(`photos/${photoId}.jpg`);

    // Upload file directly (no blob needed with RN Firebase)
    await storageRef.putFile(filePath);

    // Get download URL
    const downloadURL = await storageRef.getDownloadURL();

    logger.info('StorageService.uploadPhoto: Upload successful', { photoId });
    return { success: true, url: downloadURL };
  } catch (error) {
    logger.error('StorageService.uploadPhoto: Failed', { photoId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Delete profile photo from Firebase Storage
 * @param {string} userId - User ID
 * @returns {Promise}
 */
export const deleteProfilePhoto = async (userId) => {
  try {
    logger.debug('StorageService.deleteProfilePhoto: Starting', { userId });

    const storageRef = storage().ref(`profile_photos/${userId}.jpg`);
    await storageRef.delete();

    logger.info('StorageService.deleteProfilePhoto: Deleted', { userId });
    return { success: true };
  } catch (error) {
    logger.error('StorageService.deleteProfilePhoto: Failed', { userId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Delete photo from Firebase Storage
 * @param {string} photoId - Photo ID
 * @returns {Promise}
 */
export const deletePhoto = async (photoId) => {
  try {
    logger.debug('StorageService.deletePhoto: Starting', { photoId });

    const storageRef = storage().ref(`photos/${photoId}.jpg`);
    await storageRef.delete();

    logger.info('StorageService.deletePhoto: Deleted', { photoId });
    return { success: true };
  } catch (error) {
    logger.error('StorageService.deletePhoto: Failed', { photoId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Get download URL for a photo
 * @param {string} photoId - Photo ID
 * @returns {Promise}
 */
export const getPhotoURL = async (photoId) => {
  try {
    logger.debug('StorageService.getPhotoURL: Starting', { photoId });

    const storageRef = storage().ref(`photos/${photoId}.jpg`);
    const downloadURL = await storageRef.getDownloadURL();

    logger.info('StorageService.getPhotoURL: Retrieved', { photoId });
    return { success: true, url: downloadURL };
  } catch (error) {
    logger.error('StorageService.getPhotoURL: Failed', { photoId, error: error.message });
    return { success: false, error: error.message };
  }
};
