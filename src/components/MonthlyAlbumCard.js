import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { colors } from '../constants/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH - 32; // 16px margins on each side
const CARD_HEIGHT = CARD_WIDTH; // Square aspect ratio

/**
 * Convert YYYY-MM format to display name (e.g., "January")
 * @param {string} monthStr - Month string in YYYY-MM format
 * @returns {string} - Full month name
 */
const getMonthDisplayName = monthStr => {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleString('default', { month: 'long' });
};

/**
 * MonthlyAlbumCard - Full-width card for monthly album display
 *
 * @param {string} month - Month string in YYYY-MM format
 * @param {string} coverPhotoUrl - URL for cover image
 * @param {function} onPress - Callback when card is tapped
 */
const MonthlyAlbumCard = ({ month, coverPhotoUrl, onPress }) => {
  const monthName = getMonthDisplayName(month);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      {coverPhotoUrl ? (
        <Image source={{ uri: coverPhotoUrl }} style={styles.coverImage} />
      ) : (
        <View style={styles.placeholder} />
      )}
      <View style={styles.overlay}>
        <Text style={styles.monthText}>{monthName}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.background.tertiary,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background.tertiary,
  },
  overlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
  },
  monthText: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});

export default MonthlyAlbumCard;
