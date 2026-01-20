import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';
import { getTimeAgo } from '../utils/timeUtils';
import logger from '../utils/logger';

// Initialize Firestore
const db = getFirestore();

/**
 * FriendRequestCard - Display a friend request
 *
 * Props:
 * - request: Friendship object with user data
 * - type: 'received' | 'sent'
 * - onAccept: Accept handler (received only)
 * - onDecline: Decline handler (received only)
 * - onCancel: Cancel handler (sent only)
 * - currentUserId: Current user's ID
 *
 * Display:
 * - Profile photo (60x60)
 * - Display name + username
 * - Time ago (e.g., "2 days ago")
 * - Action buttons with loading state
 */
const FriendRequestCard = ({ request, type, onAccept, onDecline, onCancel, currentUserId }) => {
  const [otherUser, setOtherUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  /**
   * Get the "other user" ID (not the current user)
   */
  const getOtherUserId = () => {
    if (request.user1Id === currentUserId) {
      return request.user2Id;
    }
    return request.user1Id;
  };

  /**
   * Fetch user profile data
   */
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const otherUserId = getOtherUserId();
        const userRef = doc(db, 'users', otherUserId);
        const userDoc = await getDoc(userRef);

        // Modular API uses exists() as a method
        if (userDoc.exists()) {
          setOtherUser({
            id: userDoc.id,
            ...userDoc.data(),
          });
        }
      } catch (error) {
        logger.error('Error fetching user data', error);
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserData();
  }, [request.id]);

  /**
   * Handle accept with loading state
   */
  const handleAccept = async () => {
    setActionLoading(true);
    await onAccept(request.id);
    setActionLoading(false);
  };

  /**
   * Handle decline with loading state
   */
  const handleDecline = async () => {
    setActionLoading(true);
    await onDecline(request.id);
    setActionLoading(false);
  };

  /**
   * Handle cancel with loading state
   */
  const handleCancel = async () => {
    setActionLoading(true);
    await onCancel(request.id);
    setActionLoading(false);
  };

  if (loadingUser) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color="#000000" />
      </View>
    );
  }

  if (!otherUser) {
    return null;
  }

  return (
    <View style={styles.card}>
      {/* Profile photo */}
      <View style={styles.profilePicContainer}>
        {otherUser.profilePhotoURL ? (
          <Image source={{ uri: otherUser.profilePhotoURL }} style={styles.profilePic} />
        ) : (
          <View style={[styles.profilePic, styles.profilePicPlaceholder]}>
            <Text style={styles.profilePicText}>
              {otherUser.displayName?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
      </View>

      {/* User info */}
      <View style={styles.userInfo}>
        <Text style={styles.displayName} numberOfLines={1}>
          {otherUser.displayName || 'Unknown User'}
        </Text>
        <Text style={styles.username} numberOfLines={1}>
          @{otherUser.username || 'unknown'}
        </Text>
        <Text style={styles.timeAgo}>{getTimeAgo(request.createdAt)}</Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsContainer}>
        {type === 'received' ? (
          <>
            <TouchableOpacity
              style={[styles.acceptButton, actionLoading && styles.buttonDisabled]}
              onPress={handleAccept}
              disabled={actionLoading}
              activeOpacity={0.7}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.acceptButtonText}>Accept</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.declineButton, actionLoading && styles.buttonDisabled]}
              onPress={handleDecline}
              disabled={actionLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.cancelButton, actionLoading && styles.buttonDisabled]}
            onPress={handleCancel}
            disabled={actionLoading}
            activeOpacity={0.7}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#666666" />
            ) : (
              <Text style={styles.cancelButtonText}>Cancel</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  profilePicContainer: {
    marginRight: 12,
  },
  profilePic: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  profilePicPlaceholder: {
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#666666',
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  timeAgo: {
    fontSize: 12,
    color: '#999999',
  },
  actionsContainer: {
    flexDirection: 'column',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  declineButton: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default FriendRequestCard;
