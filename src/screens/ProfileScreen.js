import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components';
import { useAuth } from '../context/AuthContext';

const ProfileScreen = () => {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.backButton}>← Back</Text>
          <Text style={styles.settingsButton}>⚙ Settings</Text>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.profilePhoto}>
            <Text style={styles.profilePhotoText}>👤</Text>
          </View>
          <Text style={styles.username}>@username</Text>
          <Text style={styles.bio}>Your bio goes here...</Text>

          <View style={styles.stats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>127</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>56</Text>
              <Text style={styles.statLabel}>Friends</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>234</Text>
              <Text style={styles.statLabel}>Reactions</Text>
            </View>
          </View>
        </View>

        <View style={styles.filtersSection}>
          <Text style={styles.filterButton}>All Photos ▼</Text>
          <Text style={styles.filterButton}>January 2026 ▼</Text>
        </View>

        <View style={styles.photoGrid}>
          <Text style={styles.gridPlaceholder}>
            Photo grid (3 columns) will appear here
          </Text>
          <Text style={styles.gridPlaceholder}>
            Shows both journaled + archived photos
          </Text>
        </View>

        <Button
          title="Edit Profile"
          variant="outline"
          onPress={() => console.log('Edit profile')}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    fontSize: 16,
    color: '#000000',
  },
  settingsButton: {
    fontSize: 16,
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
  filtersSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    marginTop: 16,
  },
  filterButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  photoGrid: {
    padding: 24,
    alignItems: 'center',
  },
  gridPlaceholder: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 8,
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