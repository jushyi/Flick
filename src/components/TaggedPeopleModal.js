/**
 * TaggedPeopleModal
 *
 * Slide-up dark modal for viewing tagged people on a photo.
 * Non-owners see this when tapping the tag button on a tagged photo.
 * Fetches user profiles for taggedUserIds and displays a list with
 * profile photo, display name, and username. Tapping a row navigates
 * to that person's profile.
 *
 * Props:
 * - visible: boolean - Whether the modal is visible
 * - onClose: function - Callback to close the modal
 * - taggedUserIds: string[] - Array of tagged user IDs
 * - onPersonPress: function(userId, displayName) - Callback when a person row is tapped
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  Image,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PixelIcon from './PixelIcon';
import { getUserProfile } from '../services/firebase/userService';
import { colors } from '../constants/colors';
import { styles } from '../styles/TaggedPeopleModal.styles';
import logger from '../utils/logger';

const TaggedPeopleModal = ({ visible, onClose, taggedUserIds = [], onPersonPress }) => {
  const insets = useSafeAreaInsets();

  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;

  // Animate content slide when visibility changes
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 15,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(400);
    }
  }, [visible, slideAnim]);

  const loadTaggedPeople = useCallback(async () => {
    if (!taggedUserIds || taggedUserIds.length === 0) {
      setPeople([]);
      return;
    }

    setLoading(true);
    try {
      const profiles = [];
      for (const userId of taggedUserIds) {
        const result = await getUserProfile(userId);
        if (result.success && result.profile) {
          profiles.push(result.profile);
        }
      }

      // Sort alphabetically by display name
      profiles.sort((a, b) => {
        const nameA = (a.displayName || a.username || '').toLowerCase();
        const nameB = (b.displayName || b.username || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setPeople(profiles);
      logger.info('TaggedPeopleModal: Loaded tagged people', { count: profiles.length });
    } catch (error) {
      logger.error('TaggedPeopleModal: Error loading tagged people', { error: error.message });
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }, [taggedUserIds]);

  useEffect(() => {
    if (visible) {
      loadTaggedPeople();
    }
  }, [visible, loadTaggedPeople]);

  const handlePersonPress = useCallback(
    (userId, displayName) => {
      if (onPersonPress) {
        onPersonPress(userId, displayName);
      }
      onClose();
    },
    [onPersonPress, onClose]
  );

  const renderPersonItem = useCallback(
    ({ item }) => {
      return (
        <TouchableOpacity
          style={styles.personRow}
          onPress={() => handlePersonPress(item.userId, item.displayName)}
          activeOpacity={0.7}
        >
          {/* Avatar */}
          {item.profilePhotoURL ? (
            <Image source={{ uri: item.profilePhotoURL }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {item.displayName?.[0]?.toUpperCase() || item.username?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}

          {/* Name and username */}
          <View style={styles.textContainer}>
            <Text style={styles.displayName} numberOfLines={1}>
              {item.displayName || 'Unknown'}
            </Text>
            {item.username && (
              <Text style={styles.username} numberOfLines={1}>
                @{item.username}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [handlePersonPress]
  );

  const keyExtractor = useCallback(item => item.userId, []);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Backdrop tap to close */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdropTouchable} />
        </TouchableWithoutFeedback>

        {/* Content */}
        <Animated.View
          style={[
            styles.contentContainer,
            { paddingBottom: insets.bottom, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Tagged People</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
              <PixelIcon name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.icon.primary} />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : people.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No one tagged</Text>
            </View>
          ) : (
            <FlatList
              data={people}
              renderItem={renderPersonItem}
              keyExtractor={keyExtractor}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

export default TaggedPeopleModal;
