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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input } from '../components';
import { sendVerificationCode } from '../services/firebase/phoneAuthService';
import { formatAsUserTypes } from '../utils/phoneUtils';
import { usePhoneAuth } from '../context/PhoneAuthContext';
import { colors } from '../constants/colors';
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
 * Uses React Native Firebase native phone auth
 */
const PhoneInputScreen = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState(''); // Raw digits only
  const [formattedPhone, setFormattedPhone] = useState(''); // Formatted for display
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]); // Default to US
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // Get confirmationRef from context to store Firebase ConfirmationResult
  // Using ref instead of navigation params prevents serialization crash on iOS
  const { confirmationRef } = usePhoneAuth();

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
          formattedNumber: result.formattedNumber,
        });

        // Store confirmation in ref (not serialized) to avoid iOS crash
        // Firebase ConfirmationResult contains functions that cannot be serialized
        confirmationRef.current = result.confirmation;
        logger.debug('PhoneInputScreen: Stored confirmation in context ref', {
          hasConfirmation: !!confirmationRef.current,
        });

        // Navigate to verification screen WITHOUT confirmation object
        navigation.navigate('Verification', {
          phoneNumber: result.formattedNumber,
          e164: result.e164,
        });
      } else {
        logger.warn('PhoneInputScreen: Send code failed', { error: result.error });
        setError(result.error);
        triggerShake();
      }
    } catch (err) {
      logger.error('PhoneInputScreen: Unexpected error', { error: err.message });
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
    // Remove any non-numeric characters except for formatting
    const cleaned = text.replace(/[^0-9]/g, '');
    setPhoneNumber(cleaned);

    // Update formatted display as user types
    const formatted = formatAsUserTypes(cleaned, selectedCountry.country);
    setFormattedPhone(formatted);

    if (error) setError(''); // Clear error on change
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
            <Text style={styles.logo}>LAPSE</Text>
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
                    placeholder="(555) 555-5555"
                    value={formattedPhone || phoneNumber}
                    onChangeText={handlePhoneChange}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={error}
                    style={styles.phoneInput}
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
              />

              {/* Back to Login Link */}
              <Text style={styles.loginText}>
                Already have an account?{' '}
                <Text style={styles.loginLink} onPress={handleBack}>
                  Login
                </Text>
              </Text>
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
          <View style={styles.modalContent}>
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
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    color: colors.text.primary,
  },
  description: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.background.secondary,
    marginBottom: 16,
  },
  countrySelectorFlag: {
    fontSize: 20,
    marginRight: 12,
  },
  countrySelectorText: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
  },
  countrySelectorArrow: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  countryCodeDisplay: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: 8,
    marginRight: 8,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  phoneInputWrapper: {
    flex: 1,
  },
  phoneInput: {
    marginBottom: 0,
  },
  loginText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 24,
  },
  loginLink: {
    color: colors.text.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalClose: {
    fontSize: 20,
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
    fontSize: 24,
    marginRight: 12,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
  },
  countryCode: {
    fontSize: 16,
    color: colors.text.secondary,
  },
});

export default PhoneInputScreen;
