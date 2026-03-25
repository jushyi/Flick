import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Modal,
  FlatList,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input } from '../components';
import { sendVerificationCode } from '../services/supabase/phoneAuthService';
import { formatAsUserTypes } from '../utils/phoneUtils';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';
import logger from '../utils/logger';

/**
 * Common country codes for phone authentication
 */
const COUNTRY_CODES = [
  { code: '+1', country: 'US', name: 'United States', flag: '🇺🇸' },
  { code: '+1', country: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: '+44', country: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+61', country: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: '+49', country: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'FR', name: 'France', flag: '🇫🇷' },
  { code: '+81', country: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: '+91', country: 'IN', name: 'India', flag: '🇮🇳' },
  { code: '+55', country: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: '+52', country: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: '+86', country: 'CN', name: 'China', flag: '🇨🇳' },
  { code: '+82', country: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: '+39', country: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: '+34', country: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: '+31', country: 'NL', name: 'Netherlands', flag: '🇳🇱' },
];

/**
 * Phone Input Screen
 * First step of phone authentication - enter phone number and receive SMS code
 * Uses Supabase OTP for stateless phone verification
 */
const PhoneInputScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [phoneNumber, setPhoneNumber] = useState(''); // Raw digits only
  const [formattedPhone, setFormattedPhone] = useState(''); // Formatted for display
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]); // Default to US
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // Shake animation for error feedback
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleSendCode = async () => {
    logger.info('PhoneInputScreen: Send code pressed', {
      phoneNumberLength: phoneNumber.length,
      country: selectedCountry.country,
    });

    // Clear previous error
    setError('');

    // Basic validation
    if (!phoneNumber.trim()) {
      setError('Please enter your phone number.');
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      const result = await sendVerificationCode(phoneNumber, selectedCountry.country);

      if (result.success) {
        logger.info('PhoneInputScreen: Code sent, navigating to verification', {
          e164: result.e164,
        });

        // Navigate to verification screen with E.164 phone for Supabase OTP verification
        navigation.navigate('Verification', {
          phoneNumber: `${selectedCountry.code} ${formattedPhone}`,
          e164: result.e164,
        });
      } else {
        logger.warn('PhoneInputScreen: Send code failed', { error: result.error });
        setError(result.error || '');
        triggerShake();
      }
    } catch (err) {
      logger.error('PhoneInputScreen: Unexpected error', { error: (err as Error).message });
      setError('An unexpected error occurred. Please try again.');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleCountrySelect = country => {
    logger.debug('PhoneInputScreen: Country selected', { country: country.country });
    setSelectedCountry(country);
    setShowCountryPicker(false);
    setError(''); // Clear error when country changes

    // Re-format phone number for new country
    if (phoneNumber) {
      const formatted = formatAsUserTypes(phoneNumber, country.country);
      setFormattedPhone(formatted);
    }
  };

  const handlePhoneChange = text => {
    // Extract digits only
    const digits = text.replace(/[^0-9]/g, '');

    // Detect deletion by comparing input text length to what we're currently displaying
    // This catches both digit deletion AND formatting character deletion (space, parens)
    const isDeleting = text.length < formattedPhone.length;

    setPhoneNumber(digits);

    // When deleting, show raw digits to avoid re-adding formatting chars that trap cursor
    // When typing, format normally for nice display
    if (isDeleting) {
      setFormattedPhone(digits);
    } else {
      const formatted = formatAsUserTypes(digits, selectedCountry.country as any);
      setFormattedPhone(formatted);
    }

    if (error) setError('');
  };

  const handleBack = () => {
    logger.debug('PhoneInputScreen: Back pressed');
    navigation.goBack();
  };

  const renderCountryItem = ({ item }) => (
    <TouchableOpacity style={styles.countryItem} onPress={() => handleCountrySelect(item)}>
      <Text style={styles.countryFlag}>{item.flag}</Text>
      <Text style={styles.countryName}>{item.name}</Text>
      <Text style={styles.countryCode}>{item.code}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Text style={styles.logo}>FLICK</Text>
            <Text style={styles.subtitle}>Enter your phone number</Text>
            <Text style={styles.description}>
              We&apos;ll send you a verification code to confirm your number.
            </Text>

            <View style={styles.form}>
              {/* Country Selector */}
              <Text style={styles.label}>Country</Text>
              <TouchableOpacity
                style={styles.countrySelector}
                onPress={() => setShowCountryPicker(true)}
              >
                <Text style={styles.countrySelectorFlag}>{selectedCountry.flag}</Text>
                <Text style={styles.countrySelectorText}>
                  {selectedCountry.name} ({selectedCountry.code})
                </Text>
                <Text style={styles.countrySelectorArrow}>▼</Text>
              </TouchableOpacity>

              {/* Phone Number Input */}
              <Animated.View
                style={[styles.phoneInputContainer, { transform: [{ translateX: shakeAnim }] }]}
              >
                <View style={styles.countryCodeDisplay}>
                  <Text style={styles.countryCodeText}>{selectedCountry.code}</Text>
                </View>
                <View style={styles.phoneInputWrapper}>
                  <Input
                    label=""
                    placeholder="(555) 555-5555"
                    value={formattedPhone}
                    onChangeText={handlePhoneChange}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={error}
                    maxLength={20}
                    style={styles.phoneInput}
                    testID="phone-input"
                  />
                </View>
              </Animated.View>

              {/* Send Code Button */}
              <Button
                title={loading ? 'Sending...' : 'Send Code'}
                variant="primary"
                onPress={handleSendCode}
                loading={loading}
                disabled={loading || !phoneNumber.trim()}
                testID="phone-continue-button"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              Platform.OS === 'android' && { paddingBottom: insets.bottom },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity
                onPress={() => setShowCountryPicker(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRY_CODES}
              renderItem={renderCountryItem}
              keyExtractor={item => `${item.country}-${item.code}`}
              style={styles.countryList}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
              getItemLayout={(data, index) => ({
                length: 49,
                offset: 49 * index,
                index,
              })}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  logo: {
    fontSize: typography.size.display,
    fontFamily: typography.fontFamily.bodyBold,
    textAlign: 'center',
    marginBottom: spacing.xs,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.bodyBold,
    textAlign: 'center',
    marginBottom: spacing.xs,
    color: colors.text.primary,
  },
  description: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    width: '100%',
    ...Platform.select({ android: { lineHeight: 22 } }),
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    height: layout.dimensions.inputHeight,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: layout.borderRadius.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.secondary,
    marginBottom: spacing.md,
  },
  countrySelectorFlag: {
    fontSize: typography.size.xl,
    marginRight: spacing.sm,
  },
  countrySelectorText: {
    flex: 1,
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
  },
  countrySelectorArrow: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  countryCodeDisplay: {
    height: layout.dimensions.inputHeight,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: layout.borderRadius.sm,
    marginRight: spacing.xs,
  },
  countryCodeText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  phoneInputWrapper: {
    flex: 1,
  },
  phoneInput: {
    marginBottom: 0,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: layout.borderRadius.xl,
    borderTopRightRadius: layout.borderRadius.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  modalTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  modalClose: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
  },
  countryList: {
    paddingHorizontal: 20,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  countryFlag: {
    fontSize: typography.size.xxl,
    marginRight: spacing.sm,
  },
  countryName: {
    flex: 1,
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
  },
  countryCode: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
  },
});

export default PhoneInputScreen;
