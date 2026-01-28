import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
import logger from '../utils/logger';

const HEADER_HEIGHT = 56;

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

      {/* Content placeholder - to be replaced in Task 2 */}
      <View style={styles.content}>
        <Text style={styles.placeholderText}>Profile content coming soon</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: HEADER_HEIGHT,
  },
  placeholderText: {
    color: colors.text.secondary,
    fontSize: 16,
  },
});

export default ProfileScreen;
