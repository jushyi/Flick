import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { getTimeAgo } from '../utils/timeUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * PhotoDetailModal - Full-screen photo viewer
 *
 * Features:
 * - Full-screen photo display
 * - Pinch-to-zoom (using ScrollView)
 * - Profile header and reaction footer
 * - Tap to close
 *
 * @param {boolean} visible - Modal visibility state
 * @param {object} photo - Photo object with user data and reactions
 * @param {function} onClose - Callback to close modal
 * @param {function} onReactionPress - Callback when reaction button is pressed
 */
const PhotoDetailModal = ({ visible, photo, onClose, onReactionPress }) => {
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });

  // Extract photo data
  const {
    imageURL,
    capturedAt,
    reactions = {},
    reactionCount = 0,
    user = {},
  } = photo || {};

  const { username, displayName, profilePhotoURL } = user;

  // Get image dimensions
  const handleImageLoad = (event) => {
    const { width, height } = event.nativeEvent.source;
    setImageLayout({ width, height });
  };

  // Debug handler
  const handleReactionButtonPress = () => {
    console.log('Reaction button pressed in PhotoDetailModal');
    if (onReactionPress) {
      console.log('Calling onReactionPress');
      onReactionPress();
    } else {
      console.log('ERROR: onReactionPress is undefined!');
    }
  };

  if (!photo) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <View style={styles.header}>
          {/* Close button */}
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          {/* Profile info */}
          <View style={styles.profileSection}>
            {profilePhotoURL ? (
              <Image
                source={{ uri: profilePhotoURL }}
                style={styles.profilePic}
              />
            ) : (
              <View style={[styles.profilePic, styles.profilePicPlaceholder]}>
                <Text style={styles.profilePicText}>
                  {displayName?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.displayName} numberOfLines={1}>
                {displayName || 'Unknown User'}
              </Text>
              <Text style={styles.username} numberOfLines={1}>
                @{username || 'unknown'}
              </Text>
            </View>
          </View>

          {/* Timestamp */}
          <Text style={styles.timestamp}>{getTimeAgo(capturedAt)}</Text>
        </View>

        {/* Photo with pinch-to-zoom */}
        <View style={styles.photoContainer}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.photoContentContainer}
            maximumZoomScale={4}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            bounces={false}
            centerContent
          >
            <Image
              source={{ uri: imageURL }}
              style={styles.photo}
              resizeMode="contain"
              onLoad={handleImageLoad}
            />
          </ScrollView>
        </View>

        {/* Footer - Reaction button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.reactionButton}
            onPress={handleReactionButtonPress}
            activeOpacity={0.7}
          >
            <Text style={styles.reactionButtonIcon}>😊</Text>
            <Text style={styles.reactionButtonText}>
              {reactionCount > 0 ? `${reactionCount} reactions` : 'Add reaction'}
            </Text>
          </TouchableOpacity>

          {/* Show top 3 reactions if available */}
          {reactionCount > 0 && (
            <View style={styles.reactionPreview}>
              {Object.values(reactions)
                .slice(0, 3)
                .map((emoji, index) => (
                  <Text key={index} style={styles.reactionPreviewEmoji}>
                    {emoji}
                  </Text>
                ))}
            </View>
          )}
        </View>

        {/* Pinch hint */}
        <View style={styles.tapHint}>
          <Text style={styles.tapHintText}>Pinch to zoom</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: (StatusBar.currentHeight || 44) + 10,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profilePic: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  profilePicPlaceholder: {
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CCCCCC',
  },
  profileInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  username: {
    fontSize: 12,
    color: '#CCCCCC',
  },
  timestamp: {
    fontSize: 12,
    color: '#999999',
    marginLeft: 8,
  },
  photoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  photoContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100%',
  },
  photo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  reactionButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  reactionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  reactionPreview: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  reactionPreviewEmoji: {
    fontSize: 24,
  },
  tapHint: {
    position: 'absolute',
    top: (StatusBar.currentHeight || 44) + 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  tapHintText: {
    fontSize: 12,
    color: '#CCCCCC',
    fontWeight: '500',
  },
});

export default PhotoDetailModal;
