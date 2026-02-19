import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Application from 'expo-application';
import { useNavigation } from '@react-navigation/native';
import PixelIcon from '../components/PixelIcon';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';
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
    const signOutAction = {
      text: 'Sign Out',
      style: 'destructive',
      onPress: async () => {
        try {
          await signOut();
        } catch (error) {
          logger.error('SettingsScreen: Sign out failed', { error: error.message });
        }
      },
    };
    const cancelAction = { text: 'Cancel', style: 'cancel' };
    // Android reverses button visual order — swap so Cancel stays left, Sign Out right
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      Platform.OS === 'android' ? [signOutAction, cancelAction] : [cancelAction, signOutAction]
    );
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
    navigation.navigate('HelpSupport');
  };

  const sections = [
    {
      title: 'Account',
      items: [
        {
          id: 'editProfile',
          label: 'Edit Profile',
          icon: 'person-outline',
          onPress: () => handleNavigate('EditProfile'),
        },
        {
          id: 'contributions',
          label: 'Support Flick',
          icon: 'heart-outline',
          onPress: () => handleNavigate('Contributions'),
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        {
          id: 'notifications',
          label: 'Notifications',
          icon: 'notifications-outline',
          onPress: () => handleNavigate('NotificationSettings'),
        },
        {
          id: 'sounds',
          label: 'Sounds',
          icon: 'musical-notes-outline',
          onPress: () => handleNavigate('SoundSettings'),
        },
      ],
    },
    {
      title: 'Privacy',
      items: [
        {
          id: 'contacts',
          label: 'Sync Contacts',
          icon: 'people-outline',
          onPress: () => handleNavigate('ContactsSettings'),
        },
        {
          id: 'blockedUsers',
          label: 'Blocked Users',
          icon: 'ban-outline',
          onPress: () => handleNavigate('BlockedUsers'),
        },
        {
          id: 'recentlyDeleted',
          label: 'Recently Deleted',
          icon: 'trash-outline',
          onPress: () => handleNavigate('RecentlyDeleted'),
        },
      ],
    },
    {
      title: 'Legal',
      items: [
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
      ],
    },
    {
      title: 'Support',
      items: [
        {
          id: 'helpSupport',
          label: 'Help & Support',
          icon: 'help-circle-outline',
          onPress: handleHelpSupport,
        },
      ],
    },
  ];

  const actionItems = [
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
          <PixelIcon name="chevron-back" size={28} color={colors.icon.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        bounces={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Sectioned Menu Items */}
        <View style={styles.menuContainer}>
          {sections.map(section => (
            <View key={section.title}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{section.title}</Text>
              </View>
              {section.items.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.menuItem}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuItemLeft}>
                    <PixelIcon
                      name={item.icon}
                      size={22}
                      color={item.danger ? colors.status.danger : colors.icon.primary}
                    />
                    <Text style={[styles.menuItemLabel, item.danger && styles.menuItemLabelDanger]}>
                      {item.label}
                    </Text>
                  </View>
                  <PixelIcon name="chevron-forward" size={20} color={colors.icon.tertiary} />
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {/* Action Items (Sign Out, Delete Account) - no header */}
          {actionItems.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <PixelIcon
                  name={item.icon}
                  size={22}
                  color={item.danger ? colors.status.danger : colors.icon.primary}
                />
                <Text style={[styles.menuItemLabel, item.danger && styles.menuItemLabelDanger]}>
                  {item.label}
                </Text>
              </View>
              <PixelIcon name="chevron-forward" size={20} color={colors.icon.tertiary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>
            Version {Application.nativeApplicationVersion || '0.1.0'}
          </Text>
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
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingBottom: Platform.OS === 'android' ? 6 : spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  backButton: {
    padding: spacing.xxs,
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    ...Platform.select({
      android: {
        includeFontPadding: false,
        lineHeight: 26,
      },
    }),
  },
  headerSpacer: {
    width: 36, // Balance the back button width
  },
  menuContainer: {
    marginTop: spacing.lg,
  },
  sectionHeader: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  sectionHeaderText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
    marginLeft: spacing.md,
  },
  menuItemLabelDanger: {
    color: colors.status.danger,
  },
  versionContainer: {
    paddingHorizontal: 20,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  versionText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
  },
});

export default SettingsScreen;
