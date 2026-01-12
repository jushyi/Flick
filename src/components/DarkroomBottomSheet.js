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
import logger from '../utils/logger';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const DarkroomBottomSheet = ({ visible, count, onClose, onComplete }) => {
  const [isPressing, setIsPressing] = useState(false);
  const progressValue = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef(null);

  useEffect(() => {
    if (visible) {
      logger.debug('DarkroomBottomSheet: Component mounted', { count });
    }

    return () => {
      // Clean up animation on unmount
      if (progressAnimation.current) {
        progressAnimation.current.stop();
        logger.debug('DarkroomBottomSheet: Component unmounted, animation stopped');
      }
    };
  }, [visible, count]);

  useEffect(() => {
    // Reset progress when modal visibility changes
    if (!visible) {
      progressValue.setValue(0);
      setIsPressing(false);
    }
  }, [visible, progressValue]);

  const handlePressIn = () => {
    if (!visible || count === 0) return;

    setIsPressing(true);
    logger.info('DarkroomBottomSheet: Press-and-hold started', { count });

    // Animate from 0 to 1 over 2 seconds
    progressAnimation.current = Animated.timing(progressValue, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
    });

    progressAnimation.current.start(({ finished }) => {
      if (finished) {
        logger.debug('DarkroomBottomSheet: Progress reached 100%');
        logger.info('DarkroomBottomSheet: Press-and-hold completed', { count });

        // Reset state
        setIsPressing(false);
        progressValue.setValue(0);

        // Trigger completion callback
        if (onComplete) {
          onComplete();
        }
      }
    });

    // Log progress milestones
    progressValue.addListener(({ value }) => {
      const percentage = Math.round(value * 100);
      if (percentage === 25 || percentage === 50 || percentage === 75) {
        logger.debug('DarkroomBottomSheet: Progress milestone', { percentage });
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
          <Text style={styles.headerText}>Press and hold to reveal</Text>

          {/* Badge Count Display */}
          <View style={styles.countContainer}>
            <Text style={styles.countNumber}>{count}</Text>
            <Text style={styles.countLabel}>
              {count === 1 ? 'photo ready' : 'photos ready'}
            </Text>
          </View>

          {/* Progress Bar Container */}
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
});

export default DarkroomBottomSheet;
