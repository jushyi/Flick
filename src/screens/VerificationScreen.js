import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components';
import { verifyCode } from '../services/firebase/phoneAuthService';
import { formatPhoneWithCountry } from '../utils/phoneUtils';
import logger from '../utils/logger';

/**
 * Verification Screen
 * Second step of phone authentication - enter 6-digit SMS code
 * Uses confirmation object from React Native Firebase
 */
const VerificationScreen = ({ navigation, route }) => {
  const { confirmation, phoneNumber, e164 } = route.params || {};

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [retryDelay, setRetryDelay] = useState(0); // Delay before allowing retry after error

  const inputRef = useRef(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // Auto-focus on mount
  useEffect(() => {
    logger.debug('VerificationScreen: Mounted', {
      hasConfirmation: !!confirmation,
      phoneNumber,
    });

    // Focus the input after a brief delay for smooth animation
    const focusTimeout = setTimeout(() => {
      inputRef.current?.focus();
    }, 300);

    return () => clearTimeout(focusTimeout);
  }, []);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer <= 0) return;

    const interval = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [resendTimer]);

  // Retry delay countdown (prevents rapid retries after error)
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

  // Auto-submit when 6 digits entered (only if not in retry delay)
  useEffect(() => {
    if (code.length === 6 && retryDelay === 0) {
      logger.debug('VerificationScreen: Auto-submitting code');
      handleVerify();
    }
  }, [code, retryDelay]);

  const handleVerify = async () => {
    if (loading || retryDelay > 0) return;

    logger.info('VerificationScreen: Verify pressed', { codeLength: code.length });

    // Clear previous error
    setError('');

    // Validate code format
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Please enter the 6-digit code.');
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      // Use confirmation object to verify code
      const result = await verifyCode(confirmation, code);

      if (result.success) {
        logger.info('VerificationScreen: Verification successful', {
          userId: result.user?.uid,
        });

        // Auth state listener in AuthContext will handle navigation
        // If new user, they'll be directed to profile setup
        // If existing user, they'll be directed to main app
      } else {
        logger.warn('VerificationScreen: Verification failed', { error: result.error });
        setError(result.error);
        setCode(''); // Clear code on error
        triggerShake();
        setRetryDelay(3); // 3 second delay before allowing retry
        // Refocus input after clearing
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } catch (err) {
      logger.error('VerificationScreen: Unexpected error', { error: err.message });
      setError('An unexpected error occurred. Please try again.');
      setCode('');
      triggerShake();
      setRetryDelay(3);
      setTimeout(() => inputRef.current?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;

    logger.info('VerificationScreen: Resend code pressed');

    // Navigate back to phone input screen to resend
    navigation.goBack();
  };

  const handleCodeChange = text => {
    // Only allow digits, max 6 characters
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 6);
    setCode(cleaned);
    if (error) setError(''); // Clear error on change
  };

  const handleBack = () => {
    logger.debug('VerificationScreen: Back pressed');
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View style={styles.content}>
          {/* Header */}
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          {/* Title */}
          <Text style={styles.title}>Verify your number</Text>
          <Text style={styles.subtitle}>Enter the 6-digit code sent to</Text>
          <Text style={styles.phoneNumber}>
            {e164 ? formatPhoneWithCountry(e164) : phoneNumber || 'your phone'}
          </Text>

          {/* Code Input */}
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
              placeholderTextColor="#CCCCCC"
              editable={!loading && retryDelay === 0}
            />
          </Animated.View>

          {/* Error Message */}
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              {retryDelay > 0 && <Text style={styles.retryDelayText}>Retry in {retryDelay}s</Text>}
            </View>
          ) : null}

          {/* Verify Button (hidden when auto-submit is active, but available as backup) */}
          {code.length === 6 && !loading && (
            <Button
              title="Verify"
              variant="primary"
              onPress={handleVerify}
              loading={loading}
              style={styles.verifyButton}
            />
          )}

          {/* Loading indicator */}
          {loading && <Text style={styles.loadingText}>Verifying...</Text>}

          {/* Resend Code */}
          <View style={styles.resendContainer}>
            {resendTimer > 0 ? (
              <Text style={styles.resendTimerText}>Resend code in {resendTimer}s</Text>
            ) : (
              <TouchableOpacity onPress={handleResend} disabled={loading}>
                <Text style={styles.resendButton}>Didn&apos;t receive the code? Resend</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Change Number Link */}
          <TouchableOpacity onPress={handleBack} style={styles.changeNumberContainer}>
            <Text style={styles.changeNumberText}>
              Wrong number? <Text style={styles.changeNumberLink}>Change</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backButton: {
    marginBottom: 24,
  },
  backButtonText: {
    fontSize: 16,
    color: '#666666',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  phoneNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 40,
  },
  codeInputContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  codeInput: {
    width: '80%',
    height: 72,
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: 16,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  codeInputError: {
    borderColor: '#FF4444',
  },
  errorContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#FF4444',
    textAlign: 'center',
    fontWeight: '600',
  },
  retryDelayText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginTop: 4,
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 16,
  },
  verifyButton: {
    marginTop: 16,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  resendTimerText: {
    fontSize: 14,
    color: '#999999',
  },
  resendButton: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  changeNumberContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  changeNumberText: {
    fontSize: 14,
    color: '#666666',
  },
  changeNumberLink: {
    color: '#000000',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default VerificationScreen;
