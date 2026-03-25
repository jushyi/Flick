import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, AuthCodeInput } from '../components';
import { verifyCode, sendVerificationCode } from '../services/supabase/phoneAuthService';
import { formatPhoneWithCountry } from '../utils/phoneUtils';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing } from '../constants/spacing';
import logger from '../utils/logger';

/**
 * Verification Screen
 * Second step of phone authentication - enter 6-digit SMS code
 * Uses Supabase OTP verification (stateless -- no ConfirmationResult needed)
 */
const VerificationScreen = ({ navigation, route }) => {
  // Get phone number and e164 from navigation params
  const { phoneNumber, e164 } = route.params || {};

  logger.debug('VerificationScreen: Mounted', {
    phoneNumber,
    hasE164: !!e164,
  });

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [retryDelay, setRetryDelay] = useState(0); // Delay before allowing retry after error

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // Log mount
  useEffect(() => {
    logger.debug('VerificationScreen: Component ready', {
      phoneNumber,
      hasE164: !!e164,
    });
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
      // Verify code via Supabase OTP (stateless -- pass E.164 phone + code)
      const result = await verifyCode(e164, code);

      if (result.success) {
        logger.info('VerificationScreen: Verification successful');

        // Auth state listener in AuthContext will handle navigation
        // If new user, they'll be directed to profile setup
        // If existing user, they'll be directed to main app
      } else {
        logger.warn('VerificationScreen: Verification failed', { error: result.error });
        setError(result.error || '');
        setCode(''); // Clear code on error
        triggerShake();
        setRetryDelay(3); // 3 second delay before allowing retry
      }
    } catch (err) {
      logger.error('VerificationScreen: Unexpected error', { error: (err as Error).message });
      setError('An unexpected error occurred. Please try again.');
      setCode('');
      triggerShake();
      setRetryDelay(3);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;

    logger.info('VerificationScreen: Resend code pressed');

    try {
      // Resend OTP via Supabase (stateless -- just call sendVerificationCode again)
      const result = await sendVerificationCode(e164, '');
      if (result.success) {
        logger.info('VerificationScreen: Code resent successfully');
        setResendTimer(60);
        setError('');
      } else {
        setError(result.error || 'Failed to resend code');
      }
    } catch (err) {
      logger.error('VerificationScreen: Resend failed', { error: (err as Error).message });
      setError('Failed to resend code. Please try again.');
    }
  };

  // Handle code change - clear error when user types
  const handleCodeChange = newCode => {
    setCode(newCode);
    if (error) setError('');
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
            <AuthCodeInput
              value={code}
              onChange={handleCodeChange}
              onComplete={handleVerify}
              error={!!error}
              disabled={loading || retryDelay > 0}
              autoFocus
              testID="verification-code-input"
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
              testID="verification-submit-button"
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
    backgroundColor: colors.background.primary,
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  backButton: {
    marginBottom: spacing.lg,
  },
  backButtonText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
  },
  title: {
    fontSize: typography.size.xxxl,
    fontFamily: typography.fontFamily.display,
    textAlign: 'center',
    marginBottom: spacing.xs,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  phoneNumber: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  codeInputContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  errorContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: typography.size.md,
    color: colors.status.danger,
    textAlign: 'center',
    fontFamily: typography.fontFamily.bodyBold,
  },
  retryDelayText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.xxs,
  },
  loadingText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  verifyButton: {
    marginTop: spacing.md,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  resendTimerText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.tertiary,
  },
  resendButton: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
    textDecorationLine: 'underline',
  },
  changeNumberContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  changeNumberText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
  },
  changeNumberLink: {
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bodyBold,
    textDecorationLine: 'underline',
  },
});

export default VerificationScreen;
