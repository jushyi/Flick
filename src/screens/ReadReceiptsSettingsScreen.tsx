import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
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
 * ReadReceiptsSettingsScreen
 *
 * Dedicated privacy settings page for controlling read receipts.
 * Follows the same layout pattern as SoundSettingsScreen:
 * header with back button, master toggle, and info section.
 *
 * Read receipts default to enabled (true). Toggling OFF shows a
 * confirmation alert. Toggling ON writes directly to Firestore.
 * Both users in a conversation must have read receipts enabled
 * for "Read" indicators to appear.
 */
const ReadReceiptsSettingsScreen = () => {
  const navigation = useNavigation();
  const { user, userProfile, updateUserProfile } = useAuth();

  const readReceiptsEnabled = userProfile?.readReceiptsEnabled !== false;

  /**
   * Handle the Read Receipts privacy toggle.
   * Toggling OFF shows a confirmation Alert. Toggling ON writes directly.
   */
  const handleReadReceiptsToggle = newValue => {
    if (newValue === false) {
      // Toggling OFF — show confirmation
      Alert.alert(
        'Turn Off Read Receipts',
        "When you turn off read receipts, you also won't see when others read your messages.",
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Turn Off',
            style: 'destructive',
            onPress: async () => {
              try {
                await updateDoc(doc(db, 'users', user.uid), { readReceiptsEnabled: false });
                updateUserProfile({ ...userProfile, readReceiptsEnabled: false });
                logger.info('ReadReceiptsSettingsScreen: Read receipts disabled');
              } catch (error) {
                logger.error('ReadReceiptsSettingsScreen: Failed to update read receipts', {
                  error: error.message,
                });
              }
            },
          },
        ]
      );
    } else {
      // Toggling ON — write directly, no confirmation
      updateDoc(doc(db, 'users', user.uid), { readReceiptsEnabled: true }).catch(error => {
        logger.error('ReadReceiptsSettingsScreen: Failed to update read receipts', {
          error: error.message,
        });
      });
      updateUserProfile({ ...userProfile, readReceiptsEnabled: true });
      logger.info('ReadReceiptsSettingsScreen: Read receipts enabled');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            logger.debug('ReadReceiptsSettingsScreen: Back button pressed');
            navigation.goBack();
          }}
          style={styles.backButton}
        >
          <PixelIcon name="chevron-back" size={28} color={colors.icon.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Read Receipts</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.menuContainer}>
          {/* Read Receipts Toggle */}
          <View style={[styles.toggleItem, styles.masterToggleItem]}>
            <View style={styles.toggleItemLeft}>
              <PixelIcon name="eye-outline" size={22} color={colors.icon.primary} />
              <View style={styles.toggleItemContent}>
                <Text style={styles.toggleItemLabel}>Read Receipts</Text>
                <Text style={styles.toggleItemSubtitle}>
                  Send and receive read receipts in conversations
                </Text>
              </View>
            </View>
            <PixelToggle value={readReceiptsEnabled} onValueChange={handleReadReceiptsToggle} />
          </View>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <Text style={styles.infoText}>
              When read receipts are off, you won&apos;t send or receive read receipts. Both you and
              the other person must have read receipts enabled for them to appear.
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

export default ReadReceiptsSettingsScreen;
