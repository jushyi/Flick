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

import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import PixelIcon from '../components/PixelIcon';
import PixelSpinner from '../components/PixelSpinner';
import useDarkroom from '../hooks/useDarkroom';
import { SwipeablePhotoCard, TagFriendsModal } from '../components';
import { useScreenTrace } from '../hooks/useScreenTrace';
import { styles } from '../styles/DarkroomScreen.styles';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import logger from '../utils/logger';

const DarkroomScreen = () => {
  // Screen load trace - measures time from mount to data-ready
  const { markLoaded } = useScreenTrace('DarkroomScreen');
  const screenTraceMarkedRef = useRef(false);
  const insets = useSafeAreaInsets();

  const {
    // State
    visiblePhotos,
    loading,
    pendingSuccess,
    undoStack,
    undoingPhoto,
    saving,
    currentPhoto,
    newlyVisibleIds,

    // Refs
    cardRef,
    successFadeAnim,
    deleteButtonScale,

    // Tagging state
    tagModalVisible,

    // Caption state
    getCaptionForPhoto,
    handleCaptionChange,
    keyboardVisible,

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
    handleTagFriends,
    getTagsForPhoto,
    handleOpenTagModal,
    handleCloseTagModal,
  } = useDarkroom();

  // Mark screen trace as loaded after darkroom photos load (once only)
  useEffect(() => {
    if (!loading && !screenTraceMarkedRef.current) {
      screenTraceMarkedRef.current = true;
      markLoaded();
    }
  }, [loading]);

  // Loading state
  if (loading) {
    return (
      <GestureHandlerRootView style={styles.gestureRootView}>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <PixelSpinner size="large" color={colors.icon.primary} />
            <Text style={styles.loadingText}>Loading darkroom...</Text>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  // Success state - all photos triaged, waiting for Done tap.
  // Also show when pendingSuccess=true (last card exited but triage callback not yet fired)
  // so there's no blank-state flash between clearance (150ms) and triage completion (350ms).
  if (visiblePhotos.length === 0 && (undoStack.length > 0 || pendingSuccess)) {
    return (
      <GestureHandlerRootView style={styles.gestureRootView}>
        <View style={styles.successContainer}>
          <View style={[styles.statusBarCover, { height: insets.top }]} />
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
                <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>
                  Darkroom
                </Text>
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
                <PixelIcon
                  name="arrow-undo"
                  size={16}
                  color={colors.icon.primary}
                  style={styles.undoIcon}
                />
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

  // Empty state - blank to avoid flash before success screen
  if (visiblePhotos.length === 0 && !pendingSuccess) {
    return (
      <GestureHandlerRootView style={styles.gestureRootView}>
        <View style={styles.container} />
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
        {/* Opaque cover behind status bar to prevent cards showing through */}
        <View style={[styles.statusBarCover, { height: insets.top }]} />
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
              <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>
                Darkroom
              </Text>
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
              <PixelIcon
                name="arrow-undo"
                size={16}
                color={colors.icon.primary}
                style={styles.undoIcon}
              />
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

          {/* KeyboardAvoidingView shifts cards up when caption input is focused */}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.select({ ios: 'padding', android: 'height' })}
            keyboardVerticalOffset={Platform.select({ ios: 0, android: insets.top + 60 })}
          >
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
                      onTagPress={isActive ? handleOpenTagModal : undefined}
                      hasTagged={isActive ? getTagsForPhoto(photo.id).length > 0 : false}
                      caption={isActive ? getCaptionForPhoto(photo.id) : undefined}
                      onCaptionChange={
                        isActive ? text => handleCaptionChange(photo.id, text) : undefined
                      }
                      keyboardVisible={isActive ? keyboardVisible : undefined}
                    />
                  );
                })}
            </View>

            {/* Triage Button Bar */}
            <View style={styles.triageButtonBar}>
              {/* Archive Button */}
              <TouchableOpacity style={styles.archiveButton} onPress={handleArchiveButton}>
                <PixelIcon
                  name="archive-outline"
                  size={18}
                  color={colors.text.primary}
                  style={{ marginRight: spacing.xxs }}
                />
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
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>

      {/* Tag Friends Modal */}
      <TagFriendsModal
        visible={tagModalVisible}
        onClose={handleCloseTagModal}
        onConfirm={ids => {
          handleTagFriends(currentPhoto?.id, ids);
          handleCloseTagModal();
        }}
        initialSelectedIds={getTagsForPhoto(currentPhoto?.id)}
      />
    </GestureHandlerRootView>
  );
};

export default DarkroomScreen;
