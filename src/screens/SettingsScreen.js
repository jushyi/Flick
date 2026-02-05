import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
import logger from '../utils/logger';

/**
 * SettingsScreen
 *
 * Main settings menu accessible from ProfileScreen via gear icon.
 * Contains links to Privacy Policy, Terms of Service, and Delete Account.
 * Uses dark theme styling consistent with app design.
 */
const SettingsScreen = () => {
  const navigation = useNavigation();
  const { signOut } = useAuth();

  const handleSignOut = () => {
    logger.info('SettingsScreen: Sign out pressed');
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error) {
            logger.error('SettingsScreen: Sign out failed', { error: error.message });
          }
        },
      },
    ]);
  };

  const handleNavigate = screenName => {
    logger.debug('SettingsScreen: Navigating to screen', { screenName });
    navigation.navigate(screenName);
  };

  const handleDeleteAccount = () => {
    logger.debug('SettingsScreen: Delete Account pressed');
    navigation.navigate('DeleteAccount');
  };

  const handleHelpSupport = () => {
    logger.debug('SettingsScreen: Help & Support pressed');
    Linking.openURL('mailto:support@rewind.app?subject=Rewind%20Support%20Request');
  };

  const menuItems = [
    {
      id: 'editProfile',
      label: 'Edit Profile',
      icon: 'person-outline',
      onPress: () => handleNavigate('EditProfile'),
    },
    {
      id: 'privacy',
      label: 'Privacy Policy',
      icon: 'document-text-outline',
      onPress: () => handleNavigate('PrivacyPolicy'),
    },
    {
      id: 'terms',
      label: 'Terms of Service',
      icon: 'document-outline',
      onPress: () => handleNavigate('TermsOfService'),
    },
    {
      id: 'recentlyDeleted',
      label: 'Recently Deleted',
      icon: 'trash-outline',
      onPress: () => handleNavigate('RecentlyDeleted'),
    },
    {
      id: 'blockedUsers',
      label: 'Blocked Users',
      icon: 'ban-outline',
      onPress: () => handleNavigate('BlockedUsers'),
    },
    {
      id: 'helpSupport',
      label: 'Help & Support',
      icon: 'help-circle-outline',
      onPress: handleHelpSupport,
    },
    {
      id: 'signout',
      label: 'Sign Out',
      icon: 'log-out-outline',
      onPress: handleSignOut,
    },
    {
      id: 'delete',
      label: 'Delete Account',
      icon: 'trash-outline',
      onPress: handleDeleteAccount,
      danger: true,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            logger.debug('SettingsScreen: Back button pressed');
            navigation.goBack();
          }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color={colors.icon.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Menu Items */}
      <View style={styles.menuContainer}>
        {menuItems.map(item => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuItem}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons
                name={item.icon}
                size={22}
                color={item.danger ? colors.status.danger : colors.icon.primary}
              />
              <Text style={[styles.menuItemLabel, item.danger && styles.menuItemLabelDanger]}>
                {item.label}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.icon.tertiary} />
          </TouchableOpacity>
        ))}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 36, // Balance the back button width
  },
  menuContainer: {
    marginTop: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemLabel: {
    fontSize: 16,
    color: colors.text.primary,
    marginLeft: 16,
  },
  menuItemLabelDanger: {
    color: colors.status.danger,
  },
});

export default SettingsScreen;
