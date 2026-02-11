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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PixelIcon from '../components/PixelIcon';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input, StepIndicator, ProfileSongCard } from '../components';
import { useAuth } from '../context/AuthContext';
import { uploadProfilePhoto } from '../services/firebase/storageService';
import {
  requestNotificationPermission,
  getNotificationToken,
  storeNotificationToken,
} from '../services/firebase/notificationService';
import {
  validateLength,
  validateUsername,
  sanitizeDisplayName,
  sanitizeBio,
} from '../utils/validation';
import { checkUsernameAvailability, cancelProfileSetup } from '../services/firebase/userService';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';
import logger from '../utils/logger';

const ProfileSetupScreen = ({ navigation, route }) => {
  const { user, userProfile, updateUserProfile, updateUserDocumentNative, signOut } = useAuth();

  // Detect default placeholder values and use empty string instead
  // AuthContext sets 'New User' and 'user_{timestamp}' for new users
  const isDefaultDisplayName = !userProfile?.displayName || userProfile.displayName === 'New User';
  const isDefaultUsername = !userProfile?.username || /^user_\d+$/.test(userProfile.username);

  const [displayName, setDisplayName] = useState(
    isDefaultDisplayName ? '' : userProfile.displayName
  );
  const [username, setUsername] = useState(isDefaultUsername ? '' : userProfile.username);
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [photoUri, setPhotoUri] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(true);

  const [errors, setErrors] = useState({});
  const usernameCheckTimeout = useRef(null);

  // Callback for SongSearchScreen — receives selected song without re-navigating
  const handleSongSelect = useCallback(song => {
    setSelectedSong(song);
    logger.info('ProfileSetupScreen: Song selected', { songId: song.id });
  }, []);

  // Handle cancel profile setup
  const handleCancel = () => {
    Alert.alert(
      'Cancel Setup?',
      "Your profile won't be saved. You'll need to verify your phone number again to sign up.",
      [
        {
          text: 'Keep Setting Up',
          style: 'cancel',
        },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await cancelProfileSetup(user.uid);
              if (result.success) {
                await signOut();
                // Auth state listener will navigate to PhoneInput
              } else {
                Alert.alert('Error', result.error || 'Could not cancel profile setup');
              }
            } catch (error) {
              logger.error('ProfileSetupScreen.handleCancel: Error', error);
              Alert.alert('Error', 'An unexpected error occurred');
            }
          },
        },
      ]
    );
  };

  // Debounced username availability check
  const checkUsername = useCallback(
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
        logger.error('Username availability check failed', { error: result.error });
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
        checkUsername(normalizedText);
      }, 500);
    },
    [checkUsername]
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
  };

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

  const showImagePickerOptions = () => {
    Alert.alert('Profile Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Library', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSongPress = () => {
    navigation.navigate('SongSearch', {
      source: 'ProfileSetup',
      onSongSelect: handleSongSelect,
    });
  };

  const validate = () => {
    const newErrors = {};

    // Username validation
    const usernameError = validateUsername(username.trim());
    if (usernameError) {
      newErrors.username = usernameError;
    } else if (!usernameAvailable) {
      newErrors.username = 'Username is already taken';
    }

    // Display name validation - check required first, then length
    const trimmedDisplayName = displayName.trim();
    if (!trimmedDisplayName) {
      newErrors.displayName = 'Display name is required';
    } else {
      const displayNameError = validateLength(trimmedDisplayName, 2, 24, 'Display name');
      if (displayNameError) {
        newErrors.displayName = displayNameError;
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

  const requestNotificationPermissionsAsync = async () => {
    try {
      // Request notification permission
      const permissionResult = await requestNotificationPermission();

      if (permissionResult.success) {
        // Get FCM token
        const tokenResult = await getNotificationToken();

        if (tokenResult.success && tokenResult.data) {
          // Store token in user document
          await storeNotificationToken(user.uid, tokenResult.data);
          logger.info('Notification permissions granted and token stored');
        } else {
          logger.warn('Could not get notification token', { error: tokenResult.error });
        }
      } else {
        logger.info('Notification permission denied', { error: permissionResult.error });
        // Don't show error to user - notifications are optional
      }
    } catch (error) {
      logger.error('Error requesting notification permissions', error);
      // Don't block user flow - continue even if notifications fail
    }
  };

  const handleNextStep = async () => {
    if (!validate()) {
      Alert.alert('Required Fields', 'Please fill in all required fields before continuing.');
      return;
    }

    // Check if username is still being validated
    if (checkingUsername) {
      Alert.alert('Please Wait', 'Still checking username availability...');
      return;
    }

    setUploading(true);

    try {
      let photoURL = userProfile?.photoURL || null;

      // Upload profile photo if selected
      if (photoUri) {
        const uploadResult = await uploadProfilePhoto(user.uid, photoUri);

        if (uploadResult.success) {
          photoURL = uploadResult.url;
        } else {
          Alert.alert('Upload Failed', 'Could not upload profile photo');
          setUploading(false);
          return;
        }
      }

      // Update user document with sanitized data
      const updateData = {
        username: username.toLowerCase().trim(),
        displayName: sanitizeDisplayName(displayName.trim()),
        bio: sanitizeBio(bio.trim()),
        photoURL,
        profileSong: selectedSong,
        profileSetupCompleted: true,
      };

      const updateResult = await updateUserDocumentNative(user.uid, updateData);

      if (updateResult.success) {
        // Update local profile state
        updateUserProfile({
          ...userProfile,
          ...updateData,
        });

        // Request notification permissions after profile setup
        // This runs in background, doesn't block navigation
        requestNotificationPermissionsAsync();

        // Navigate to Selects screen (now in same Onboarding stack)
        navigation.navigate('Selects');
      } else {
        Alert.alert('Update Failed', 'Could not save profile information');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'An error occurred');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
                <PixelIcon name="chevron-back" size={28} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            <StepIndicator currentStep={1} totalSteps={2} style={styles.stepIndicator} />
            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>Help your friends recognize you</Text>

            <TouchableOpacity style={styles.photoContainer} onPress={showImagePickerOptions}>
              {photoUri || userProfile?.photoURL ? (
                <Image
                  source={{ uri: photoUri || userProfile?.photoURL }}
                  style={styles.profilePhoto}
                />
              ) : (
                <View style={styles.placeholderPhoto}>
                  <PixelIcon name="camera-outline" size={40} color={colors.text.secondary} />
                  <Text style={styles.placeholderText}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.form}>
              <Input
                label="Display Name"
                placeholder="How should friends see you?"
                value={displayName}
                onChangeText={text => {
                  setDisplayName(text);
                  if (errors.displayName) setErrors({ ...errors, displayName: null });
                }}
                error={errors.displayName}
                maxLength={24}
                showCharacterCount={true}
              />

              <Input
                label="Username"
                placeholder="Choose a unique username"
                value={username}
                onChangeText={handleUsernameChange}
                autoCapitalize="none"
                autoCorrect={false}
                error={errors.username}
                rightIcon={
                  checkingUsername
                    ? 'loading'
                    : usernameAvailable && username.length >= 3 && !errors.username
                      ? 'check'
                      : null
                }
                maxLength={24}
                showCharacterCount={true}
              />

              <Input
                label="Bio (Optional)"
                placeholder="Tell us about yourself..."
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={3}
                style={styles.bioInput}
                maxLength={240}
                showCharacterCount={true}
              />

              <View style={styles.songSection}>
                <Text style={styles.songLabel}>Profile Song (Optional)</Text>
                <ProfileSongCard
                  song={selectedSong}
                  isOwnProfile={true}
                  onPress={handleSongPress}
                  onLongPress={() => {
                    if (selectedSong) {
                      Alert.alert('Remove Song', 'Remove this song from your profile?', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: () => setSelectedSong(null),
                        },
                      ]);
                    }
                  }}
                />
              </View>

              <Button
                title="Next step"
                variant="primary"
                onPress={handleNextStep}
                loading={uploading}
                style={styles.nextButton}
              />
            </View>
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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  backButton: {
    padding: spacing.xxs,
  },
  title: {
    fontSize: typography.size.xxxl,
    fontFamily: typography.fontFamily.display,
    textAlign: 'center',
    marginBottom: spacing.xs,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    textAlign: 'center',
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },
  photoContainer: {
    alignSelf: 'center',
    marginBottom: spacing.xl,
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
    borderStyle: 'dashed',
  },
  placeholderText: {
    marginTop: spacing.xs,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
  },
  form: {
    width: '100%',
  },
  disabledInput: {
    opacity: 0.6,
  },
  bioInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  songSection: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  songLabel: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  stepIndicator: {
    marginBottom: spacing.md,
  },
  nextButton: {
    marginTop: spacing.xs,
  },
});

export default ProfileSetupScreen;
