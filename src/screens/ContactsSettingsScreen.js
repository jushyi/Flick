import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Linking, AppState, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNavigation } from '@react-navigation/native';

import {
  getContactsPermissionStatus,
  requestContactsPermission,
  syncContactsAndFindSuggestions,
  markContactsSyncCompleted,
} from '../services/firebase/contactSyncService';

import PixelIcon from '../components/PixelIcon';
import PixelSpinner from '../components/PixelSpinner';

import { useAuth } from '../context/AuthContext';

import { colors } from '../constants/colors';
import { styles } from '../styles/ContactsSettingsScreen.styles';
import logger from '../utils/logger';

/**
 * ContactsSettingsScreen
 *
 * Allows users to manage contacts permission and re-sync contacts to find friends.
 * Handles reinstall scenarios where Firestore shows synced but device permission was reset.
 * Mirrors the NotificationSettingsScreen pattern.
 */
const ContactsSettingsScreen = () => {
  const navigation = useNavigation();
  const { user, userProfile, refreshUserProfile } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState('granted');
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null); // { count: number } after sync

  const checkOsPermission = async () => {
    const result = await getContactsPermissionStatus();
    if (result.success) {
      setPermissionStatus(result.data.status);
      setCanAskAgain(result.data.canAskAgain);
    }
  };

  // Check OS contacts permission on mount and when app returns to foreground
  useEffect(() => {
    checkOsPermission();

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        checkOsPermission();
      }
    });

    return () => subscription?.remove();
  }, []);

  const handleRequestPermission = async () => {
    const result = await requestContactsPermission();
    if (result.granted) {
      await checkOsPermission();
    }
  };

  const handleSyncContacts = async () => {
    try {
      setSyncing(true);
      setSyncResult(null);

      const result = await syncContactsAndFindSuggestions(user.uid, userProfile?.phoneNumber);

      if (!result.success) {
        if (
          result.error === 'permission_denied_permanent' ||
          result.error === 'permission_denied'
        ) {
          await checkOsPermission();
        } else {
          Alert.alert('Error', 'Failed to sync contacts. Please try again.');
        }
        return;
      }

      await markContactsSyncCompleted(user.uid, true);
      await refreshUserProfile();
      setSyncResult({ count: result.suggestions?.length ?? 0 });
      logger.info('ContactsSettingsScreen: Sync completed', {
        suggestions: result.suggestions?.length,
      });
    } catch (error) {
      logger.error('ContactsSettingsScreen: Sync failed', { error: error.message });
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const formatLastSynced = () => {
    const syncedAt = userProfile?.contactsSyncedAt;
    if (!syncedAt) return 'Never synced';
    const date = typeof syncedAt.toDate === 'function' ? syncedAt.toDate() : new Date(syncedAt);
    return `Last synced ${date.toLocaleDateString()}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            logger.debug('ContactsSettingsScreen: Back button pressed');
            navigation.goBack();
          }}
          style={styles.backButton}
        >
          <PixelIcon name="chevron-back" size={28} color={colors.icon.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contacts</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView>
        {/* Permission banner - shown when OS permission is not granted */}
        {permissionStatus !== 'granted' && (
          <View style={styles.permissionBanner}>
            <View style={styles.permissionBannerContent}>
              <PixelIcon name="people-outline" size={22} color={colors.status.danger} />
              <View style={styles.permissionBannerText}>
                {canAskAgain ? (
                  <>
                    <Text style={styles.permissionBannerTitle}>Allow Contacts Access</Text>
                    <Text style={styles.permissionBannerSubtitle}>
                      Tap below to find friends from your contacts
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.permissionBannerTitle}>Contacts access is off</Text>
                    <Text style={styles.permissionBannerSubtitle}>
                      Enable contacts access in your device settings to find friends
                    </Text>
                  </>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={styles.permissionBannerButton}
              onPress={canAskAgain ? handleRequestPermission : () => Linking.openSettings()}
              activeOpacity={0.7}
            >
              <Text style={styles.permissionBannerButtonText}>
                {canAskAgain ? 'Allow Access' : 'Open Settings'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sync section - shown when permission is granted */}
        {permissionStatus === 'granted' && (
          <View style={styles.menuContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>Contacts</Text>
            </View>

            <View style={styles.infoRow}>
              <PixelIcon name="people-outline" size={22} color={colors.icon.primary} />
              <View style={styles.infoRowContent}>
                <Text style={styles.infoRowLabel}>Find Friends</Text>
                <Text style={styles.infoRowSubtitle}>{formatLastSynced()}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Success banner after sync */}
        {syncResult !== null && (
          <View style={styles.successBanner}>
            <PixelIcon name="checkmark-circle-outline" size={22} color={colors.status.ready} />
            <Text style={styles.successBannerText}>
              {syncResult.count > 0
                ? `Found ${syncResult.count} ${syncResult.count === 1 ? 'friend' : 'friends'} from your contacts`
                : 'No new friends found — invite them to join Flick!'}
            </Text>
          </View>
        )}

        {/* Sync button */}
        {permissionStatus === 'granted' && (
          <TouchableOpacity
            style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
            onPress={handleSyncContacts}
            disabled={syncing}
            activeOpacity={0.7}
          >
            {syncing ? (
              <PixelSpinner size="small" color={colors.text.primary} />
            ) : (
              <Text style={styles.syncButtonText}>Sync Contacts</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default ContactsSettingsScreen;
