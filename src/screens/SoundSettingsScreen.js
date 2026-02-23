import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { getFirestore, doc, updateDoc } from '@react-native-firebase/firestore';

import PixelIcon from '../components/PixelIcon';
import PixelToggle from '../components/PixelToggle';

import { useAuth } from '../context/AuthContext';

import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import logger from '../utils/logger';

const db = getFirestore();

/**
 * Default sound preferences
 * Effects disabled by default (opt-in model)
 */
const DEFAULT_PREFERENCES = {
  effectsEnabled: false,
};

/**
 * SoundSettingsScreen
 *
 * Allows users to control sound effect preferences.
 * Features a master toggle for sound effects (triage completion, etc.).
 * Preferences are persisted to Firestore in the user document.
 *
 * Note: This is separate from music playback (profile songs), which
 * always plays even in silent mode. Sound effects respect the device's
 * silent/mute switch automatically via expo-audio default behavior.
 */
const SoundSettingsScreen = () => {
  const navigation = useNavigation();
  const { user, userProfile, updateUserProfile } = useAuth();
  const [preferences, setPreferences] = useState(
    userProfile?.soundPreferences || DEFAULT_PREFERENCES
  );

  // Load preferences from userProfile only on initial mount
  useEffect(() => {
    if (userProfile?.soundPreferences) {
      setPreferences({
        ...DEFAULT_PREFERENCES,
        ...userProfile.soundPreferences,
      });
      logger.debug('SoundSettingsScreen: Loaded initial preferences', {
        preferences: userProfile.soundPreferences,
      });
    }
  }, []); // Empty array - only run once on mount

  const savePreferences = async newPreferences => {
    if (!user?.uid) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        soundPreferences: newPreferences,
      });
      logger.info('SoundSettingsScreen: Preferences saved to Firestore', { newPreferences });

      // Optimistically update AuthContext's local state if update function exists
      // This ensures the value persists when navigating back to this screen
      if (updateUserProfile && userProfile) {
        updateUserProfile({
          ...userProfile,
          soundPreferences: newPreferences,
        });
        logger.debug('SoundSettingsScreen: Updated local AuthContext state');
      }
    } catch (error) {
      logger.error('SoundSettingsScreen: Failed to save preferences', {
        error: error.message,
      });
    }
  };

  const handleEffectsToggle = value => {
    const newPreferences = { ...preferences, effectsEnabled: value };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
    logger.debug('SoundSettingsScreen: Effects toggle changed', { effectsEnabled: value });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            logger.debug('SoundSettingsScreen: Back button pressed');
            navigation.goBack();
          }}
          style={styles.backButton}
        >
          <PixelIcon name="chevron-back" size={28} color={colors.icon.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sounds</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.menuContainer}>
          {/* Sound Effects Toggle */}
          <View style={[styles.toggleItem, styles.masterToggleItem]}>
            <View style={styles.toggleItemLeft}>
              <PixelIcon name="musical-notes-outline" size={22} color={colors.icon.primary} />
              <View style={styles.toggleItemContent}>
                <Text style={styles.toggleItemLabel}>Sound Effects</Text>
                <Text style={styles.toggleItemSubtitle}>
                  Play sounds for actions like completing triage
                </Text>
              </View>
            </View>
            <PixelToggle value={preferences.effectsEnabled} onValueChange={handleEffectsToggle} />
          </View>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <Text style={styles.infoText}>
              Sound effects automatically respect your device&apos;s silent mode. Music playback
              (like profile songs) is not affected by this setting.
            </Text>
          </View>
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
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  masterToggleItem: {
    backgroundColor: colors.background.primary,
  },
  toggleItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
  },
  toggleItemContent: {
    marginLeft: spacing.md,
    flex: 1,
  },
  toggleItemLabel: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
    marginBottom: 4,
  },
  toggleItemSubtitle: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background.primary,
  },
  infoText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.tertiary,
    lineHeight: 20,
  },
});

export default SoundSettingsScreen;
