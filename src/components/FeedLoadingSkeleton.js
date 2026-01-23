import React from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Loading skeleton for feed photo cards
 * Displays animated placeholder while photos load
 */
const FeedLoadingSkeleton = ({ count = 3 }) => {
  const animatedValue = new Animated.Value(0);

  // Pulse animation for skeleton
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const renderSkeletonCard = index => (
    <View key={index} style={styles.card}>
      {/* Profile section */}
      <View style={styles.profileSection}>
        <Animated.View style={[styles.profilePic, { opacity }]} />
        <View style={styles.profileInfo}>
          <Animated.View style={[styles.username, { opacity }]} />
          <Animated.View style={[styles.timestamp, { opacity }]} />
        </View>
      </View>

      {/* Photo placeholder */}
      <Animated.View style={[styles.photo, { opacity }]} />

      {/* Reaction bar */}
      <View style={styles.reactionBar}>
        <Animated.View style={[styles.reactionItem, { opacity }]} />
        <Animated.View style={[styles.reactionItem, { opacity }]} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => renderSkeletonCard(index))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  profilePic: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
  },
  username: {
    width: 120,
    height: 14,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 6,
  },
  timestamp: {
    width: 60,
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
  },
  photo: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_WIDTH - 32,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 16,
    borderRadius: 8,
  },
  reactionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  reactionItem: {
    width: 40,
    height: 16,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginRight: 12,
  },
});

export default FeedLoadingSkeleton;
