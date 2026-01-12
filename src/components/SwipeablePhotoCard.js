import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import logger from '../utils/logger';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * SwipeablePhotoCard - iOS Mail-style swipeable card for photo triage
 *
 * Features:
 * - Left swipe reveals Archive action (gray background, 📦 icon)
 * - Right swipe reveals Journal action (green background, 📖 icon)
 * - Progressive visual feedback during swipe
 * - Threshold-based completion (100px)
 * - Smooth animations with scale effect
 *
 * @param {object} photo - Photo object to display
 * @param {function} onSwipeLeft - Callback when Archive action triggered
 * @param {function} onSwipeRight - Callback when Journal action triggered
 */
const SwipeablePhotoCard = ({ photo, onSwipeLeft, onSwipeRight }) => {
  const swipeableRef = useRef(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    logger.debug('SwipeablePhotoCard: Component mounted', { photoId: photo?.id });
    return () => {
      logger.debug('SwipeablePhotoCard: Component unmounted', { photoId: photo?.id });
    };
  }, [photo?.id]);

  /**
   * Render left action (Archive)
   * Progressive animation: opacity and scale based on swipe progress
   */
  const renderLeftActions = (progress, dragX) => {
    const opacity = dragX.interpolate({
      inputRange: [0, 60],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    const textOpacity = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    const scale = dragX.interpolate({
      inputRange: [0, 100],
      outputRange: [0.5, 1.0],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.actionContainer, styles.leftAction, { opacity }]}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Text style={styles.actionIcon}>📦</Text>
        </Animated.View>
        <Animated.Text style={[styles.actionText, { opacity: textOpacity }]}>
          Archive
        </Animated.Text>
      </Animated.View>
    );
  };

  /**
   * Render right action (Journal)
   * Progressive animation: opacity and scale based on swipe progress
   */
  const renderRightActions = (progress, dragX) => {
    const opacity = dragX.interpolate({
      inputRange: [-60, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    const textOpacity = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1.0, 0.5],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.actionContainer, styles.rightAction, { opacity }]}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Text style={styles.actionIcon}>📖</Text>
        </Animated.View>
        <Animated.Text style={[styles.actionText, { opacity: textOpacity }]}>
          Journal
        </Animated.Text>
      </Animated.View>
    );
  };

  /**
   * Handle swipe completion
   * @param {string} direction - 'left' or 'right'
   */
  const handleSwipeableOpen = (direction) => {
    logger.info('SwipeablePhotoCard: Swipe action triggered', {
      photoId: photo?.id,
      direction,
      action: direction === 'left' ? 'Archive' : 'Journal',
    });

    try {
      if (direction === 'left') {
        onSwipeLeft();
      } else if (direction === 'right') {
        onSwipeRight();
      }
    } catch (error) {
      logger.error('SwipeablePhotoCard: Error handling swipe', {
        photoId: photo?.id,
        direction,
        error: error.message,
      });
    }
  };

  /**
   * Handle swipe begin - scale down photo slightly
   */
  const handleSwipeableWillOpen = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.98,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  /**
   * Handle swipe complete or cancel - reset photo scale
   */
  const handleSwipeableClose = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  if (!photo || !photo.imageURL) {
    logger.warn('SwipeablePhotoCard: Missing photo or imageURL', { photo });
    return null;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={handleSwipeableOpen}
      onSwipeableWillOpen={handleSwipeableWillOpen}
      onSwipeableClose={handleSwipeableClose}
      overshootLeft={false}
      overshootRight={false}
      leftThreshold={100}
      rightThreshold={100}
      friction={2}
    >
      <Animated.View style={[styles.photoCard, { transform: [{ scale: scaleAnim }] }]}>
        <Image
          source={{ uri: photo.imageURL }}
          style={styles.photoImage}
          resizeMode="cover"
          onError={(error) =>
            logger.error('SwipeablePhotoCard: Image load error', {
              photoId: photo.id,
              error: error.nativeEvent.error,
            })
          }
          onLoad={() =>
            logger.debug('SwipeablePhotoCard: Image loaded successfully', {
              photoId: photo.id,
            })
          }
        />
      </Animated.View>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  photoCard: {
    width: SCREEN_WIDTH * 0.9,
    alignSelf: 'center',
    borderRadius: 24,
    backgroundColor: '#2C2C2E',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  photoImage: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  actionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 120,
    borderRadius: 24,
    marginVertical: 24,
  },
  leftAction: {
    backgroundColor: '#8E8E93', // iOS gray
    marginLeft: 24,
  },
  rightAction: {
    backgroundColor: '#34C759', // iOS green
    marginRight: 24,
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SwipeablePhotoCard;
