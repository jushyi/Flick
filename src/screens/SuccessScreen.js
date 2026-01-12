import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { successNotification } from '../utils/haptics';
import logger from '../utils/logger';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Confetti configuration
const CONFETTI_COUNT = 20;
const CONFETTI_COLORS = ['#FF3B30', '#34C759', '#007AFF', '#FFCC00'];
const ANIMATION_DURATION = 2000;
const MAX_STAGGER_DELAY = 500;

const ConfettiPiece = ({ index, color }) => {
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(Math.random() * SCREEN_WIDTH)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const staggerDelay = Math.random() * MAX_STAGGER_DELAY;

    // Animate Y position (fall down) and rotation together
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT + 50,
        duration: ANIMATION_DURATION,
        delay: staggerDelay,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(rotation, {
        toValue: 360,
        duration: ANIMATION_DURATION,
        delay: staggerDelay,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();

    logger.debug('SuccessScreen: Confetti piece animated', { index, staggerDelay });
  }, []);

  const animatedStyle = {
    transform: [
      { translateX },
      { translateY },
      {
        rotate: rotation.interpolate({
          inputRange: [0, 360],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  };

  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        { backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
};

const SuccessScreen = () => {
  const confettiGenerated = useRef(false);
  const confettiPieces = useRef([]);

  // Generate confetti pieces once
  if (!confettiGenerated.current) {
    confettiPieces.current = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    }));
    confettiGenerated.current = true;
  }

  useEffect(() => {
    logger.debug('SuccessScreen: Component mounted');

    // Trigger success haptic feedback
    try {
      successNotification();
      logger.info('SuccessScreen: Success haptic triggered');
    } catch (error) {
      logger.warn('SuccessScreen: Haptic failed', error);
    }

    // Log animation start
    logger.info('SuccessScreen: Confetti animation started', {
      timestamp: new Date().toISOString(),
      pieceCount: CONFETTI_COUNT,
    });

    // Log animation complete after duration
    const timer = setTimeout(() => {
      logger.debug('SuccessScreen: Confetti animation completed', {
        duration: ANIMATION_DURATION,
      });
    }, ANIMATION_DURATION + MAX_STAGGER_DELAY);

    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Confetti layer */}
      <View style={styles.confettiContainer} pointerEvents="none">
        {confettiPieces.current.map((piece) => (
          <ConfettiPiece
            key={piece.id}
            index={piece.id}
            color={piece.color}
          />
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>All Set!</Text>
        <Text style={styles.subtitle}>Your photos have been organized</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  confettiPiece: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#CCCCCC',
  },
});

export default SuccessScreen;
