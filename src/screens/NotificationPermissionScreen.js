import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PixelIcon from '../components/PixelIcon';
import PixelSpinner from '../components/PixelSpinner';
import { useAuth } from '../context/AuthContext';
import {
  requestNotificationPermission,
  getNotificationToken,
  storeNotificationToken,
  markNotificationPermissionCompleted,
  checkNotificationPermissions,
} from '../services/firebase/notificationService';
import { mediumImpact } from '../utils/haptics';
import { colors } from '../constants/colors';
import { styles } from '../styles/NotificationPermissionScreen.styles';
import logger from '../utils/logger';

/**
 * NotificationPermissionScreen - Final onboarding step for notification permissions
 *
 * Flow:
 * 1. Show value messaging explaining why notifications matter
 * 2. "Enable Notifications" triggers OS permission dialog
 * 3. "Maybe Later" skips without prompting
 * 4. Auto-advances if notifications are already granted (existing users)
 */
const NotificationPermissionScreen = ({ navigation }) => {
  const { user, refreshUserProfile } = useAuth();
  const [enabling, setEnabling] = useState(false);
  const hasAutoAdvanced = useRef(false);

  // Auto-advance if notifications are already granted (handles existing users)
  useEffect(() => {
    const checkExisting = async () => {
      if (hasAutoAdvanced.current) return;
      const result = await checkNotificationPermissions();
      if (result.success && result.data.granted) {
        hasAutoAdvanced.current = true;

        // Ensure token is stored even when auto-advancing
        const tokenResult = await getNotificationToken();
        if (tokenResult.success && tokenResult.data) {
          await storeNotificationToken(user.uid, tokenResult.data);
        }

        await markNotificationPermissionCompleted(user.uid, true);
        await refreshUserProfile();
      }
    };
    checkExisting();
  }, [user?.uid]);

  const handleEnable = async () => {
    mediumImpact();
    setEnabling(true);

    try {
      const permissionResult = await requestNotificationPermission();

      if (permissionResult.success) {
        const tokenResult = await getNotificationToken();
        if (tokenResult.success && tokenResult.data) {
          await storeNotificationToken(user.uid, tokenResult.data);
          logger.info('NotificationPermissionScreen: Permission granted and token stored');
        } else {
          logger.warn('NotificationPermissionScreen: Could not get token', {
            error: tokenResult.error,
          });
        }
      } else {
        logger.info('NotificationPermissionScreen: Permission denied', {
          error: permissionResult.error,
        });
      }

      // Mark step complete regardless of permission result
      await markNotificationPermissionCompleted(user.uid, true);
      await refreshUserProfile();
    } catch (error) {
      logger.error('NotificationPermissionScreen: Error enabling notifications', error);
      // Still mark complete so user isn't stuck
      await markNotificationPermissionCompleted(user.uid, true);
      await refreshUserProfile();
    } finally {
      setEnabling(false);
    }
  };

  const handleSkip = async () => {
    mediumImpact();
    await markNotificationPermissionCompleted(user.uid, true);
    await refreshUserProfile();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <PixelIcon name="chevron-back" size={28} color={colors.icon.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.permissionSection}>
          <PixelIcon
            name="notifications-outline"
            size={64}
            color={colors.brand.purple}
            style={styles.permissionIcon}
          />
          <Text style={styles.permissionTitle}>Stay in the Loop</Text>
          <Text style={styles.permissionText}>
            Get notified when your photos are ready to view, when friends react to your moments, and
            when you receive friend requests.
          </Text>
          <TouchableOpacity
            style={styles.enableButton}
            onPress={handleEnable}
            activeOpacity={0.7}
            disabled={enabling}
            testID="notifications-enable-button"
          >
            {enabling ? (
              <PixelSpinner size="small" color={colors.text.primary} />
            ) : (
              <Text style={styles.enableButtonText}>Enable Notifications</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            activeOpacity={0.7}
            disabled={enabling}
            testID="notifications-skip-button"
          >
            <Text style={styles.skipButtonText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default NotificationPermissionScreen;
