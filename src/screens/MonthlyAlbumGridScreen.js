import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import PixelIcon from '../components/PixelIcon';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { layout } from '../constants/layout';
import { useAuth } from '../context/AuthContext';
import { getMonthPhotos } from '../services/firebase/monthlyAlbumService';
import { AlbumPhotoViewer } from '../components';
import logger from '../utils/logger';

const HEADER_HEIGHT = Platform.OS === 'android' ? 80 : 64;
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_WIDTH = (SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const CELL_HEIGHT = CELL_WIDTH * (4 / 3); // 3:4 portrait ratio

// Row heights for getItemLayout optimization
const DAY_HEADER_HEIGHT = 38; // paddingVertical 12 * 2 + fontSize 14
const PHOTO_ROW_HEIGHT = CELL_HEIGHT + GRID_GAP;

/**
 * MonthlyAlbumGridScreen - Read-only grid view for monthly album photos
 *
 * Displays photos grouped by day with section headers.
 * No editing options - purely for viewing.
 *
 * Route params:
 * - month: YYYY-MM format (e.g., "2026-01")
 * - userId: User ID to fetch photos for
 */
const MonthlyAlbumGridScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { month, userId } = route.params || {};

  // Determine if viewing own profile
  const isOwnProfile = user?.uid === userId;

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [viewerSourceRect, setViewerSourceRect] = useState(null);

  // Refs for measuring photo cell positions (expand/collapse animation)
  const cellRefs = useRef({});

  // Format month for header display: "January 2026"
  const formattedMonthTitle = useMemo(() => {
    if (!month) return 'Monthly Album';
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [month]);

  // Fetch photos function (can be called for refresh)
  const fetchPhotos = useCallback(async () => {
    if (!month || !userId) {
      logger.error('MonthlyAlbumGridScreen: Missing month or userId', { month, userId });
      setLoading(false);
      return;
    }

    try {
      const result = await getMonthPhotos(userId, month);
      if (result.success) {
        setPhotos(result.photos);
        // Clamp viewerInitialIndex to new bounds to prevent out-of-bounds scroll
        // if the viewer reopens (or is still open) with a stale index after deletion.
        if (result.photos.length > 0) {
          setViewerInitialIndex(prev => Math.min(prev, result.photos.length - 1));
        }
        logger.info('MonthlyAlbumGridScreen: Fetched photos', {
          month,
          count: result.photos.length,
        });
      } else {
        logger.error('MonthlyAlbumGridScreen: Failed to fetch photos', { error: result.error });
      }
    } catch (error) {
      logger.error('MonthlyAlbumGridScreen: Error fetching photos', { error: error.message });
    } finally {
      setLoading(false);
    }
  }, [month, userId]);

  // Fetch photos on mount
  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  // Handle photo state change (archive/restore/delete) - refresh the album.
  // If deletedPhotoId is provided (deletion case), optimistically remove the photo
  // from local state immediately so the grid doesn't show stale data while
  // fetchPhotos is in flight. This closes the race window where the user could
  // tap the deleted photo's cell and open the viewer with a stale photos array.
  const handlePhotoStateChanged = useCallback(
    deletedPhotoId => {
      logger.info('MonthlyAlbumGridScreen: Photo state changed, refreshing');
      if (deletedPhotoId) {
        setPhotos(prev => prev.filter(p => p.id !== deletedPhotoId));
      }
      fetchPhotos();
    },
    [fetchPhotos]
  );

  // Format day header: "Monday, January 15"
  const formatDayHeader = capturedAt => {
    if (!capturedAt) return 'Unknown Date';
    const date = capturedAt.toDate ? capturedAt.toDate() : new Date(capturedAt.seconds * 1000);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  // Get day key for grouping: "YYYY-MM-DD"
  const getDayKey = capturedAt => {
    if (!capturedAt) return 'unknown';
    const date = capturedAt.toDate ? capturedAt.toDate() : new Date(capturedAt.seconds * 1000);
    try {
      return date.toISOString().split('T')[0];
    } catch {
      return 'unknown';
    }
  };

  // Build flat list data with day headers interspersed
  const gridData = useMemo(() => {
    if (photos.length === 0) return [];

    const result = [];
    let currentDayKey = null;

    photos.forEach((photo, index) => {
      const dayKey = getDayKey(photo.capturedAt);

      // Add day header when day changes
      if (dayKey !== currentDayKey) {
        currentDayKey = dayKey;
        result.push({
          type: 'dayHeader',
          key: `header-${dayKey}`,
          title: formatDayHeader(photo.capturedAt),
        });
      }

      result.push({
        type: 'photo',
        key: photo.id,
        photo,
        photoIndex: index, // Original index in photos array for viewer
      });
    });

    return result;
  }, [photos]);

  const handleBackPress = () => {
    logger.info('MonthlyAlbumGridScreen: Back pressed');
    navigation.goBack();
  };

  const handlePhotoPress = photoIndex => {
    logger.info('MonthlyAlbumGridScreen: Photo pressed', { photoIndex });
    const cellRef = cellRefs.current[photoIndex];
    if (cellRef) {
      cellRef.measureInWindow((x, y, width, height) => {
        setViewerSourceRect({ x, y, width, height });
        setViewerInitialIndex(photoIndex);
        setViewerVisible(true);
      });
    } else {
      setViewerSourceRect(null);
      setViewerInitialIndex(photoIndex);
      setViewerVisible(true);
    }
  };

  const renderItem = ({ item }) => {
    if (item.type === 'dayHeader') {
      return (
        <View style={styles.dayHeaderContainer}>
          <Text style={styles.dayHeaderText}>{item.title}</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={styles.photoCell}
        onPress={() => handlePhotoPress(item.photoIndex)}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: item.photo.imageURL, cacheKey: `photo-${item.photo.id}` }}
          style={styles.photoImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="normal"
          recyclingKey={item.key}
          transition={150}
        />
      </TouchableOpacity>
    );
  };

  // Custom render for mixed content (headers span full width, photos in grid)
  // Using numColumns requires all items to be same width, so we handle layout manually
  const renderRow = ({ item }) => {
    if (item.type === 'dayHeader') {
      return (
        <View style={styles.dayHeaderContainer}>
          <Text style={styles.dayHeaderText}>{item.title}</Text>
        </View>
      );
    }

    // Photo item
    return (
      <TouchableOpacity
        style={styles.photoCell}
        onPress={() => handlePhotoPress(item.photoIndex)}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: item.photo.imageURL, cacheKey: `photo-${item.photo.id}` }}
          style={styles.photoImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="normal"
          recyclingKey={item.key}
          transition={150}
        />
      </TouchableOpacity>
    );
  };

  // Group photos into rows of 3 with headers preserved
  const rowData = useMemo(() => {
    const result = [];
    let currentRow = [];

    gridData.forEach(item => {
      if (item.type === 'dayHeader') {
        // Flush current row if it has items
        if (currentRow.length > 0) {
          result.push({ type: 'photoRow', key: `row-${result.length}`, photos: currentRow });
          currentRow = [];
        }
        // Add header as its own row
        result.push(item);
      } else {
        currentRow.push(item);
        if (currentRow.length === NUM_COLUMNS) {
          result.push({ type: 'photoRow', key: `row-${result.length}`, photos: currentRow });
          currentRow = [];
        }
      }
    });

    // Flush remaining photos
    if (currentRow.length > 0) {
      result.push({ type: 'photoRow', key: `row-${result.length}`, photos: currentRow });
    }

    return result;
  }, [gridData]);

  // getItemLayout for FlatList scroll optimization
  // Note: This is an approximation since rows vary (header vs photo row)
  // Using photo row height as default since majority are photo rows
  const getItemLayout = useCallback(
    (data, index) => ({
      length: PHOTO_ROW_HEIGHT,
      offset: PHOTO_ROW_HEIGHT * index,
      index,
    }),
    []
  );

  const renderRowItem = useCallback(
    ({ item }) => {
      if (item.type === 'dayHeader') {
        return (
          <View style={styles.dayHeaderContainer}>
            <Text style={styles.dayHeaderText}>{item.title}</Text>
          </View>
        );
      }

      // Photo row
      return (
        <View style={styles.photoRow}>
          {item.photos.map(photoItem => (
            <TouchableOpacity
              key={photoItem.key}
              ref={r => {
                cellRefs.current[photoItem.photoIndex] = r;
              }}
              style={styles.photoCell}
              onPress={() => handlePhotoPress(photoItem.photoIndex)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: photoItem.photo.imageURL, cacheKey: `photo-${photoItem.photo.id}` }}
                style={styles.photoImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                priority="normal"
                recyclingKey={photoItem.key}
                transition={150}
              />
            </TouchableOpacity>
          ))}
        </View>
      );
    },
    [handlePhotoPress]
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: insets.top + HEADER_HEIGHT }]}>
          <Text style={styles.loadingText}>Loading photos...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Safe area background */}
      <View style={[styles.safeAreaBackground, { height: insets.top }]} />

      {/* Header */}
      <View style={[styles.header, { top: insets.top }]}>
        <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
          <PixelIcon name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {formattedMonthTitle}
          </Text>
          <Text style={styles.photoCount}>
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
          </Text>
        </View>
        {/* No right button - read-only */}
        <View style={styles.headerButton} />
      </View>

      {/* Grid */}
      {photos.length === 0 ? (
        <View style={[styles.emptyContainer, { paddingTop: insets.top + HEADER_HEIGHT }]}>
          <Text style={styles.emptyText}>No photos for this month</Text>
        </View>
      ) : (
        <FlatList
          data={rowData}
          renderItem={renderRowItem}
          keyExtractor={item => item.key}
          contentContainerStyle={[styles.gridContent, { paddingTop: insets.top + HEADER_HEIGHT }]}
          showsVerticalScrollIndicator={false}
          getItemLayout={getItemLayout}
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews={true}
        />
      )}

      {/* Photo Viewer Modal */}
      <AlbumPhotoViewer
        visible={viewerVisible}
        photos={photos}
        initialIndex={viewerInitialIndex}
        albumId=""
        albumName={formattedMonthTitle}
        isOwnProfile={isOwnProfile}
        currentUserId={user?.uid}
        sourceRect={viewerSourceRect}
        onClose={() => {
          setViewerVisible(false);
          setViewerSourceRect(null);
        }}
        onPhotoStateChanged={handlePhotoStateChanged}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  safeAreaBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.readable,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.readable,
  },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerButton: {
    width: layout.dimensions.avatarMedium,
    height: layout.dimensions.avatarMedium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
    textAlign: 'center',
    ...Platform.select({
      android: {
        includeFontPadding: false,
        lineHeight: 26,
      },
    }),
  },
  photoCount: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.readable,
    color: colors.text.secondary,
    marginTop: 2,
  },
  gridContent: {
    paddingBottom: 100, // Tab bar clearance
  },
  dayHeaderContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.primary,
  },
  dayHeaderText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  photoRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  photoCell: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background.tertiary,
  },
});

export default MonthlyAlbumGridScreen;
