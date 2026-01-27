import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../components';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
import logger from '../utils/logger';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { signOut } = useAuth();

  const handleFriendsPress = () => {
    logger.info('ProfileScreen: Friends button pressed');
    navigation.navigate('FriendsList');
  };

  const handleSignOut = async () => {
    logger.info('ProfileScreen: Sign Out button pressed');
    await signOut();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <View style={styles.content}>
        <Button
          title="Friends"
          variant="outline"
          onPress={handleFriendsPress}
          style={styles.button}
        />

        <Button
          title="Sign Out"
          variant="secondary"
          onPress={handleSignOut}
          style={styles.button}
        />
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  button: {
    width: '100%',
    marginVertical: 8,
  },
});

export default ProfileScreen;
