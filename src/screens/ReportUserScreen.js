import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PixelIcon from '../components/PixelIcon';
import PixelSpinner from '../components/PixelSpinner';

import { useNavigation, useRoute } from '@react-navigation/native';
import { submitReport, REPORT_REASONS } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
import { styles } from '../styles/ReportUserScreen.styles';
import logger from '../utils/logger';

const REASON_LABELS = {
  spam: 'Spam',
  harassment: 'Harassment',
  inappropriate: 'Inappropriate Content',
  impersonation: 'Impersonation',
  other: 'Other',
};

const REASON_ICONS = {
  spam: 'mail-unread-outline',
  harassment: 'alert-circle-outline',
  inappropriate: 'eye-off-outline',
  impersonation: 'person-outline',
  other: 'ellipsis-horizontal-outline',
};

const ReportUserScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();

  const insets = useSafeAreaInsets();
  const { userId, username, displayName, profilePhotoURL } = route.params || {};

  const [selectedReason, setSelectedReason] = useState(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [detailsFocused, setDetailsFocused] = useState(false);
  const scrollViewRef = useRef(null);

  const handleDetailsFocus = () => {
    setDetailsFocused(true);
    // Auto-scroll to bottom after a brief delay to ensure layout is updated
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSelectReason = reason => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedReason(reason);
  };

  const handleSubmit = async () => {
    if (!selectedReason) return;

    setSubmitting(true);
    try {
      const profileSnapshot = {
        displayName: displayName || null,
        username: username || null,
        bio: null,
        profilePhotoURL: profilePhotoURL || null,
      };

      const result = await submitReport(
        user.uid,
        userId,
        selectedReason,
        details.trim() || null,
        profileSnapshot
      );

      if (result.success) {
        Alert.alert('Report Submitted', 'Thank you for helping keep the community safe', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Could not submit report');
      }
    } catch (error) {
      logger.error('ReportUserScreen: Error submitting report', { error: error.message });
      Alert.alert('Error', 'Could not submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, Platform.OS === 'android' && { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <PixelIcon name="close" size={24} color={colors.icon.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report @{username || 'user'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Reason Picker */}
        <Text style={styles.sectionTitle}>Why are you reporting this user?</Text>

        {REPORT_REASONS.map(reason => (
          <TouchableOpacity
            key={reason}
            style={styles.reasonRow}
            onPress={() => handleSelectReason(reason)}
          >
            <PixelIcon
              name={REASON_ICONS[reason]}
              size={24}
              color={colors.icon.secondary}
              style={styles.reasonIcon}
            />
            <Text style={styles.reasonLabel}>{REASON_LABELS[reason]}</Text>
            {selectedReason === reason && (
              <PixelIcon
                name="checkmark-circle"
                size={24}
                color={colors.brand.purple}
                style={styles.checkmark}
              />
            )}
          </TouchableOpacity>
        ))}

        {/* Details Field - appears when reason selected */}
        {selectedReason && (
          <View style={styles.detailsContainer}>
            <TextInput
              style={styles.detailsInput}
              placeholder="Add details (optional)"
              placeholderTextColor={colors.text.tertiary}
              value={details}
              onChangeText={setDetails}
              multiline
              maxLength={500}
              onFocus={handleDetailsFocus}
              onBlur={() => setDetailsFocused(false)}
            />
            {detailsFocused && <Text style={styles.charCount}>{details.length}/500</Text>}
          </View>
        )}

        {/* Submit Button - appears when reason selected */}
        {selectedReason && (
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <PixelSpinner color={colors.text.primary} />
            ) : (
              <Text style={styles.submitButtonText}>Submit Report</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Bottom spacing for keyboard - extra height for iOS keyboard suggestions bar */}
        <View style={{ height: Platform.OS === 'ios' ? 100 : 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default ReportUserScreen;
