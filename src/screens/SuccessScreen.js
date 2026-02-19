import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { successNotification } from '../utils/haptics';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { spacing } from '../constants/spacing';
import { layout } from '../constants/layout';
import logger from '../utils/logger';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Confetti configuration
const CONFETTI_COUNT = 20;
const CONFETTI_COLORS = [
  colors.status.danger,
  colors.status.ready,
  colors.interactive.primary,
  colors.brand.lime,
];
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
    <Animated.View style={[styles.confettiPiece, { backgroundColor: color }, animatedStyle]} />
  );
};

const SuccessScreen = () => {
  const navigation = useNavigation();
  const confettiGenerated = useRef(false);
  const confettiPieces = useRef([]);
  const buttonScale = useRef(new Animated.Value(1)).current;

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

  const handleReturnToCamera = async () => {
    logger.info('SuccessScreen: User tapped Return to Camera button');

    // Trigger button press animation
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(buttonScale, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Trigger medium impact haptic
    try {
      await successNotification();
      logger.debug('SuccessScreen: Button press haptic triggered');
    } catch (error) {
      logger.warn('SuccessScreen: Haptic failed on button press', error);
    }

    // Navigate back to Camera tab
    logger.info('SuccessScreen: Navigating back to Camera', {
      timestamp: new Date().toISOString(),
    });
    navigation.navigate('MainTabs', { screen: 'Camera' });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Confetti layer */}
      <View style={styles.confettiContainer} pointerEvents="none">
        {confettiPieces.current.map(piece => (
          <ConfettiPiece key={piece.id} index={piece.id} color={piece.color} />
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>All Set!</Text>
        <Text style={styles.subtitle}>Your photos have been organized</Text>

        {/* Return to Camera button */}
        <TouchableOpacity style={styles.button} onPress={handleReturnToCamera} activeOpacity={0.8}>
          <Animated.View style={[styles.buttonInner, { transform: [{ scale: buttonScale }] }]}>
            <Text style={styles.buttonText}>Return to Camera</Text>
          </Animated.View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
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
    fontSize: typography.size.display,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    ...Platform.select({ android: { includeFontPadding: false, lineHeight: 44 } }),
  },
  subtitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
  },
  button: {
    marginTop: spacing.xxxl,
  },
  buttonInner: {
    backgroundColor: colors.interactive.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxxl,
    borderRadius: layout.borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
});

export default SuccessScreen;
