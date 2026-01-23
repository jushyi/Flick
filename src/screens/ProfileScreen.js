import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components';
import { useAuth } from '../context/AuthContext';
import { getFirestore, collection, query, where, getDocs } from '@react-native-firebase/firestore';
import { getFriendUserIds } from '../services/firebase/friendshipService';
import logger from '../utils/logger';

// Initialize Firestore
const db = getFirestore();

const ProfileScreen = () => {
  const { signOut, user, userProfile } = useAuth();
  const [stats, setStats] = useState({ posts: 0, friends: 0, reactions: 0 });
  const [loading, setLoading] = useState(true);

  // Load user stats on mount
  useEffect(() => {
    const loadStats = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Get total photos (journaled + archived)
        const photosQuery = query(
          collection(db, 'photos'),
          where('userId', '==', user.uid),
          where('status', '==', 'triaged')
        );
        const photosSnapshot = await getDocs(photosQuery);
        const postsCount = photosSnapshot.size;

        // Get friends count
        const friendIds = await getFriendUserIds(user.uid);
        const friendsCount = friendIds.length;

        // Get total reactions received on user's photos
        let reactionsCount = 0;
        photosSnapshot.docs.forEach(doc => {
          const photoData = doc.data();
          reactionsCount += photoData.reactionCount || 0;
        });

        setStats({
          posts: postsCount,
          friends: friendsCount,
          reactions: reactionsCount,
        });
      } catch (error) {
        logger.error('Error loading profile stats', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
  };

  // Show loading state while fetching data
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <View style={styles.profileSection}>
          {userProfile?.profilePhotoURL ? (
            <Image source={{ uri: userProfile.profilePhotoURL }} style={styles.profilePhoto} />
          ) : (
            <View style={styles.profilePhoto}>
              <Text style={styles.profilePhotoText}>
                {userProfile?.displayName?.charAt(0).toUpperCase() || '👤'}
              </Text>
            </View>
          )}
          <Text style={styles.username}>@{userProfile?.username || 'username'}</Text>
          <Text style={styles.bio}>
            {userProfile?.bio || 'No bio yet. Tap Edit Profile to add one.'}
          </Text>

          <View style={styles.stats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.posts}</Text>
              <Text style={styles.statLabel}>Photos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.friends}</Text>
              <Text style={styles.statLabel}>Friends</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.reactions}</Text>
              <Text style={styles.statLabel}>Reactions</Text>
            </View>
          </View>
        </View>

        <View style={styles.comingSoonSection}>
          <Text style={styles.comingSoonIcon}>📸</Text>
          <Text style={styles.comingSoonTitle}>Photo Gallery</Text>
          <Text style={styles.comingSoonText}>
            Your photo gallery and filters will be available in the next update
          </Text>
        </View>

        <Button
          title="Edit Profile"
          variant="outline"
          onPress={() => logger.debug('Edit profile button pressed')}
          style={styles.editButton}
        />

        <Button
          title="Sign Out"
          variant="secondary"
          onPress={handleSignOut}
          style={styles.signOutButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  profilePhotoText: {
    fontSize: 48,
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 24,
    textAlign: 'center',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '80%',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  comingSoonSection: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
  },
  comingSoonIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  comingSoonTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  comingSoonText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },
  editButton: {
    marginHorizontal: 24,
    marginBottom: 16,
  },
  signOutButton: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
});

export default ProfileScreen;
