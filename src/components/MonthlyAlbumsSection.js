import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import PixelSpinner from './PixelSpinner';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { getUserPhotosByMonth } from '../services/firebase/monthlyAlbumService';
import YearSection from './YearSection';

/**
 * MonthlyAlbumsSection - Wrapper component for monthly albums organized by year
 *
 * Fetches user photos grouped by month and renders collapsible YearSection
 * components for each year. Current year is expanded by default.
 *
 * @param {string} userId - User ID to fetch photos for
 * @param {function} onMonthPress - Callback (month) => void passed through to YearSection
 */
const MonthlyAlbumsSection = ({ userId, onMonthPress }) => {
  const [loading, setLoading] = useState(true);
  const [yearData, setYearData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const result = await getUserPhotosByMonth(userId);

      if (result.success && result.monthlyData) {
        // Convert object to array sorted by year descending
        // Service returns: { "2026": [...months], "2025": [...months] }
        // Convert to: [{ year: "2026", months: [...] }, { year: "2025", months: [...] }]
        const years = Object.keys(result.monthlyData)
          .sort((a, b) => parseInt(b) - parseInt(a))
          .map(year => ({
            year,
            months: result.monthlyData[year].map(monthData => ({
              month: monthData.month,
              coverPhotoUrl: monthData.coverPhoto?.imageURL || null,
              photoCount: monthData.photoCount,
            })),
          }));

        setYearData(years);
      } else {
        setYearData([]);
      }

      setLoading(false);
    };

    fetchData();
  }, [userId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <PixelSpinner size="small" color={colors.text.secondary} />
      </View>
    );
  }

  // Empty state - render nothing (section doesn't appear)
  if (yearData.length === 0) {
    return null;
  }

  const currentYear = new Date().getFullYear().toString();

  return (
    <View style={styles.container}>
      {yearData.map(({ year, months }) => (
        <YearSection
          key={year}
          year={year}
          months={months}
          initiallyExpanded={year === currentYear}
          onMonthPress={onMonthPress}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.lg,
  },
  loadingContainer: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingVertical: 20,
  },
});

export default MonthlyAlbumsSection;
