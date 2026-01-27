/**
 * DarkroomScreen styles
 *
 * Extracted from DarkroomScreen.js as part of three-way separation refactoring.
 * Contains all StyleSheet definitions for the darkroom screen component.
 */

import { StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  // Transparent background for gesture handler so no second background shows during swipe
  gestureRootView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.overlay.light,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.overlay.light,
    borderRadius: 20,
  },
  downChevron: {
    width: 12,
    height: 12,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.text.primary,
    transform: [{ rotate: '45deg' }],
    marginTop: -4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  // Done button disabled state
  doneButtonDisabled: {
    opacity: 0.5,
  },
  // Undo button styles
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.overlay.light,
    borderRadius: 20,
  },
  undoButtonDisabled: {
    opacity: 0.3,
  },
  undoIcon: {
    marginRight: 4,
  },
  undoText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  undoTextDisabled: {
    opacity: 0.5,
  },
  // Placeholder for empty state header to maintain layout balance
  headerRightPlaceholder: {
    width: 70,
    height: 40,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 4,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  photoCardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: colors.background.primary,
    zIndex: 1,
  },
  triageButtonBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 8,
    zIndex: 10,
    elevation: 10,
  },
  archiveButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8E8E93',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  deleteButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.system.iosRed, // iOS red for delete
    justifyContent: 'center',
    alignItems: 'center',
  },
  journalButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.status.ready, // Green for journal/share
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  triageButtonIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginRight: 4,
  },
  deleteButtonIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  archiveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  journalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Inline success state styles
  successContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  successContentArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  successTitleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text.primary,
    textAlign: 'center',
  },
  doneButtonBottom: {
    backgroundColor: colors.system.blue, // iOS blue
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 24,
    alignSelf: 'center',
    marginBottom: 20,
  },
  doneButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
});
