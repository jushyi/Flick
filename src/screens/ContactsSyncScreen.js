import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PixelIcon from '../components/PixelIcon';
import PixelSpinner from '../components/PixelSpinner';
import { useAuth } from '../context/AuthContext';
import FriendCard from '../components/FriendCard';
import {
  syncContactsAndFindSuggestions,
  markContactsSyncCompleted,
} from '../services/firebase/contactSyncService';
import { sendFriendRequest } from '../services/firebase/friendshipService';
import { mediumImpact } from '../utils/haptics';
import { colors } from '../constants/colors';
import { styles } from '../styles/ContactsSyncScreen.styles';
import logger from '../utils/logger';

/**
 * ContactsSyncScreen - Onboarding screen for syncing contacts and finding friends
 *
 * Flow:
 * 1. Show privacy-first messaging with "Sync Contacts" button
 * 2. On sync: request permission, fetch contacts, find matches
 * 3. Show results: friend suggestions with "Add" buttons
 * 4. Empty state: no matches found, encourage sharing
 * 5. Continue to main app
 */
const ContactsSyncScreen = ({ navigation }) => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const [screenState, setScreenState] = useState('initial'); // initial, syncing, results, empty
  const [suggestions, setSuggestions] = useState([]);
  const [addedUsers, setAddedUsers] = useState(new Set());
  const [actionLoading, setActionLoading] = useState({});

  const handleSyncContacts = async () => {
    try {
      setScreenState('syncing');
      mediumImpact();

      const result = await syncContactsAndFindSuggestions(user.uid, userProfile?.phoneNumber);

      if (!result.success) {
        if (result.error === 'permission_denied_permanent') {
          // User permanently denied - they need to go to settings
          setScreenState('initial');
          return;
        }
        if (result.error === 'permission_denied') {
          // User denied this time
          setScreenState('initial');
          return;
        }
        Alert.alert('Error', 'Failed to sync contacts. Please try again.');
        setScreenState('initial');
        return;
      }

      // Mark sync as completed
      await markContactsSyncCompleted(user.uid, true);

      if (result.suggestions.length === 0) {
        setScreenState('empty');
      } else {
        setSuggestions(result.suggestions);
        setScreenState('results');
      }
    } catch (error) {
      logger.error('Error syncing contacts', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
      setScreenState('initial');
    }
  };

  const handleAddFriend = async userId => {
    try {
      setActionLoading(prev => ({ ...prev, [userId]: true }));
      mediumImpact();

      const result = await sendFriendRequest(user.uid, userId);

      if (result.success) {
        setAddedUsers(prev => new Set([...prev, userId]));
      } else {
        Alert.alert('Error', result.error || 'Failed to send friend request');
      }
    } catch (error) {
      logger.error('Error adding friend', error);
      Alert.alert('Error', 'Failed to send friend request');
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleSkip = async () => {
    mediumImpact();
    await markContactsSyncCompleted(user.uid, true);
    await refreshUserProfile();
    navigation.navigate('NotificationPermission');
  };

  const handleContinue = async () => {
    mediumImpact();
    await refreshUserProfile();
    navigation.navigate('NotificationPermission');
  };

  const renderInitialState = () => (
    <View style={styles.content}>
      <View style={styles.privacySection}>
        <PixelIcon
          name="people-outline"
          size={64}
          color={colors.interactive.primary}
          style={styles.privacyIcon}
        />
        <Text style={styles.privacyTitle}>Find Your Friends</Text>
        <Text style={styles.privacyText}>
          See which of your contacts are already on REWIND. Your contacts stay on your device — we
          only match phone numbers to find friends.
        </Text>
        <TouchableOpacity
          style={styles.syncButton}
          onPress={handleSyncContacts}
          activeOpacity={0.7}
        >
          <Text style={styles.syncButtonText}>Sync Contacts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          activeOpacity={0.7}
          testID="contacts-skip-button"
        >
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSyncingState = () => (
    <View style={styles.loadingContainer}>
      <PixelSpinner size="large" color={colors.interactive.primary} />
      <Text style={styles.loadingText}>Finding your friends...</Text>
    </View>
  );

  const renderResultsState = () => {
    const addedCount = addedUsers.size;

    return (
      <View style={styles.content}>
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>
            {suggestions.length} {suggestions.length === 1 ? 'Friend' : 'Friends'} Found
          </Text>
          <Text style={styles.resultsSubtitle}>
            {addedCount > 0
              ? `${addedCount} added • Tap to add more`
              : 'Tap Add to send friend requests'}
          </Text>
        </View>
        <FlatList
          data={suggestions}
          renderItem={({ item }) => {
            const isAdded = addedUsers.has(item.id);
            return (
              <FriendCard
                user={{
                  userId: item.id,
                  displayName: item.displayName,
                  username: item.username,
                  profilePhotoURL: item.profilePhotoURL || item.photoURL,
                }}
                relationshipStatus={isAdded ? 'pending_sent' : 'none'}
                onAction={userId => handleAddFriend(userId)}
                loading={actionLoading[item.id]}
              />
            );
          }}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
        />
        <View style={styles.continueContainer}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.7}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.content}>
      <View style={styles.emptyContainer}>
        <PixelIcon
          name="heart-outline"
          size={64}
          color={colors.text.tertiary}
          style={styles.emptyIcon}
        />
        <Text style={styles.emptyTitle}>No Friends Found Yet</Text>
        <Text style={styles.emptyText}>
          None of your contacts are on REWIND yet. Invite them to join so you can share moments
          together!
        </Text>
      </View>
      <View style={styles.continueContainer}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          activeOpacity={0.7}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderContent = () => {
    switch (screenState) {
      case 'syncing':
        return renderSyncingState();
      case 'results':
        return renderResultsState();
      case 'empty':
        return renderEmptyState();
      default:
        return renderInitialState();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <PixelIcon name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Friends</Text>
      </View>

      {renderContent()}
    </SafeAreaView>
  );
};

export default ContactsSyncScreen;
