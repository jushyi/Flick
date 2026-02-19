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

import { useNavigation } from '@react-navigation/native';
import { submitSupportRequest, SUPPORT_CATEGORIES } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/colors';
import { styles } from '../styles/HelpSupportScreen.styles';
import logger from '../utils/logger';

const CATEGORY_LABELS = {
  support: 'Support',
  bug_report: 'Bug Report',
  feature_request: 'Feature Request',
};

const CATEGORY_ICONS = {
  support: 'help-circle-outline',
  bug_report: 'warning-outline',
  feature_request: 'pencil-outline',
};

const HelpSupportScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [descriptionFocused, setDescriptionFocused] = useState(false);
  const scrollViewRef = useRef(null);

  const handleDescriptionFocus = () => {
    setDescriptionFocused(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSelectCategory = category => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedCategory(category);
  };

  const canSubmit = selectedCategory && description.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    Keyboard.dismiss();
    setSubmitting(true);
    try {
      const result = await submitSupportRequest(user.uid, selectedCategory, description.trim());

      if (result.success) {
        Alert.alert('Request Submitted', "Thank you! We'll get back to you soon.", [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Could not submit request');
      }
    } catch (error) {
      logger.error('HelpSupportScreen: Error submitting request', { error: error.message });
      Alert.alert('Error', 'Could not submit request');
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
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Category Picker */}
        <Text style={styles.sectionTitle}>How can we help?</Text>

        {SUPPORT_CATEGORIES.map(category => (
          <TouchableOpacity
            key={category}
            style={styles.reasonRow}
            onPress={() => handleSelectCategory(category)}
          >
            <PixelIcon
              name={CATEGORY_ICONS[category]}
              size={24}
              color={colors.icon.secondary}
              style={styles.reasonIcon}
            />
            <Text style={styles.reasonLabel}>{CATEGORY_LABELS[category]}</Text>
            {selectedCategory === category && (
              <PixelIcon
                name="checkmark-circle"
                size={24}
                color={colors.brand.purple}
                style={styles.checkmark}
              />
            )}
          </TouchableOpacity>
        ))}

        {/* Description Field - appears when category selected */}
        {selectedCategory && (
          <View style={styles.detailsContainer}>
            <TextInput
              style={styles.detailsInput}
              placeholder="Describe your issue or idea..."
              placeholderTextColor={colors.text.tertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={500}
              onFocus={handleDescriptionFocus}
              onBlur={() => setDescriptionFocused(false)}
            />
            {descriptionFocused && <Text style={styles.charCount}>{description.length}/500</Text>}
          </View>
        )}

        {/* Submit Button - appears when category selected */}
        {selectedCategory && (
          <TouchableOpacity
            style={[styles.submitButton, (!canSubmit || submitting) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? (
              <PixelSpinner color={colors.text.primary} />
            ) : (
              <Text style={styles.submitButtonText}>Submit</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Bottom spacing for keyboard */}
        <View style={{ height: Platform.OS === 'ios' ? 100 : 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default HelpSupportScreen;
