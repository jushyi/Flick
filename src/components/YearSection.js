import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import MonthlyAlbumCard from './MonthlyAlbumCard';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * YearSection - Collapsible year section with animated month cards
 *
 * Displays a year header with a rotating chevron that expands/collapses
 * to show/hide MonthlyAlbumCard components for each month.
 *
 * @param {string} year - Year string (e.g., "2026")
 * @param {Array} months - Array of month data: [{ month: "2026-01", coverPhotoUrl: string, photoCount: number }, ...]
 * @param {boolean} initiallyExpanded - True for current year, false for older years
 * @param {function} onMonthPress - Callback (month) => void when a month card is tapped
 */
const YearSection = ({ year, months, initiallyExpanded = false, onMonthPress }) => {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const rotationAnim = useRef(new Animated.Value(initiallyExpanded ? 1 : 0)).current;

  // Animate chevron rotation when expanded state changes
  useEffect(() => {
    Animated.timing(rotationAnim, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [expanded, rotationAnim]);

  const handleToggle = () => {
    // Configure layout animation for smooth height transition
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  // Interpolate rotation: 0 = collapsed (pointing right), 1 = expanded (pointing down)
  const chevronRotation = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.container}>
      {/* Year Header */}
      <TouchableOpacity style={styles.header} onPress={handleToggle} activeOpacity={0.7}>
        <Text style={styles.yearText}>{year}</Text>
        <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
          <Ionicons name="chevron-down" size={24} color={colors.text.primary} />
        </Animated.View>
      </TouchableOpacity>

      {/* Month Cards - Only rendered when expanded */}
      {expanded && (
        <View style={styles.monthsContainer}>
          {months.map((monthData, index) => (
            <View key={monthData.month} style={index > 0 ? styles.monthCardSpacing : null}>
              <MonthlyAlbumCard
                month={monthData.month}
                coverPhotoUrl={monthData.coverPhotoUrl}
                onPress={() => onMonthPress?.(monthData.month)}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  yearText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  monthsContainer: {
    paddingHorizontal: 16,
  },
  monthCardSpacing: {
    marginTop: 12,
  },
});

export default YearSection;
