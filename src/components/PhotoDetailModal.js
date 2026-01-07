import React, { useState, useEffect, useRef } from 'react';
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
  PanResponder,
  Animated,
} from 'react-native';
import { getTimeAgo } from '../utils/timeUtils';
import { reactionHaptic } from '../utils/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Available reaction emojis (8 options)
 */
const REACTION_EMOJIS = ['😂', '❤️', '🔥', '😍', '👏', '😮', '😢', '💯'];

/**
 * PhotoDetailModal - Full-screen photo viewer with inline emoji reactions
 *
 * Features:
 * - Full-screen photo display
 * - Pinch-to-zoom (using ScrollView)
 * - Profile header
 * - Inline horizontal emoji picker in footer
 * - Multiple reactions per user with counts
 *
 * @param {boolean} visible - Modal visibility state
 * @param {object} photo - Photo object with user data and reactions
 * @param {function} onClose - Callback to close modal
 * @param {function} onReactionToggle - Callback when emoji is toggled (emoji, currentCount)
 * @param {string} currentUserId - Current user's ID
 */
const PhotoDetailModal = ({ visible, photo, onClose, onReactionToggle, currentUserId }) => {
  // State to track if we should re-sort or freeze current order
  const [frozenOrder, setFrozenOrder] = useState(null);
  const sortTimerRef = useRef(null);

  // Animated values for swipe gesture
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // Extract photo data
  const {
    imageURL,
    capturedAt,
    reactions = {},
    user = {},
  } = photo || {};

  const { username, displayName, profilePhotoURL } = user;

  // Pan responder for swipe down to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        // Don't capture if touch is in footer area (bottom ~100px)
        const touchY = evt.nativeEvent.pageY;
        const footerThreshold = SCREEN_HEIGHT - 100;
        return touchY < footerThreshold;
      },
      onStartShouldSetPanResponderCapture: (evt) => {
        // Don't capture if touch is in footer area
        const touchY = evt.nativeEvent.pageY;
        const footerThreshold = SCREEN_HEIGHT - 100;
        return touchY < footerThreshold;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Don't respond if touch started in footer area
        const touchY = evt.nativeEvent.pageY;
        const footerThreshold = SCREEN_HEIGHT - 100;
        // Only respond to downward swipes (dy > 10) outside footer
        return gestureState.dy > 10 && touchY < footerThreshold;
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        // Don't capture if touch is in footer area
        const touchY = evt.nativeEvent.pageY;
        const footerThreshold = SCREEN_HEIGHT - 100;
        // Capture gesture if it's a clear downward swipe outside footer
        return gestureState.dy > 10 && touchY < footerThreshold;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow downward swipes
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
          // Fade out as user swipes down
          const fadeAmount = Math.max(0, 1 - (gestureState.dy / SCREEN_HEIGHT));
          opacity.setValue(fadeAmount);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If swiped down more than 1/3 of screen or fast swipe (velocity), close the modal
        const dismissThreshold = SCREEN_HEIGHT / 3;
        if (gestureState.dy > dismissThreshold || gestureState.vy > 0.5) {
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: SCREEN_HEIGHT,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onClose();
            // Reset after a short delay to ensure smooth transition
            setTimeout(() => {
              translateY.setValue(0);
              opacity.setValue(1);
            }, 100);
          });
        } else {
          // Spring back to original position with smooth animation
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              tension: 50,
              friction: 10,
              useNativeDriver: true,
            }),
            Animated.spring(opacity, {
              toValue: 1,
              tension: 50,
              friction: 10,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  /**
   * Get grouped reactions (emoji -> count)
   */
  const getGroupedReactions = () => {
    const grouped = {};
    Object.entries(reactions).forEach(([userId, userReactions]) => {
      // userReactions is now an object: { '😂': 2, '❤️': 1 }
      if (typeof userReactions === 'object') {
        Object.entries(userReactions).forEach(([emoji, count]) => {
          if (!grouped[emoji]) {
            grouped[emoji] = 0;
          }
          grouped[emoji] += count;
        });
      }
    });
    return grouped;
  };

  /**
   * Get current user's reaction counts
   */
  const getUserReactionCount = (emoji) => {
    if (!currentUserId || !reactions[currentUserId]) return 0;
    return reactions[currentUserId][emoji] || 0;
  };

  /**
   * Handle emoji button press
   */
  const handleEmojiPress = (emoji) => {
    reactionHaptic();
    const currentCount = getUserReactionCount(emoji);
    onReactionToggle(emoji, currentCount);

    // If not frozen yet, freeze the current sorted order
    if (!frozenOrder) {
      const emojiData = REACTION_EMOJIS.map((emoji) => ({
        emoji,
        totalCount: groupedReactions[emoji] || 0,
      }));
      const currentSortedOrder = [...emojiData]
        .sort((a, b) => b.totalCount - a.totalCount)
        .map(item => item.emoji);
      setFrozenOrder(currentSortedOrder);
    }

    // Clear existing timer
    if (sortTimerRef.current) {
      clearTimeout(sortTimerRef.current);
    }

    // Set new timer to unfreeze and allow re-sorting after 1.5 seconds of no taps
    sortTimerRef.current = setTimeout(() => {
      setFrozenOrder(null);
    }, 1500);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (sortTimerRef.current) {
        clearTimeout(sortTimerRef.current);
      }
    };
  }, []);

  const groupedReactions = getGroupedReactions();

  if (!photo) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.container, { opacity }]} {...panResponder.panHandlers}>
        <StatusBar barStyle="light-content" />

        {/* Animated content wrapper */}
        <Animated.View
          style={[
            styles.contentWrapper,
            {
              transform: [{ translateY }]
            }
          ]}
        >
          {/* Header with close button */}
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Photo */}
          <View style={styles.photoScrollView}>
            <Image
              source={{ uri: imageURL }}
              style={styles.photo}
              resizeMode="cover"
            />
          </View>

          {/* Profile photo - overlapping top left of photo */}
          <View style={styles.profilePicContainer}>
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
        </View>

        {/* User info - bottom left of photo */}
        <View style={styles.userInfoOverlay}>
          <Text style={styles.displayName} numberOfLines={1}>
            {displayName || 'Unknown User'}
          </Text>
          <Text style={styles.timestamp}>{getTimeAgo(capturedAt)}</Text>
        </View>

        {/* Footer - Tappable Emoji Pills */}
        <View style={styles.footer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.emojiPickerContainer}
          >
            {(() => {
              // If frozen, use the frozen order; otherwise sort by count
              let orderedEmojis;
              if (frozenOrder) {
                // Use frozen order (maintains position during rapid tapping)
                orderedEmojis = frozenOrder;
              } else {
                // Sort by count (highest to lowest)
                const emojiData = REACTION_EMOJIS.map((emoji) => ({
                  emoji,
                  totalCount: groupedReactions[emoji] || 0,
                }));
                orderedEmojis = [...emojiData]
                  .sort((a, b) => b.totalCount - a.totalCount)
                  .map(item => item.emoji);
              }

              return orderedEmojis.map((emoji) => {
                const totalCount = groupedReactions[emoji] || 0;
                const userCount = getUserReactionCount(emoji);
                const isSelected = userCount > 0;

                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.emojiPill,
                      isSelected && styles.emojiPillSelected,
                    ]}
                    onPress={() => handleEmojiPress(emoji)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.emojiPillEmoji}>{emoji}</Text>
                    {totalCount > 0 && (
                      <Text style={styles.emojiPillCount}>{totalCount}</Text>
                    )}
                  </TouchableOpacity>
                );
              });
            })()}
          </ScrollView>
        </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  contentWrapper: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: (StatusBar.currentHeight || 44) + 10,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  headerSpacer: {
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  photoScrollView: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    marginHorizontal: 8,
    marginBottom: 8,
  },
  photoContentContainer: {
    flex: 1,
  },
  photo: {
    width: SCREEN_WIDTH - 16,
    height: '100%',
    minHeight: SCREEN_HEIGHT * 0.7,
  },
  profilePicContainer: {
    position: 'absolute',
    top: (StatusBar.currentHeight || 44) + 14,
    left: 24,
    zIndex: 5,
  },
  profilePic: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: .5,
    borderColor: '#ffffff57',
  },
  profilePicPlaceholder: {
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#CCCCCC',
  },
  userInfoOverlay: {
    position: 'absolute',
    bottom: 108,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  timestamp: {
    fontSize: 14,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  emojiPickerContainer: {
    gap: 12,
    paddingVertical: 4,
  },
  emojiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A3A3A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#555555',
  },
  emojiPillSelected: {
    // No visual change for selected state
  },
  emojiPillEmoji: {
    fontSize: 20,
  },
  emojiPillCount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default PhotoDetailModal;
