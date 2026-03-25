/**
 * TagFriendsModal
 *
 * Slide-up modal for selecting friends to tag in a photo during darkroom triage.
 * Fetches accepted friends on mount, displays as a multi-select list with
 * checkmark indicators. Calls onConfirm with array of selected friend IDs.
 *
 * Props:
 * - visible: boolean - Whether the modal is visible
 * - onClose: function - Callback to close the modal
 * - onConfirm: function(selectedIds: string[]) - Callback with selected friend IDs
 * - initialSelectedIds: string[] - Pre-selected friend IDs
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
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PixelIcon from './PixelIcon';
import PixelSpinner from './PixelSpinner';
import StrokedNameText from './StrokedNameText';
import { useAuth } from '../context/AuthContext';
import { getFriends as getFriendships } from '../services/supabase/friendshipService';
import { getUserProfile, UserProfile } from '../services/supabase/profileService';
import { colors } from '../constants/colors';
import { styles } from '../styles/TagFriendsModal.styles';
import logger from '../utils/logger';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
  initialSelectedIds?: string[];
};

const TagFriendsModal = ({ visible, onClose, onConfirm, initialSelectedIds = [] }: Props) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [selectedIds, setSelectedIds] = useState(new Set(initialSelectedIds));
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

  // Reset selection when modal opens with new initialSelectedIds
  useEffect(() => {
    if (visible) {
      setSelectedIds(new Set(initialSelectedIds));
    }
  }, [visible, initialSelectedIds]);

  const loadFriends = useCallback(async () => {
    setLoading(true);
    try {
      const friendships = await getFriendships(user!.id);

      // Extract friend user IDs and hydrate with profiles
      const friendProfiles: UserProfile[] = [];
      for (const friendship of friendships) {
        const friendId = friendship.friendUserId;
        try {
          const profile = await getUserProfile(friendId);
          friendProfiles.push(profile);
        } catch {
          // Skip friends whose profiles can't be loaded
        }
      }

      // Sort alphabetically by display name
      friendProfiles.sort((a, b) => {
        const nameA = (a.displayName || a.username || '').toLowerCase();
        const nameB = (b.displayName || b.username || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setFriends(friendProfiles);
      logger.info('TagFriendsModal: Loaded friends', { count: friendProfiles.length });
    } catch (error) {
      logger.error('TagFriendsModal: Error loading friends', { error: (error as Error).message });
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (visible && user) {
      loadFriends();
    }
  }, [visible, user, loadFriends]);

  const toggleFriend = useCallback(friendId => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(friendId)) {
        next.delete(friendId);
      } else {
        next.add(friendId);
      }
      return next;
    });
  }, []);

  const handleDone = useCallback(() => {
    const ids = Array.from(selectedIds);
    onConfirm(ids);
  }, [selectedIds, onConfirm]);

  const renderFriendItem = useCallback(
    ({ item }) => {
      const isSelected = selectedIds.has(item.id);

      return (
        <TouchableOpacity
          style={styles.friendRow}
          onPress={() => toggleFriend(item.id)}
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
          <View style={styles.friendInfo}>
            <StrokedNameText
              style={styles.friendName}
              nameColor={item?.nameColor}
              numberOfLines={1}
            >
              {item.displayName || 'Unknown'}
            </StrokedNameText>
            {item.username && (
              <Text style={styles.friendUsername} numberOfLines={1}>
                @{item.username}
              </Text>
            )}
          </View>

          {/* Selection indicator */}
          <PixelIcon
            name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={isSelected ? colors.interactive.primary : colors.icon.inactive}
            style={styles.checkIcon}
          />
        </TouchableOpacity>
      );
    },
    [selectedIds, toggleFriend]
  );

  const keyExtractor = useCallback((item: UserProfile) => item.id, []);

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
            <View style={styles.headerSpacer} />
            <Text style={styles.headerTitle}>Tag Friends</Text>
            <TouchableOpacity style={styles.doneButton} onPress={handleDone} activeOpacity={0.7}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <PixelSpinner size="large" color={colors.icon.primary} />
              <Text style={styles.loadingText}>Loading friends...</Text>
            </View>
          ) : friends.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No friends yet</Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              extraData={selectedIds}
              renderItem={renderFriendItem}
              keyExtractor={keyExtractor}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={10}
              maxToRenderPerBatch={8}
              windowSize={5}
              removeClippedSubviews={true}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

export default TagFriendsModal;
