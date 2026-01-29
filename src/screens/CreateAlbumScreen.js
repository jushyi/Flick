import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import logger from '../utils/logger';

const MAX_NAME_LENGTH = 24;

const CreateAlbumScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);

  const [albumName, setAlbumName] = useState('');

  // Auto-focus on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleBackPress = () => {
    logger.info('CreateAlbumScreen: Back pressed');
    navigation.goBack();
  };

  const handleNameChange = text => {
    // Limit to max length
    if (text.length <= MAX_NAME_LENGTH) {
      setAlbumName(text);
    }
  };

  const handleNextPress = () => {
    const trimmedName = albumName.trim();
    if (trimmedName.length === 0) return;

    logger.info('CreateAlbumScreen: Next pressed', { albumName: trimmedName });
    navigation.navigate('AlbumPhotoPicker', { albumName: trimmedName });
  };

  const isNextDisabled = albumName.trim().length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Album</Text>
        <View style={styles.headerButton} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={albumName}
          onChangeText={handleNameChange}
          placeholder="Album name"
          placeholderTextColor={colors.text.tertiary}
          maxLength={MAX_NAME_LENGTH}
          autoCapitalize="sentences"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleNextPress}
        />
        <View style={styles.underline} />
        <Text style={styles.charCount}>
          {albumName.length}/{MAX_NAME_LENGTH}
        </Text>
      </View>

      {/* Next Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.nextButton, isNextDisabled && styles.nextButtonDisabled]}
          onPress={handleNextPress}
          disabled={isNextDisabled}
        >
          <Text style={[styles.nextButtonText, isNextDisabled && styles.nextButtonTextDisabled]}>
            Next
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 80,
    alignItems: 'center',
  },
  input: {
    width: '100%',
    fontSize: 24,
    fontWeight: '500',
    color: colors.text.primary,
    textAlign: 'center',
    paddingVertical: 12,
  },
  underline: {
    width: '100%',
    height: 1,
    backgroundColor: colors.border.subtle,
    marginTop: 4,
  },
  charCount: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: 12,
  },
  footer: {
    paddingHorizontal: 16,
  },
  nextButton: {
    backgroundColor: colors.text.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: colors.background.tertiary,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  nextButtonTextDisabled: {
    color: colors.text.tertiary,
  },
});

export default CreateAlbumScreen;
