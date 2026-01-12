import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import logger from '../utils/logger';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const DarkroomBottomSheet = ({ visible, revealedCount, developingCount, onClose, onComplete }) => {
  const [isPressing, setIsPressing] = useState(false);
  const [hapticTriggered, setHapticTriggered] = useState({
    25: false,
    50: false,
    75: false,
    100: false,
  });
  const progressValue = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef(null);

  const totalCount = (revealedCount || 0) + (developingCount || 0);
  const hasRevealedPhotos = revealedCount > 0;

  useEffect(() => {
    if (visible) {
      logger.debug('DarkroomBottomSheet: Component mounted', {
        revealedCount,
        developingCount,
        totalCount,
        hasRevealedPhotos,
      });
    }

    return () => {
      // Clean up animation on unmount
      if (progressAnimation.current) {
        progressAnimation.current.stop();
        logger.debug('DarkroomBottomSheet: Component unmounted, animation stopped');
      }
    };
  }, [visible, revealedCount, developingCount, totalCount, hasRevealedPhotos]);

  useEffect(() => {
    // Reset progress when modal visibility changes
    if (!visible) {
      progressValue.setValue(0);
      setIsPressing(false);
      setHapticTriggered({ 25: false, 50: false, 75: false, 100: false });
    }
  }, [visible, progressValue]);

  // Haptic feedback listener
  useEffect(() => {
    const listener = progressValue.addListener(({ value }) => {
      // Trigger haptics at milestones
      if (value >= 0.25 && !hapticTriggered[25]) {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setHapticTriggered(prev => ({ ...prev, 25: true }));
          logger.debug('DarkroomBottomSheet: Haptic at 25%');
        } catch (error) {
          logger.debug('DarkroomBottomSheet: Haptic failed at 25%', error);
        }
      }
      if (value >= 0.50 && !hapticTriggered[50]) {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setHapticTriggered(prev => ({ ...prev, 50: true }));
          logger.debug('DarkroomBottomSheet: Haptic at 50%');
        } catch (error) {
          logger.debug('DarkroomBottomSheet: Haptic failed at 50%', error);
        }
      }
      if (value >= 0.75 && !hapticTriggered[75]) {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setHapticTriggered(prev => ({ ...prev, 75: true }));
          logger.debug('DarkroomBottomSheet: Haptic at 75%');
        } catch (error) {
          logger.debug('DarkroomBottomSheet: Haptic failed at 75%', error);
        }
      }
      if (value >= 1.0 && !hapticTriggered[100]) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setHapticTriggered(prev => ({ ...prev, 100: true }));
          logger.info('DarkroomBottomSheet: Haptic at 100% (completion)');
        } catch (error) {
          logger.debug('DarkroomBottomSheet: Haptic failed at 100%', error);
        }
      }
    });

    return () => progressValue.removeListener(listener);
  }, [progressValue, hapticTriggered]);

  const handlePressIn = () => {
    if (!visible || !hasRevealedPhotos) {
      logger.debug('DarkroomBottomSheet: Press-and-hold blocked (no revealed photos)', {
        hasRevealedPhotos,
        revealedCount,
        developingCount,
      });
      return;
    }

    setIsPressing(true);
    setHapticTriggered({ 25: false, 50: false, 75: false, 100: false });
    logger.info('DarkroomBottomSheet: Press-and-hold started', { revealedCount, developingCount });

    // Animate from 0 to 1 over 2 seconds
    progressAnimation.current = Animated.timing(progressValue, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
    });

    progressAnimation.current.start(({ finished }) => {
      if (finished) {
        logger.debug('DarkroomBottomSheet: Progress reached 100%');
        logger.info('DarkroomBottomSheet: Press-and-hold completed', { revealedCount, developingCount });

        // Small delay to let user see full bar
        setTimeout(() => {
          // Reset state
          setIsPressing(false);
          progressValue.setValue(0);

          // Trigger completion callback
          if (onComplete) {
            onComplete();
          }
        }, 200);
      }
    });
  };

  const handlePressOut = () => {
    if (!isPressing) return;

    logger.debug('DarkroomBottomSheet: Press released before completion');

    // Stop current animation
    if (progressAnimation.current) {
      progressAnimation.current.stop();
    }

    // Spring back to 0
    Animated.spring(progressValue, {
      toValue: 0,
      tension: 50,
      friction: 7,
      useNativeDriver: false,
    }).start();

    setIsPressing(false);
  };

  const handleBackdropPress = () => {
    logger.debug('DarkroomBottomSheet: Backdrop pressed, closing');
    if (onClose) {
      onClose();
    }
  };

  // Interpolate progress value to width percentage
  const progressWidth = progressValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleBackdropPress}
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleBackdropPress}
        />

        {/* Bottom Sheet */}
        <View style={styles.sheet}>
          {/* Header */}
          <Text style={styles.headerText}>
            {hasRevealedPhotos ? 'Press and hold to reveal' : 'Darkroom'}
          </Text>

          {/* Badge Count Display */}
          <View style={styles.countContainer}>
            <Text style={styles.countNumber}>{hasRevealedPhotos ? revealedCount : totalCount}</Text>
            <Text style={styles.countLabel}>
              {hasRevealedPhotos
                ? revealedCount === 1
                  ? 'photo ready'
                  : 'photos ready'
                : totalCount === 1
                ? 'photo developing'
                : 'photos developing'}
            </Text>
          </View>

          {/* Progress Bar Container - only show if photos are ready */}
          {hasRevealedPhotos && (
            <View
              style={styles.progressContainer}
              onStartShouldSetResponder={() => true}
              onResponderGrant={handlePressIn}
              onResponderRelease={handlePressOut}
            >
              <View style={styles.progressBackground}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: progressWidth,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {isPressing ? 'Hold...' : 'Tap and hold'}
              </Text>
            </View>
          )}

          {/* Message for developing photos */}
          {!hasRevealedPhotos && (
            <Text style={styles.developingText}>
              Photos are still developing...{'\n'}Check back soon!
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 24,
  },
  countContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  countNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  countLabel: {
    fontSize: 16,
    color: '#666666',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBackground: {
    width: '100%',
    height: 12,
    backgroundColor: '#E5E5E5',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
    color: '#999999',
    fontWeight: '600',
  },
  developingText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 8,
  },
});

export default DarkroomBottomSheet;
