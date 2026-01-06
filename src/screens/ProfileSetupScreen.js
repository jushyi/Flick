import React, { useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import { Button, Input } from '../components';
import { useAuth } from '../context/AuthContext';
import { uploadProfilePhoto } from '../services/firebase/storageService';
import { updateUserDocument } from '../services/firebase/firestoreService';

const ProfileSetupScreen = ({ navigation }) => {
  const { user, userProfile, updateUserProfile } = useAuth();

  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [photoUri, setPhotoUri] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [errors, setErrors] = useState({});

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const showImagePickerOptions = () => {
    Alert.alert('Profile Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Library', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const validate = () => {
    const newErrors = {};

    if (!displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    } else if (displayName.trim().length < 2) {
      newErrors.displayName = 'Display name must be at least 2 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCompleteSetup = async () => {
    if (!validate()) {
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
        }
      }

      // Update user document
      const updateData = {
        displayName: displayName.trim(),
        bio: bio.trim(),
        photoURL,
      };

      const updateResult = await updateUserDocument(user.uid, updateData);

      if (updateResult.success) {
        // Update local profile state
        updateUserProfile({
          ...userProfile,
          ...updateData,
        });

        // Navigation will be handled by AuthContext - user is now fully set up
      } else {
        Alert.alert('Update Failed', 'Could not save profile information');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'An error occurred');
    } finally {
      setUploading(false);
    }
  };

  const handleSkip = () => {
    // User can skip profile setup and complete it later
    // This just dismisses the screen
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
            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>
              Help your friends recognize you
            </Text>

            <TouchableOpacity
              style={styles.photoContainer}
              onPress={showImagePickerOptions}
            >
              {photoUri || userProfile?.photoURL ? (
                <Image
                  source={{ uri: photoUri || userProfile?.photoURL }}
                  style={styles.profilePhoto}
                />
              ) : (
                <View style={styles.placeholderPhoto}>
                  <Text style={styles.placeholderIcon}>📷</Text>
                  <Text style={styles.placeholderText}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.form}>
              <Input
                label="Display Name"
                placeholder="How should friends see you?"
                value={displayName}
                onChangeText={(text) => {
                  setDisplayName(text);
                  if (errors.displayName) setErrors({ ...errors, displayName: null });
                }}
                error={errors.displayName}
              />

              <Input
                label="Username"
                placeholder={userProfile?.username || 'username'}
                value={userProfile?.username || ''}
                editable={false}
                style={styles.disabledInput}
              />

              <Input
                label="Bio (Optional)"
                placeholder="Tell us about yourself..."
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={3}
                style={styles.bioInput}
              />

              <Button
                title="Complete Setup"
                variant="primary"
                onPress={handleCompleteSetup}
                loading={uploading}
                style={styles.completeButton}
              />

              <Text style={styles.skipText} onPress={handleSkip}>
                Skip for now
              </Text>
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
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666666',
    marginBottom: 32,
  },
  photoContainer: {
    alignSelf: 'center',
    marginBottom: 32,
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
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  placeholderIcon: {
    fontSize: 40,
    marginBottom: 4,
  },
  placeholderText: {
    fontSize: 14,
    color: '#666666',
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
  completeButton: {
    marginTop: 8,
  },
  skipText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 16,
    textDecorationLine: 'underline',
  },
});

export default ProfileSetupScreen;