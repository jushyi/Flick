import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getFirestore, doc, updateDoc } from '@react-native-firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
import { styles } from '../styles/NotificationSettingsScreen.styles';
import logger from '../utils/logger';

const db = getFirestore();

/**
 * Default notification preferences
 * All enabled by default for new users
 */
const DEFAULT_PREFERENCES = {
  enabled: true,
  likes: true,
  comments: true,
  follows: true,
  friendRequests: true,
  mentions: true,
};

/**
 * Notification type configuration
 * Defines icon, label, and description for each notification type
 */
const NOTIFICATION_TYPES = [
  {
    id: 'likes',
    icon: 'heart-outline',
    label: 'Likes',
    subtitle: 'When someone reacts to your photo',
  },
  {
    id: 'comments',
    icon: 'chatbubble-outline',
    label: 'Comments',
    subtitle: 'When someone comments on your photo',
  },
  {
    id: 'follows',
    icon: 'person-add-outline',
    label: 'Follows',
    subtitle: 'When someone accepts your friend request',
  },
  {
    id: 'friendRequests',
    icon: 'people-outline',
    label: 'Friend Requests',
    subtitle: 'When someone sends you a friend request',
  },
  {
    id: 'mentions',
    icon: 'at-outline',
    label: 'Mentions',
    subtitle: 'When someone mentions you in a comment',
  },
];

/**
 * NotificationSettingsScreen
 *
 * Allows users to control their push notification preferences.
 * Features a master toggle and individual toggles for each notification type.
 * Preferences are persisted to Firestore in the user document.
 */
const NotificationSettingsScreen = () => {
  const navigation = useNavigation();
  const { user, userProfile } = useAuth();
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);

  // Load preferences from userProfile on mount
  useEffect(() => {
    if (userProfile?.notificationPreferences) {
      setPreferences({
        ...DEFAULT_PREFERENCES,
        ...userProfile.notificationPreferences,
      });
    }
  }, [userProfile?.notificationPreferences]);

  /**
   * Save preferences to Firestore
   */
  const savePreferences = async newPreferences => {
    if (!user?.uid) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        notificationPreferences: newPreferences,
      });
      logger.debug('NotificationSettingsScreen: Preferences saved', { newPreferences });
    } catch (error) {
      logger.error('NotificationSettingsScreen: Failed to save preferences', {
        error: error.message,
      });
    }
  };

  /**
   * Handle master toggle change
   */
  const handleMasterToggle = value => {
    const newPreferences = { ...preferences, enabled: value };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
    logger.debug('NotificationSettingsScreen: Master toggle changed', { enabled: value });
  };

  /**
   * Handle individual notification type toggle
   */
  const handleTypeToggle = (typeId, value) => {
    const newPreferences = { ...preferences, [typeId]: value };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
    logger.debug('NotificationSettingsScreen: Type toggle changed', { typeId, value });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            logger.debug('NotificationSettingsScreen: Back button pressed');
            navigation.goBack();
          }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color={colors.icon.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView>
        <View style={styles.menuContainer}>
          {/* Master Toggle */}
          <View style={[styles.toggleItem, styles.masterToggleItem]}>
            <View style={styles.toggleItemLeft}>
              <Ionicons name="notifications-outline" size={22} color={colors.icon.primary} />
              <View style={styles.toggleItemContent}>
                <Text style={styles.toggleItemLabel}>Push Notifications</Text>
                <Text style={styles.toggleItemSubtitle}>Turn off to stop all notifications</Text>
              </View>
            </View>
            <Switch
              value={preferences.enabled}
              onValueChange={handleMasterToggle}
              trackColor={{ false: colors.background.tertiary, true: colors.interactive.primary }}
              thumbColor={colors.text.primary}
            />
          </View>

          {/* Notification Types Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>Notification Types</Text>
          </View>

          {NOTIFICATION_TYPES.map(type => (
            <View
              key={type.id}
              style={[styles.toggleItem, !preferences.enabled && styles.toggleItemDisabled]}
            >
              <View style={styles.toggleItemLeft}>
                <Ionicons name={type.icon} size={22} color={colors.icon.primary} />
                <View style={styles.toggleItemContent}>
                  <Text style={styles.toggleItemLabel}>{type.label}</Text>
                  <Text style={styles.toggleItemSubtitle}>{type.subtitle}</Text>
                </View>
              </View>
              <Switch
                value={preferences[type.id]}
                onValueChange={value => handleTypeToggle(type.id, value)}
                disabled={!preferences.enabled}
                trackColor={{ false: colors.background.tertiary, true: colors.interactive.primary }}
                thumbColor={colors.text.primary}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default NotificationSettingsScreen;
