/**
 * DeletionRecoveryModal
 *
 * Shown when user logs in with a pending account deletion.
 * Offers choice to cancel deletion or proceed (sign out).
 */

import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import PixelIcon from './PixelIcon';
import PixelSpinner from './PixelSpinner';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';
import { format } from 'date-fns';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MODAL_WIDTH = Math.min(SCREEN_WIDTH * 0.9, 400);

const DeletionRecoveryModal = ({ visible, scheduledDate, onCancel, onProceed }) => {
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    setLoading(true);
    await onCancel();
    setLoading(false);
  };

  const handleProceed = () => {
    onProceed();
  };

  const formattedDate = scheduledDate ? format(scheduledDate, 'MMMM d, yyyy') : 'Unknown';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.iconContainer}>
            <PixelIcon name="warning" size={48} color="#F59E0B" />
          </View>

          <Text style={styles.title}>Account Scheduled for Deletion</Text>

          <Text style={styles.body}>
            Your account is scheduled to be permanently deleted on{' '}
            <Text style={styles.dateText}>{formattedDate}</Text>.
          </Text>

          <Text style={styles.question}>
            Would you like to cancel the deletion and keep your account?
          </Text>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleCancel}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <PixelSpinner color={colors.text.primary} />
            ) : (
              <Text style={styles.primaryButtonText}>Keep My Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleProceed}
            disabled={loading}
            activeOpacity={0.6}
          >
            <Text style={styles.secondaryButtonText}>Continue with Deletion</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: MODAL_WIDTH,
    backgroundColor: colors.background.secondary,
    borderRadius: layout.borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
  dateText: {
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  question: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: colors.brand.purple,
    paddingVertical: spacing.md,
    borderRadius: layout.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    minHeight: layout.dimensions.buttonMinHeight,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  secondaryButton: {
    paddingVertical: spacing.xs,
  },
  secondaryButtonText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
  },
});

export default DeletionRecoveryModal;
