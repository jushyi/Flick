import { StyleSheet, Dimensions } from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GAP = 2;
const CELL_SIZE = (SCREEN_WIDTH - GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  safeHeader: {
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  headerButton: {
    minWidth: 60,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 2,
  },
  selectButtonText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.system.blue,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.secondary,
  },
  emptySubtext: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.body,
    color: colors.text.tertiary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  gridContent: {
    paddingTop: GAP,
    paddingHorizontal: GAP,
  },
  photoCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    margin: GAP / 2,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background.tertiary,
  },
  countdownOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: colors.overlay.dark,
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countdownText: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: 6,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 9999,
    backgroundColor: colors.system.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 16,
    backgroundColor: colors.background.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 2,
  },
  restoreButton: {
    backgroundColor: colors.system.blue,
  },
  deleteButton: {
    backgroundColor: colors.status.danger,
  },
  actionButtonText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
    marginLeft: 8,
  },
  // Full-screen viewer styles
  viewerContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  viewerHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.overlay.dark,
  },
  viewerCloseButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  viewerDaysBadge: {
    backgroundColor: colors.overlay.light,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  viewerDaysText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
  },
  viewerImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerPhotoContainer: {
    width: SCREEN_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  viewerPositionText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 4,
  },
  viewerFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: colors.overlay.dark,
  },
  viewerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 2,
  },
  viewerRestoreButton: {
    backgroundColor: colors.system.blue,
  },
  viewerDeleteButton: {
    backgroundColor: colors.status.danger,
  },
  viewerButtonText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bodyBold,
    color: colors.text.primary,
    marginLeft: 8,
  },
});

export const CELL_SIZE_EXPORT = CELL_SIZE;
export const NUM_COLUMNS_EXPORT = NUM_COLUMNS;
export const GAP_EXPORT = GAP;
