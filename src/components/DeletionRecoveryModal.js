/**
 * DeletionRecoveryModal
 *
 * Shown when user logs in with a pending account deletion.
 * Offers choice to cancel deletion or proceed (sign out).
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
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
            <Ionicons name="warning" size={48} color="#F59E0B" />
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
              <ActivityIndicator color={colors.text.primary} />
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
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  dateText: {
    fontWeight: '600',
    color: colors.text.primary,
  },
  question: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: colors.brand.purple,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
  },
  secondaryButton: {
    paddingVertical: 8,
  },
  secondaryButtonText: {
    fontSize: 15,
    color: colors.text.secondary,
  },
});

export default DeletionRecoveryModal;
