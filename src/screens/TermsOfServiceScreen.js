import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import PixelIcon from '../components/PixelIcon';
import { TERMS_OF_SERVICE_CONTENT } from '../constants/legalContent';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import logger from '../utils/logger';

/**
 * TermsOfServiceScreen
 *
 * Displays the app's terms of service in a scrollable view.
 * Required for App Store compliance (Apple Guideline 5.1.1).
 * Uses dark theme styling consistent with SettingsScreen.
 */
const TermsOfServiceScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            logger.debug('TermsOfServiceScreen: Back button pressed');
            navigation.goBack();
          }}
          style={styles.backButton}
        >
          <PixelIcon name="chevron-back" size={28} color={colors.icon.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.bodyText}>{TERMS_OF_SERVICE_CONTENT}</Text>
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
  },
  headerSpacer: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // Clear absolute-positioned tab bar (85px iOS / 65px Android)
  },
  bodyText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    lineHeight: 22,
    color: colors.text.primary,
  },
});

export default TermsOfServiceScreen;
