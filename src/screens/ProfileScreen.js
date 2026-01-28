import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
import logger from '../utils/logger';

const HEADER_HEIGHT = 56;
const PROFILE_PHOTO_SIZE = 80;

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { userProfile } = useAuth();

  const handleFriendsPress = () => {
    logger.info('ProfileScreen: Friends button pressed');
    navigation.navigate('FriendsList');
  };

  const handleSettingsPress = () => {
    logger.info('ProfileScreen: Settings button pressed');
    navigation.navigate('Settings');
  };

  const handleEditProfile = () => {
    logger.info('ProfileScreen: Edit profile pressed');
    // Navigation to edit screen is future
  };

  // Handle loading state
  if (!userProfile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header - 3 column layout */}
      <View style={styles.header}>
        {/* Left: Friends icon */}
        <TouchableOpacity onPress={handleFriendsPress} style={styles.headerButton}>
          <Ionicons name="people-outline" size={24} color={colors.text.primary} />
        </TouchableOpacity>

        {/* Center: Username */}
        <Text style={styles.headerTitle}>{userProfile?.username || 'Profile'}</Text>

        {/* Right: Settings icon */}
        <TouchableOpacity onPress={handleSettingsPress} style={styles.headerButton}>
          <Ionicons name="settings-outline" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Selects Banner Placeholder */}
        <View style={styles.selectsBanner}>
          <Text style={styles.selectsBannerText}>Selects</Text>
        </View>

        {/* 2. Profile Photo (overlapping) */}
        <View style={styles.profilePhotoContainer}>
          {userProfile?.photoURL ? (
            <Image source={{ uri: userProfile.photoURL }} style={styles.profilePhoto} />
          ) : (
            <View style={[styles.profilePhoto, styles.profilePhotoPlaceholder]}>
              <Ionicons name="person" size={40} color={colors.text.secondary} />
            </View>
          )}
        </View>

        {/* 3. Profile Info Section */}
        <View style={styles.profileInfo}>
          {/* Display Name */}
          <Text style={styles.displayName}>{userProfile?.displayName || 'New User'}</Text>

          {/* Username Row with Edit Icon */}
          <View style={styles.usernameRow}>
            <Text style={styles.username}>@{userProfile?.username || 'username'}</Text>
            <TouchableOpacity onPress={handleEditProfile} style={styles.editButton}>
              <Ionicons name="create-outline" size={16} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Bio */}
          <Text style={[styles.bio, !userProfile?.bio && styles.bioPlaceholder]}>
            {userProfile?.bio || 'No bio yet'}
          </Text>
        </View>

        {/* 4. Future Feature Placeholders */}
        <View style={styles.featurePlaceholder}>
          <Text style={styles.placeholderText}>Profile Song</Text>
        </View>

        <View style={[styles.featurePlaceholder, styles.featurePlaceholderLarge]}>
          <Text style={styles.placeholderText}>Albums</Text>
        </View>

        <View style={[styles.featurePlaceholder, styles.featurePlaceholderLarge]}>
          <Text style={styles.placeholderText}>Monthly Albums</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: 16,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120, // Tab bar clearance
  },
  // Selects Banner
  selectsBanner: {
    marginTop: HEADER_HEIGHT,
    marginHorizontal: 16,
    height: 250,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectsBannerText: {
    color: colors.text.secondary,
    fontSize: 16,
  },
  // Profile Photo
  profilePhotoContainer: {
    alignSelf: 'center',
    marginTop: -PROFILE_PHOTO_SIZE / 2, // Overlap onto Selects banner
  },
  profilePhoto: {
    width: PROFILE_PHOTO_SIZE,
    height: PROFILE_PHOTO_SIZE,
    borderRadius: PROFILE_PHOTO_SIZE / 2,
    borderWidth: 3,
    borderColor: colors.background.primary,
  },
  profilePhotoPlaceholder: {
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Profile Info
  profileInfo: {
    paddingTop: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  displayName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: 8,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  username: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  editButton: {
    marginLeft: 8,
    padding: 4,
  },
  bio: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 280,
  },
  bioPlaceholder: {
    fontStyle: 'italic',
  },
  // Feature Placeholders
  featurePlaceholder: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    height: 60,
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featurePlaceholderLarge: {
    height: 80,
  },
  placeholderText: {
    color: colors.text.secondary,
    fontSize: 16,
  },
});

export default ProfileScreen;
