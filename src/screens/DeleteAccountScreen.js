import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getAuth } from '@react-native-firebase/auth';
import { sendVerificationCode, verifyCode } from '../services/firebase/phoneAuthService';
import { deleteUserAccount } from '../services/firebase/accountService';
import { formatPhoneWithCountry } from '../utils/phoneUtils';
import { usePhoneAuth } from '../context/PhoneAuthContext';
import { Button } from '../components';
import logger from '../utils/logger';

/**
 * DeleteAccountScreen
 *
 * Multi-step account deletion flow:
 * 1. Warning - Explain what will be deleted
 * 2. Verify - Re-authenticate via phone
 * 3. Code - Enter verification code
 * 4. Deleting - Show progress and call deletion
 *
 * Requires phone re-authentication before deletion for security.
 */
const DeleteAccountScreen = () => {
  const navigation = useNavigation();
  const { confirmationRef } = usePhoneAuth();

  // Step state: 'warning' | 'verify' | 'code' | 'deleting'
  const [step, setStep] = useState('warning');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [retryDelay, setRetryDelay] = useState(0);

  const inputRef = useRef(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Get current user's phone number
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const phoneNumber = currentUser?.phoneNumber;

  // Log screen mount
  useEffect(() => {
    logger.info('DeleteAccountScreen: Mounted', {
      step,
      hasPhoneNumber: !!phoneNumber,
    });
  }, []);

  // Retry delay countdown
  useEffect(() => {
    if (retryDelay <= 0) return;

    const interval = setInterval(() => {
      setRetryDelay(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [retryDelay]);

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (code.length === 6 && step === 'code' && retryDelay === 0) {
      logger.debug('DeleteAccountScreen: Auto-submitting code');
      handleVerifyCode();
    }
  }, [code, step, retryDelay]);

  // Focus input when entering code step
  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [step]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleBack = () => {
    logger.debug('DeleteAccountScreen: Back pressed', { step });
    if (step === 'code') {
      setStep('verify');
      setCode('');
      setError('');
    } else if (step === 'verify') {
      setStep('warning');
      setError('');
    } else {
      navigation.goBack();
    }
  };

  const handleCancel = () => {
    logger.debug('DeleteAccountScreen: Cancel pressed');
    navigation.goBack();
  };

  const handleUnderstand = () => {
    logger.info('DeleteAccountScreen: User confirmed understanding');
    setStep('verify');
  };

  const handleSendCode = async () => {
    if (loading) return;

    logger.info('DeleteAccountScreen: Sending verification code', {
      phoneNumber: phoneNumber ? `${phoneNumber.slice(0, 6)}***` : null,
    });

    setLoading(true);
    setError('');

    try {
      // Extract country code and number from E.164 format
      // Phone number is stored as E.164 (e.g., +14155551234)
      // We pass the full E.164 to sendVerificationCode with a fallback country
      const result = await sendVerificationCode(phoneNumber, 'US');

      if (result.success) {
        logger.info('DeleteAccountScreen: Code sent successfully');
        confirmationRef.current = result.confirmation;
        setStep('code');
      } else {
        logger.warn('DeleteAccountScreen: Failed to send code', { error: result.error });
        setError(result.error || 'Failed to send verification code');
      }
    } catch (err) {
      logger.error('DeleteAccountScreen: Error sending code', { error: err.message });
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = text => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 6);
    setCode(cleaned);
    if (error) setError('');
  };

  const handleVerifyCode = async () => {
    if (loading || retryDelay > 0) return;

    logger.info('DeleteAccountScreen: Verifying code');

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Please enter the 6-digit code.');
      triggerShake();
      return;
    }

    setLoading(true);
    setError('');

    try {
      const confirmation = confirmationRef.current;
      const result = await verifyCode(confirmation, code);

      if (result.success) {
        logger.info('DeleteAccountScreen: Verification successful, proceeding to deletion');
        setStep('deleting');
        await handleDeleteAccount();
      } else {
        logger.warn('DeleteAccountScreen: Verification failed', { error: result.error });
        setError(result.error);
        setCode('');
        triggerShake();
        setRetryDelay(3);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } catch (err) {
      logger.error('DeleteAccountScreen: Error verifying code', { error: err.message });
      setError('An unexpected error occurred. Please try again.');
      setCode('');
      triggerShake();
      setRetryDelay(3);
      setTimeout(() => inputRef.current?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    logger.info('DeleteAccountScreen: Starting account deletion');

    try {
      const result = await deleteUserAccount();

      if (result.success) {
        logger.info('DeleteAccountScreen: Account deleted successfully');
        // User is automatically signed out when auth user is deleted
        // AuthContext listener will handle navigation to login
      } else {
        logger.error('DeleteAccountScreen: Deletion failed', { error: result.error });
        Alert.alert('Deletion Failed', result.error || 'Failed to delete account.', [
          { text: 'OK', onPress: () => setStep('warning') },
        ]);
      }
    } catch (err) {
      logger.error('DeleteAccountScreen: Unexpected error during deletion', {
        error: err.message,
      });
      Alert.alert('Error', 'An unexpected error occurred. Please try again.', [
        { text: 'OK', onPress: () => setStep('warning') },
      ]);
    }
  };

  // Render warning step
  const renderWarningStep = () => (
    <View style={styles.content}>
      <View style={styles.warningIconContainer}>
        <Ionicons name="warning-outline" size={64} color="#FF3B30" />
      </View>

      <Text style={styles.title}>Delete Account</Text>

      <View style={styles.warningBox}>
        <Text style={styles.warningText}>This will permanently delete:</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>All your photos</Text>
          <Text style={styles.bulletItem}>Your friend connections</Text>
          <Text style={styles.bulletItem}>Your profile and account data</Text>
        </View>
        <Text style={styles.warningTextBold}>This action cannot be undone.</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.dangerButton} onPress={handleUnderstand}>
          <Text style={styles.dangerButtonText}>I understand, delete my account</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render verify step
  const renderVerifyStep = () => (
    <View style={styles.content}>
      <Text style={styles.title}>Verify Your Identity</Text>
      <Text style={styles.subtitle}>For security, please verify your phone number</Text>

      {phoneNumber && <Text style={styles.phoneNumber}>{formatPhoneWithCountry(phoneNumber)}</Text>}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.buttonContainer}>
        <Button
          title="Send Verification Code"
          variant="primary"
          onPress={handleSendCode}
          loading={loading}
          style={styles.primaryButton}
        />

        <TouchableOpacity style={styles.cancelButton} onPress={handleBack}>
          <Text style={styles.cancelButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render code step
  const renderCodeStep = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardAvoid}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Enter Verification Code</Text>
        <Text style={styles.subtitle}>Enter the 6-digit code sent to</Text>
        <Text style={styles.phoneNumber}>
          {phoneNumber ? formatPhoneWithCountry(phoneNumber) : 'your phone'}
        </Text>

        <Animated.View
          style={[styles.codeInputContainer, { transform: [{ translateX: shakeAnim }] }]}
        >
          <TextInput
            ref={inputRef}
            style={[styles.codeInput, error && styles.codeInputError]}
            value={code}
            onChangeText={handleCodeChange}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            placeholder="000000"
            placeholderTextColor="#666666"
            editable={!loading && retryDelay === 0}
          />
        </Animated.View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            {retryDelay > 0 && <Text style={styles.retryDelayText}>Retry in {retryDelay}s</Text>}
          </View>
        ) : null}

        {loading && <Text style={styles.loadingText}>Verifying...</Text>}

        <TouchableOpacity style={styles.cancelButton} onPress={handleBack}>
          <Text style={styles.cancelButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  // Render deleting step
  const renderDeletingStep = () => (
    <View style={styles.contentCentered}>
      <ActivityIndicator size="large" color="#FF3B30" />
      <Text style={styles.deletingText}>Deleting account...</Text>
      <Text style={styles.deletingSubtext}>Please wait while we remove your data</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header - hide during deleting */}
      {step !== 'deleting' && (
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delete Account</Text>
          <View style={styles.headerSpacer} />
        </View>
      )}

      {/* Content based on step */}
      {step === 'warning' && renderWarningStep()}
      {step === 'verify' && renderVerifyStep()}
      {step === 'code' && renderCodeStep()}
      {step === 'deleting' && renderDeletingStep()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  contentCentered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  warningIconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 8,
  },
  phoneNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 32,
  },
  warningBox: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 20,
    marginTop: 24,
    marginBottom: 32,
  },
  warningText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  warningTextBold: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
    marginTop: 16,
  },
  bulletList: {
    marginLeft: 8,
  },
  bulletItem: {
    fontSize: 16,
    color: '#CCCCCC',
    marginBottom: 8,
    paddingLeft: 8,
  },
  buttonContainer: {
    marginTop: 'auto',
    marginBottom: 40,
  },
  dangerButton: {
    borderWidth: 2,
    borderColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#999999',
  },
  primaryButton: {
    marginBottom: 16,
  },
  codeInputContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  codeInput: {
    width: '80%',
    height: 72,
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: 16,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#333333',
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    color: '#FFFFFF',
  },
  codeInputError: {
    borderColor: '#FF3B30',
  },
  errorContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    fontWeight: '600',
  },
  retryDelayText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 4,
  },
  loadingText: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    marginTop: 16,
  },
  deletingText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 24,
  },
  deletingSubtext: {
    fontSize: 14,
    color: '#999999',
    marginTop: 8,
  },
});

export default DeleteAccountScreen;
