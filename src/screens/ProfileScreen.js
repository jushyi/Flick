import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
import { SelectsBanner } from '../components';
import logger from '../utils/logger';

const HEADER_HEIGHT = 64;
const PROFILE_PHOTO_SIZE = 120;

const ProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, userProfile } = useAuth();
  const insets = useSafeAreaInsets();

  // Get route params for viewing other users' profiles
  const { userId, username: routeUsername } = route.params || {};

  // Determine if viewing own profile vs another user's profile
  const isOwnProfile = !userId || userId === user?.uid;

  // TODO: Fetch other user's profile data from Firestore
  // For now, use own profile for own view, placeholder for other users
  const profileData = isOwnProfile
    ? userProfile
    : {
        username: routeUsername || 'user',
        displayName: routeUsername || 'User',
        photoURL: null,
        bio: null,
        selects: [], // Placeholder - will be fetched from Firestore
      };

  const handleBackPress = () => {
    logger.info('ProfileScreen: Back button pressed');
    navigation.goBack();
  };

  const handleFriendsPress = () => {
    logger.info('ProfileScreen: Friends button pressed');
    navigation.navigate('FriendsList');
  };

  const handleSettingsPress = () => {
    logger.info('ProfileScreen: Settings button pressed');
    navigation.navigate('Settings');
  };

  const handleSelectsTap = () => {
    logger.info('ProfileScreen: SelectsBanner tapped', { isOwnProfile });
    // TODO: Plan 06-02 - Navigate to fullscreen (other profile) or edit mode (own profile)
  };

  // Handle loading state
  if (!userProfile) {
    return (
      <View style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header - 3 column layout */}
      <View style={[styles.header, { top: insets.top }]}>
        {/* Left: Friends icon (own) or Back arrow (other user) */}
        {isOwnProfile ? (
          <TouchableOpacity onPress={handleFriendsPress} style={styles.headerButton}>
            <Ionicons name="people-outline" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        )}

        {/* Center: Username */}
        <Text style={styles.headerTitle}>
          {isOwnProfile ? userProfile?.username || 'Profile' : routeUsername || 'Profile'}
        </Text>

        {/* Right: Settings icon (own) or empty space (other user) */}
        {isOwnProfile ? (
          <TouchableOpacity onPress={handleSettingsPress} style={styles.headerButton}>
            <Ionicons name="settings-outline" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Selects Banner */}
        <View
          style={[styles.selectsBannerContainer, { marginTop: insets.top + HEADER_HEIGHT + 16 }]}
        >
          <SelectsBanner
            selects={profileData?.selects || []}
            isOwnProfile={isOwnProfile}
            onTap={handleSelectsTap}
          />
        </View>

        {/* 2. Profile Section - Photo overlaps onto Selects, info cards below */}
        <View style={styles.profileSection}>
          {/* Profile Photo (absolutely positioned, overlapping Selects) */}
          <View style={styles.profilePhotoContainer}>
            {profileData?.photoURL ? (
              <Image source={{ uri: profileData.photoURL }} style={styles.profilePhoto} />
            ) : (
              <View style={[styles.profilePhoto, styles.profilePhotoPlaceholder]}>
                <Ionicons name="person" size={60} color={colors.text.secondary} />
              </View>
            )}
          </View>

          {/* Profile Info Card - left half, best friends will go on right */}
          <View style={styles.profileInfoCard}>
            <Text style={styles.displayName}>{profileData?.displayName || 'New User'}</Text>
            <Text style={styles.username}>@{profileData?.username || 'username'}</Text>
            <Text style={[styles.bio, !profileData?.bio && styles.bioPlaceholder]}>
              {profileData?.bio || 'No bio yet'}
            </Text>
          </View>
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
    </View>
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
  // Selects Banner Container
  selectsBannerContainer: {
    marginHorizontal: 16,
  },
  // Profile Section
  profileSection: {
    marginTop: 16,
    marginHorizontal: 16,
    flexDirection: 'row',
  },
  profilePhotoContainer: {
    position: 'absolute',
    left: '50%',
    marginLeft: -PROFILE_PHOTO_SIZE / 2,
    top: -PROFILE_PHOTO_SIZE / 2 - 8, // Slight overlap onto Selects banner
    zIndex: 5,
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
  // Profile Info Card - left half
  profileInfoCard: {
    flex: 1,
    maxWidth: '48%',
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    padding: 12,
  },
  displayName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  username: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 4,
  },
  bio: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 8,
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
