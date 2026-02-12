import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PixelIcon from '../components/PixelIcon';
import PixelSpinner from '../components/PixelSpinner';
import { useNavigation } from '@react-navigation/native';
import { getAuth } from '@react-native-firebase/auth';
import { sendVerificationCode, verifyCode } from '../services/firebase/phoneAuthService';
import { scheduleAccountDeletion } from '../services/firebase/accountService';
import {
  downloadAllPhotos,
  requestMediaLibraryPermission,
} from '../services/downloadPhotosService';
import { formatPhoneWithCountry } from '../utils/phoneUtils';
import { usePhoneAuth } from '../context/PhoneAuthContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components';
import DownloadProgress from '../components/DownloadProgress';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';
import logger from '../utils/logger';

/**
 * DeleteAccountScreen
 *
 * Multi-step account deletion scheduling flow with 30-day grace period:
 * 1. Warning - Explain 30-day grace period, offer photo download, show what will be deleted
 * 2. Verify - Re-authenticate via phone
 * 3. Code - Enter verification code
 * 4. Scheduling - Show progress and schedule deletion (not immediate)
 *
 * After scheduling, user is signed out. Logging back in cancels the deletion.
 * Requires phone re-authentication before scheduling for security.
 */
const DeleteAccountScreen = () => {
  const navigation = useNavigation();
  const { confirmationRef } = usePhoneAuth();
  const { signOut, user } = useAuth();

  // Step state: 'warning' | 'verify' | 'code' | 'scheduling'
  const [step, setStep] = useState('warning');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [retryDelay, setRetryDelay] = useState(0);

  // Download state
  const [downloadStatus, setDownloadStatus] = useState('idle'); // 'idle' | 'downloading' | 'complete' | 'error'
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });

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
        logger.info('DeleteAccountScreen: Verification successful, proceeding to scheduling');
        setStep('scheduling');
        await handleScheduleDeletion();
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

  const handleScheduleDeletion = async () => {
    logger.info('DeleteAccountScreen: Scheduling account deletion');

    try {
      const result = await scheduleAccountDeletion();

      if (result.success) {
        logger.info('DeleteAccountScreen: Account scheduled for deletion', {
          scheduledDate: result.scheduledDate,
        });

        // Format the scheduled date for display
        const formattedDate = result.scheduledDate.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });

        Alert.alert(
          'Account Scheduled for Deletion',
          `Your account will be deleted on ${formattedDate}. You can cancel anytime by logging back in.`,
          [
            {
              text: 'OK',
              onPress: async () => {
                logger.info('DeleteAccountScreen: Signing out after scheduling');
                await signOut();
              },
            },
          ]
        );
      } else {
        logger.error('DeleteAccountScreen: Scheduling failed', { error: result.error });
        Alert.alert('Scheduling Failed', result.error || 'Failed to schedule account deletion.', [
          { text: 'OK', onPress: () => setStep('warning') },
        ]);
      }
    } catch (err) {
      logger.error('DeleteAccountScreen: Unexpected error during scheduling', {
        error: err.message,
      });
      Alert.alert('Error', 'An unexpected error occurred. Please try again.', [
        { text: 'OK', onPress: () => setStep('warning') },
      ]);
    }
  };

  // Handle download all photos
  const handleDownloadPhotos = async () => {
    logger.info('DeleteAccountScreen: Starting download all photos');

    // Request permission first
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'To download your photos, we need access to your photo library. Please enable this in your device settings.',
        [{ text: 'OK' }]
      );
      return;
    }

    setDownloadStatus('downloading');
    setDownloadProgress({ current: 0, total: 0 });

    try {
      const result = await downloadAllPhotos(user?.uid, progress => {
        setDownloadProgress(progress);
      });

      if (result.success) {
        setDownloadStatus('complete');
        logger.info('DeleteAccountScreen: Download complete', {
          downloaded: result.downloaded,
          failed: result.failed,
        });
      } else {
        setDownloadStatus('error');
        logger.warn('DeleteAccountScreen: Download failed', { error: result.error });
      }
    } catch (err) {
      logger.error('DeleteAccountScreen: Download error', { error: err.message });
      setDownloadStatus('error');
    }
  };

  // Format date 30 days from now
  const getScheduledDateText = () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const renderWarningStep = () => (
    <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
      <View style={styles.warningIconContainer}>
        <PixelIcon name="warning-outline" size={64} color={colors.status.danger} />
      </View>

      <Text style={styles.title}>Delete Account</Text>

      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          Your account will be scheduled for deletion in{' '}
          <Text style={styles.warningTextBold}>30 days</Text>
        </Text>
        <Text style={styles.warningSubtext}>
          During this time, you can cancel by logging back in.
        </Text>
        <Text style={[styles.warningText, styles.warningTextMargin]}>
          After 30 days, the following will be permanently deleted:
        </Text>
        <View style={styles.bulletList}>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>All your photos</Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>Your friend connections</Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>Your profile and account data</Text>
          </View>
        </View>
      </View>

      {/* Download section */}
      <View style={styles.downloadSection}>
        <Text style={styles.downloadHeading}>Save Your Memories</Text>
        <Text style={styles.downloadSubtext}>
          Download all your photos to your camera roll before deleting
        </Text>

        {downloadStatus === 'idle' && (
          <TouchableOpacity style={styles.downloadButton} onPress={handleDownloadPhotos}>
            <PixelIcon
              name="download-outline"
              size={20}
              color={colors.interactive.primary}
              style={styles.downloadIcon}
            />
            <Text style={styles.downloadButtonText}>Download All Photos</Text>
          </TouchableOpacity>
        )}

        {(downloadStatus === 'downloading' ||
          downloadStatus === 'complete' ||
          downloadStatus === 'error') && (
          <DownloadProgress
            current={downloadProgress.current}
            total={downloadProgress.total}
            status={downloadStatus === 'downloading' ? 'downloading' : downloadStatus}
          />
        )}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.dangerButton,
            downloadStatus === 'downloading' && styles.dangerButtonDisabled,
          ]}
          onPress={handleUnderstand}
          disabled={downloadStatus === 'downloading'}
        >
          <Text
            style={[
              styles.dangerButtonText,
              downloadStatus === 'downloading' && styles.dangerButtonTextDisabled,
            ]}
          >
            Schedule Deletion
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

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
            placeholderTextColor={colors.text.tertiary}
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

  const renderSchedulingStep = () => (
    <View style={styles.contentCentered}>
      <PixelSpinner size="large" color={colors.status.danger} />
      <Text style={styles.deletingText}>Scheduling deletion...</Text>
      <Text style={styles.deletingSubtext}>Please wait while we process your request</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header - hide during scheduling */}
      {step !== 'scheduling' && (
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <PixelIcon name="chevron-back" size={28} color={colors.icon.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delete Account</Text>
          <View style={styles.headerSpacer} />
        </View>
      )}

      {/* Content based on step */}
      {step === 'warning' && renderWarningStep()}
      {step === 'verify' && renderVerifyStep()}
      {step === 'code' && renderCodeStep()}
      {step === 'scheduling' && renderSchedulingStep()}
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
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  contentCentered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  warningIconContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.size.xxxl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  phoneNumber: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  warningBox: {
    backgroundColor: colors.background.secondary,
    borderRadius: layout.borderRadius.md,
    padding: 20,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  warningText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
    lineHeight: 22,
  },
  warningTextBold: {
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.status.danger,
  },
  warningSubtext: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
    marginBottom: spacing.md,
  },
  warningTextMargin: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  bulletList: {
    marginLeft: spacing.xxs,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bulletDot: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginRight: spacing.xs,
    width: spacing.sm,
  },
  bulletText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    flex: 1,
  },
  buttonContainer: {
    marginTop: 'auto',
    marginBottom: spacing.xxl,
  },
  dangerButton: {
    borderWidth: 2,
    borderColor: colors.status.danger,
    borderRadius: layout.borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dangerButtonDisabled: {
    borderColor: colors.text.tertiary,
    opacity: 0.5,
  },
  dangerButtonText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.status.danger,
  },
  dangerButtonTextDisabled: {
    color: colors.text.tertiary,
  },
  downloadSection: {
    marginBottom: spacing.xl,
  },
  downloadHeading: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  downloadSubtext: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.interactive.primary,
    borderRadius: layout.borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  downloadIcon: {
    marginRight: spacing.xs,
  },
  downloadButtonText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.interactive.primary,
  },
  cancelButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
  },
  primaryButton: {
    marginBottom: spacing.md,
  },
  codeInputContainer: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  codeInput: {
    width: '80%',
    height: 72,
    fontSize: typography.size.display,
    fontFamily: typography.fontFamily.bodyBold,
    letterSpacing: spacing.md,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: colors.border.subtle,
    borderRadius: layout.borderRadius.md,
    backgroundColor: colors.background.secondary,
    color: colors.text.primary,
  },
  codeInputError: {
    borderColor: colors.status.danger,
  },
  errorContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.status.danger,
    textAlign: 'center',
  },
  retryDelayText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.xxs,
  },
  loadingText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  deletingText: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  deletingSubtext: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
});

export default DeleteAccountScreen;
