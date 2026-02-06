import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Input } from '../components';
import { useAuth } from '../context/AuthContext';
import { uploadProfilePhoto, deleteProfilePhoto } from '../services/firebase/storageService';
import {
  validateLength,
  validateUsername,
  sanitizeDisplayName,
  sanitizeBio,
} from '../utils/validation';
import {
  checkUsernameAvailability,
  updateUserProfile as updateUserProfileService,
  canChangeUsername,
} from '../services/firebase/userService';
import { colors } from '../constants/colors';
import logger from '../utils/logger';

/**
 * EditProfileScreen
 *
 * Allows users to edit their profile information:
 * - Display name (24 chars)
 * - Username (24 chars, 14-day change restriction)
 * - Bio (240 chars)
 * - Profile photo
 *
 * Follows patterns from ProfileSetupScreen for consistency.
 */
const EditProfileScreen = ({ navigation }) => {
  const { user, userProfile, updateUserProfile } = useAuth();

  // Initialize form state from userProfile
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [username, setUsername] = useState(userProfile?.username || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [photoUri, setPhotoUri] = useState(null); // New photo selected
  const [photoRemoved, setPhotoRemoved] = useState(false); // Photo explicitly removed
  const [saving, setSaving] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(true);
  const [errors, setErrors] = useState({});

  // Username restriction state
  const [canEditUsername, setCanEditUsername] = useState(true);
  const [daysUntilUsernameChange, setDaysUntilUsernameChange] = useState(0);

  const usernameCheckTimeout = useRef(null);

  // Check username restriction on mount
  useEffect(() => {
    const restriction = canChangeUsername(userProfile?.lastUsernameChange);
    setCanEditUsername(restriction.canChange);
    setDaysUntilUsernameChange(restriction.daysRemaining || 0);
  }, [userProfile?.lastUsernameChange]);

  // Track if any changes have been made
  const hasChanges = useCallback(() => {
    const displayNameChanged = displayName.trim() !== (userProfile?.displayName || '');
    const usernameChanged =
      username.toLowerCase().trim() !== (userProfile?.username || '').toLowerCase();
    const bioChanged = bio.trim() !== (userProfile?.bio || '');
    const photoChanged = photoUri !== null || photoRemoved;

    return displayNameChanged || usernameChanged || bioChanged || photoChanged;
  }, [displayName, username, bio, photoUri, photoRemoved, userProfile]);

  // Check if form is valid
  const isFormValid = useCallback(() => {
    // Display name is required
    if (!displayName.trim()) return false;
    // Username must be available (or unchanged)
    if (
      !usernameAvailable &&
      username.toLowerCase().trim() !== userProfile?.username?.toLowerCase()
    ) {
      return false;
    }
    // No errors
    if (Object.values(errors).some(error => error)) return false;
    return true;
  }, [displayName, usernameAvailable, username, userProfile?.username, errors]);

  // Debounced username availability check
  const checkUsernameHandler = useCallback(
    async usernameToCheck => {
      const normalizedUsername = usernameToCheck.toLowerCase().trim();

      // Skip check if username hasn't changed from original
      if (normalizedUsername === userProfile?.username?.toLowerCase()) {
        setUsernameAvailable(true);
        setCheckingUsername(false);
        return;
      }

      // Validate format first
      const formatError = validateUsername(normalizedUsername);
      if (formatError) {
        setErrors(prev => ({ ...prev, username: formatError }));
        setCheckingUsername(false);
        return;
      }

      setCheckingUsername(true);
      const result = await checkUsernameAvailability(normalizedUsername, user.uid);

      if (result.success) {
        setUsernameAvailable(result.available);
        if (!result.available) {
          setErrors(prev => ({ ...prev, username: 'Username is already taken' }));
        } else {
          setErrors(prev => ({ ...prev, username: null }));
        }
      } else {
        logger.error('EditProfileScreen: Username availability check failed', {
          error: result.error,
        });
      }
      setCheckingUsername(false);
    },
    [user.uid, userProfile?.username]
  );

  // Handle username change with debounce
  const handleUsernameChange = useCallback(
    text => {
      const normalizedText = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
      setUsername(normalizedText);
      setErrors(prev => ({ ...prev, username: null }));

      // Clear previous timeout
      if (usernameCheckTimeout.current) {
        clearTimeout(usernameCheckTimeout.current);
      }

      // Don't check empty or very short usernames
      if (normalizedText.length < 3) {
        setUsernameAvailable(true);
        return;
      }

      // Debounce the availability check
      usernameCheckTimeout.current = setTimeout(() => {
        checkUsernameHandler(normalizedText);
      }, 500);
    },
    [checkUsernameHandler]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (usernameCheckTimeout.current) {
        clearTimeout(usernameCheckTimeout.current);
      }
    };
  }, []);

  // Callback for crop screen completion
  const handleCropComplete = croppedUri => {
    setPhotoUri(croppedUri);
    setPhotoRemoved(false);
  };

  // Photo picker functions
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      // Navigate to crop screen
      navigation.navigate('ProfilePhotoCrop', {
        imageUri: result.assets[0].uri,
        onCropComplete: handleCropComplete,
      });
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      // Navigate to crop screen
      navigation.navigate('ProfilePhotoCrop', {
        imageUri: result.assets[0].uri,
        onCropComplete: handleCropComplete,
      });
    }
  };

  const removePhoto = () => {
    setPhotoUri(null);
    setPhotoRemoved(true);
  };

  const showPhotoOptions = () => {
    const options = [
      { text: 'Take New Picture', onPress: takePhoto },
      { text: 'Choose from Library', onPress: pickImage },
    ];

    // Only show remove option if user has a photo
    if ((userProfile?.photoURL && !photoRemoved) || photoUri) {
      options.push({
        text: 'Remove Photo',
        onPress: removePhoto,
        style: 'destructive',
      });
    }

    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Profile Photo', 'Choose an option', options);
  };

  // Get current photo to display
  const getCurrentPhotoUri = () => {
    if (photoRemoved) return null;
    if (photoUri) return photoUri;
    return userProfile?.photoURL || null;
  };

  // Validate form
  const validate = () => {
    const newErrors = {};

    // Display name validation - required
    const trimmedDisplayName = displayName.trim();
    if (!trimmedDisplayName) {
      newErrors.displayName = 'Display name is required';
    } else {
      const displayNameError = validateLength(trimmedDisplayName, 2, 24, 'Display name');
      if (displayNameError) {
        newErrors.displayName = displayNameError;
      }
    }

    // Username validation (only if can edit and changed)
    if (canEditUsername && username.toLowerCase().trim() !== userProfile?.username?.toLowerCase()) {
      const usernameError = validateUsername(username.trim());
      if (usernameError) {
        newErrors.username = usernameError;
      } else if (!usernameAvailable) {
        newErrors.username = 'Username is already taken';
      }
    }

    // Bio validation (optional field)
    if (bio && bio.trim().length > 0) {
      const bioError = validateLength(bio.trim(), 1, 240, 'Bio');
      if (bioError) {
        newErrors.bio = bioError;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    // Check if username is still being validated
    if (checkingUsername) {
      Alert.alert('Please Wait', 'Still checking username availability...');
      return;
    }

    setSaving(true);

    try {
      let photoURL = userProfile?.photoURL || null;

      // Handle photo changes
      if (photoRemoved) {
        // User removed their photo
        photoURL = null;
        // Optionally delete from storage
        if (userProfile?.photoURL) {
          await deleteProfilePhoto(user.uid);
        }
      } else if (photoUri) {
        // User selected a new photo
        const uploadResult = await uploadProfilePhoto(user.uid, photoUri);
        if (uploadResult.success) {
          photoURL = uploadResult.url;
        } else {
          Alert.alert('Upload Failed', 'Could not upload profile photo');
          setSaving(false);
          return;
        }
      }

      // Prepare update data
      const updates = {
        displayName: sanitizeDisplayName(displayName.trim()),
        bio: sanitizeBio(bio.trim()),
        photoURL,
      };

      // Only include username if changed and allowed
      if (
        canEditUsername &&
        username.toLowerCase().trim() !== userProfile?.username?.toLowerCase()
      ) {
        updates.username = username.toLowerCase().trim();
      }

      // Update profile in Firestore
      const updateResult = await updateUserProfileService(user.uid, updates, userProfile?.username);

      if (updateResult.success) {
        // Update local profile state
        updateUserProfile({
          ...userProfile,
          ...updates,
          // Update lastUsernameChange if username changed
          ...(updates.username && updates.username !== userProfile?.username
            ? { lastUsernameChange: new Date() }
            : {}),
        });

        // Navigate to profile
        navigation.navigate('ProfileMain');
      } else {
        Alert.alert('Update Failed', updateResult.error || 'Could not save profile changes');
      }
    } catch (error) {
      logger.error('EditProfileScreen: Save failed', { error: error.message });
      Alert.alert('Error', error.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (hasChanges()) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const currentPhotoUri = getCurrentPhotoUri();
  const saveEnabled = hasChanges() && isFormValid() && !saving && !checkingUsername;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={styles.headerButton}
            disabled={!saveEnabled}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.brand.purple} />
            ) : (
              <Text style={[styles.saveText, !saveEnabled && styles.saveTextDisabled]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile Photo */}
          <TouchableOpacity style={styles.photoContainer} onPress={showPhotoOptions}>
            {currentPhotoUri ? (
              <Image source={{ uri: currentPhotoUri }} style={styles.profilePhoto} />
            ) : (
              <View style={styles.placeholderPhoto}>
                <Ionicons name="person" size={48} color={colors.text.secondary} />
              </View>
            )}
            <View style={styles.photoEditBadge}>
              <Ionicons name="camera" size={16} color={colors.text.primary} />
            </View>
          </TouchableOpacity>
          <Text style={styles.changePhotoText}>Change Photo</Text>

          {/* Form Fields */}
          <View style={styles.form}>
            <Input
              label="Display Name"
              placeholder="Your display name"
              value={displayName}
              onChangeText={text => {
                setDisplayName(text);
                if (errors.displayName) setErrors(prev => ({ ...prev, displayName: null }));
              }}
              error={errors.displayName}
              maxLength={24}
              showCharacterCount={true}
            />

            <View style={styles.usernameContainer}>
              <Input
                label="Username"
                placeholder="Your username"
                value={username}
                onChangeText={canEditUsername ? handleUsernameChange : undefined}
                autoCapitalize="none"
                autoCorrect={false}
                error={errors.username}
                editable={canEditUsername}
                rightIcon={
                  canEditUsername
                    ? checkingUsername
                      ? 'loading'
                      : usernameAvailable &&
                          username.length >= 3 &&
                          !errors.username &&
                          username.toLowerCase().trim() !== userProfile?.username?.toLowerCase()
                        ? 'check'
                        : null
                    : null
                }
                maxLength={24}
                showCharacterCount={canEditUsername}
                style={!canEditUsername ? styles.disabledInput : undefined}
              />
              {!canEditUsername && (
                <Text style={styles.usernameRestrictionHint}>
                  Can change username in {daysUntilUsernameChange} day
                  {daysUntilUsernameChange !== 1 ? 's' : ''}
                </Text>
              )}
            </View>

            <Input
              label="Bio"
              placeholder="Tell us about yourself..."
              value={bio}
              onChangeText={text => {
                setBio(text);
                if (errors.bio) setErrors(prev => ({ ...prev, bio: null }));
              }}
              multiline
              numberOfLines={3}
              style={styles.bioInput}
              error={errors.bio}
              maxLength={240}
              showCharacterCount={true}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerButton: {
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  cancelText: {
    fontSize: 16,
    color: colors.text.primary,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.brand.purple,
    textAlign: 'right',
  },
  saveTextDisabled: {
    opacity: 0.4,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  photoContainer: {
    alignSelf: 'center',
    position: 'relative',
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  placeholderPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border.subtle,
  },
  photoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background.primary,
  },
  changePhotoText: {
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 32,
    fontSize: 14,
    fontWeight: '600',
    color: colors.brand.purple,
  },
  form: {
    width: '100%',
  },
  usernameContainer: {
    marginBottom: 0,
  },
  disabledInput: {
    opacity: 0.6,
  },
  usernameRestrictionHint: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: -8,
    marginBottom: 16,
    marginLeft: 4,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
});

export default EditProfileScreen;
