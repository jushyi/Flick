/**
 * DarkroomScreen
 *
 * Photo reveal and triage interface. Displays revealed photos in a swipeable card stack
 * and allows users to triage them (archive, journal, or delete).
 *
 * Architecture: Three-way separation
 * - Logic: useDarkroom hook (all state, effects, handlers)
 * - Styles: DarkroomScreen.styles.js (all StyleSheet definitions)
 * - Component: This file (thin render layer with JSX)
 */

import { View, Text, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import useDarkroom from '../hooks/useDarkroom';
import { SwipeablePhotoCard } from '../components';
import { styles } from '../styles/DarkroomScreen.styles';
import logger from '../utils/logger';

const DarkroomScreen = () => {
  const {
    // State
    visiblePhotos,
    loading,
    undoStack,
    undoingPhoto,
    saving,
    currentPhoto,
    newlyVisibleIds,

    // Refs
    cardRef,
    successFadeAnim,
    deleteButtonScale,

    // Handlers
    handleDone,
    handleExitClearance,
    handleArchiveSwipe,
    handleJournalSwipe,
    handleDeleteSwipe,
    handleArchiveButton,
    handleDeleteButton,
    handleJournalButton,
    handleDeletePulse,
    handleUndo,
    handleBackPress,
  } = useDarkroom();

  // Loading state
  if (loading) {
    return (
      <GestureHandlerRootView style={styles.gestureRootView}>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Loading darkroom...</Text>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  // Success state - all photos triaged, waiting for Done tap
  if (visiblePhotos.length === 0 && undoStack.length > 0) {
    return (
      <GestureHandlerRootView style={styles.gestureRootView}>
        <View style={styles.successContainer}>
          <SafeAreaView style={styles.successContainer} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => {
                  logger.info('DarkroomScreen: User tapped back button (success state)');
                  handleBackPress();
                }}
                style={styles.backButton}
              >
                <View style={styles.downChevron} />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>Darkroom</Text>
                <Text style={styles.headerSubtitle}>All done!</Text>
              </View>
              {/* Undo button */}
              <TouchableOpacity
                style={[
                  styles.undoButton,
                  (undoStack.length === 0 || undoingPhoto !== null) && styles.undoButtonDisabled,
                ]}
                onPress={handleUndo}
                disabled={undoStack.length === 0 || undoingPhoto !== null}
              >
                <Ionicons name="arrow-undo" size={16} color="#FFFFFF" style={styles.undoIcon} />
                <Text
                  style={[
                    styles.undoText,
                    (undoStack.length === 0 || undoingPhoto !== null) && styles.undoTextDisabled,
                  ]}
                >
                  Undo
                </Text>
              </TouchableOpacity>
            </View>

            {/* Success content with fade-in animation */}
            <Animated.View style={[styles.successContentArea, { opacity: successFadeAnim }]}>
              <View style={styles.successTitleContainer}>
                <Text style={styles.successTitle}>Hooray!</Text>
              </View>

              {/* Done button at bottom */}
              <TouchableOpacity
                style={[styles.doneButtonBottom, saving && styles.doneButtonDisabled]}
                onPress={handleDone}
                activeOpacity={0.8}
                disabled={saving}
              >
                <Text style={styles.doneButtonText}>{saving ? 'Saving...' : 'Done'}</Text>
              </TouchableOpacity>
            </Animated.View>
          </SafeAreaView>
        </View>
      </GestureHandlerRootView>
    );
  }

  // Empty state - no photos ready
  if (visiblePhotos.length === 0) {
    return (
      <GestureHandlerRootView style={styles.gestureRootView}>
        <View style={styles.container}>
          <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => {
                  logger.info('DarkroomScreen: User tapped back button (empty state)');
                  handleBackPress();
                }}
                style={styles.backButton}
              >
                <View style={styles.downChevron} />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>Darkroom</Text>
                <Text style={styles.headerSubtitle}>No photos ready</Text>
              </View>
              <View style={styles.headerRightPlaceholder} />
            </View>

            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>{'📸'}</Text>
              <Text style={styles.emptyTitle}>No Photos Ready</Text>
              <Text style={styles.emptyText}>
                Photos you take will develop here and be revealed when ready
              </Text>
            </View>
          </SafeAreaView>
        </View>
      </GestureHandlerRootView>
    );
  }

  // Debug log
  logger.debug('DarkroomScreen: Current photo', {
    photoId: currentPhoto?.id,
    hasImageURL: !!currentPhoto?.imageURL,
  });

  // Main triage state
  return (
    <GestureHandlerRootView style={styles.gestureRootView}>
      <View style={styles.container}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => {
                logger.info('DarkroomScreen: User tapped back button');
                handleBackPress();
              }}
              style={styles.backButton}
            >
              <View style={styles.downChevron} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Darkroom</Text>
              <Text style={styles.headerSubtitle}>
                {visiblePhotos.length} {visiblePhotos.length === 1 ? 'photo' : 'photos'} ready to
                review
              </Text>
            </View>
            {/* Undo button */}
            <TouchableOpacity
              style={[
                styles.undoButton,
                (undoStack.length === 0 || undoingPhoto !== null) && styles.undoButtonDisabled,
              ]}
              onPress={handleUndo}
              disabled={undoStack.length === 0 || undoingPhoto !== null}
            >
              <Ionicons name="arrow-undo" size={16} color="#FFFFFF" style={styles.undoIcon} />
              <Text
                style={[
                  styles.undoText,
                  (undoStack.length === 0 || undoingPhoto !== null) && styles.undoTextDisabled,
                ]}
              >
                Undo
              </Text>
            </TouchableOpacity>
          </View>

          {/* Stacked Photo Cards */}
          <View style={styles.photoCardContainer}>
            {visiblePhotos
              .slice(0, 3)
              .reverse()
              .map((photo, reverseIndex) => {
                const stackIndex = 2 - reverseIndex - (3 - Math.min(visiblePhotos.length, 3));
                const isActive = stackIndex === 0;
                const isNewlyVisible = newlyVisibleIds.has(photo.id) && stackIndex === 2;

                return (
                  <SwipeablePhotoCard
                    ref={isActive ? cardRef : undefined}
                    key={photo.id}
                    photo={photo}
                    stackIndex={stackIndex}
                    isActive={isActive}
                    isNewlyVisible={isNewlyVisible}
                    enterFrom={
                      isActive && undoingPhoto?.photo.id === photo.id
                        ? undoingPhoto.enterFrom
                        : null
                    }
                    onSwipeLeft={isActive ? handleArchiveSwipe : undefined}
                    onSwipeRight={isActive ? handleJournalSwipe : undefined}
                    onSwipeDown={isActive ? handleDeleteSwipe : undefined}
                    onDeleteComplete={isActive ? handleDeletePulse : undefined}
                    onExitClearance={isActive ? () => handleExitClearance(photo.id) : undefined}
                  />
                );
              })}
          </View>

          {/* Triage Button Bar */}
          <View style={styles.triageButtonBar}>
            {/* Archive Button */}
            <TouchableOpacity style={styles.archiveButton} onPress={handleArchiveButton}>
              <Text style={styles.triageButtonIcon}>{'☐'}</Text>
              <Text style={styles.archiveButtonText}>Archive</Text>
            </TouchableOpacity>

            {/* Delete Button */}
            <Animated.View style={{ transform: [{ scale: deleteButtonScale }] }}>
              <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteButton}>
                <Text style={styles.deleteButtonIcon}>{'✕'}</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Journal Button */}
            <TouchableOpacity style={styles.journalButton} onPress={handleJournalButton}>
              <Text style={styles.triageButtonIcon}>{'✓'}</Text>
              <Text style={styles.journalButtonText}>Journal</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </GestureHandlerRootView>
  );
};

export default DarkroomScreen;
