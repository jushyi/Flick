import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Animated,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';

import Svg, { Path } from 'react-native-svg';
import { colors } from '../constants/colors';

import useCamera, {
  BASE_ROTATION_PER_CARD,
  BASE_OFFSET_PER_CARD,
  SPREAD_ROTATION_MULTIPLIER,
  SPREAD_OFFSET_MULTIPLIER,
} from '../hooks/useCamera';
import { styles } from '../styles/CameraScreen.styles';
import { DarkroomBottomSheet } from '../components';
import { lightImpact } from '../utils/haptics';
import logger from '../utils/logger';

// Flash icon SVG component - matches bottom nav design system
const FlashIcon = ({ color = '#FFFFFF', mode = 'off' }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Path
      d="M13 2L4.09 12.35a1 1 0 0 0 .77 1.65H11v6a1 1 0 0 0 1.84.54l8.91-10.35a1 1 0 0 0-.77-1.65H13V2z"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={mode === 'on' ? color : 'none'}
    />
  </Svg>
);

// Flip camera icon SVG component - clean rotation arrows design
const FlipCameraIcon = ({ color = '#FFFFFF' }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* Top arrow - curves right and down */}
    <Path
      d="M17 1l4 4-4 4"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M3 11V9a4 4 0 0 1 4-4h14"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Bottom arrow - curves left and up */}
    <Path
      d="M7 23l-4-4 4-4"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M21 13v2a4 4 0 0 1-4 4H3"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// DarkroomCardButton Component - photo card stack design with capture animation
const DarkroomCardButton = ({ count, onPress, scaleAnim, fanSpreadAnim, hasRevealedPhotos }) => {
  const isDisabled = count === 0;

  // Get gradient colors based on state
  const gradientColors = hasRevealedPhotos
    ? colors.brand.gradient.revealed // Pink-heavy when ready
    : colors.brand.gradient.developing; // Purple-heavy when developing

  // Determine number of cards to show (1-4 max)
  const cardCount = Math.min(Math.max(count, 1), 4);

  const handlePress = () => {
    if (onPress) {
      logger.info('DarkroomCardButton: Opening bottom sheet', { count });
      onPress();
    }
  };

  // Render stack of cards with animated transforms
  const renderCards = () => {
    const cards = [];

    // Calculate center compensation - shifts entire stack left so it stays visually centered
    // The more cards, the more we need to shift left to compensate for right-fanning
    const centerCompensation = ((cardCount - 1) * BASE_OFFSET_PER_CARD) / 2;
    const rotationCompensation = ((cardCount - 1) * BASE_ROTATION_PER_CARD) / 2;

    for (let i = 0; i < cardCount; i++) {
      const isTopCard = i === cardCount - 1;

      // Calculate position from top (0 = top, higher = further back)
      const positionFromTop = cardCount - 1 - i;

      // Base rotation and offset (at rest)
      // Back cards fan RIGHT, but we subtract compensation to keep stack centered
      const baseRotation = positionFromTop * BASE_ROTATION_PER_CARD - rotationCompensation;
      const baseOffset = positionFromTop * BASE_OFFSET_PER_CARD - centerCompensation;

      // Single card has no fanning
      if (cardCount === 1) {
        cards.push(
          <Animated.View
            key={i}
            style={[
              styles.darkroomCardWrapper,
              {
                position: 'absolute',
                transform: scaleAnim ? [{ scale: scaleAnim }] : [],
                zIndex: 1,
              },
            ]}
          >
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.darkroomCardGradient}
            >
              <Text style={styles.darkroomCardText}>{count > 99 ? '99+' : count}</Text>
            </LinearGradient>
          </Animated.View>
        );
        continue;
      }

      // Animated rotation interpolation: base + (spread * multiplier)
      const animatedRotation = fanSpreadAnim
        ? fanSpreadAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [`${baseRotation}deg`, `${baseRotation * SPREAD_ROTATION_MULTIPLIER}deg`],
          })
        : `${baseRotation}deg`;

      // Animated offset interpolation
      const animatedOffset = fanSpreadAnim
        ? fanSpreadAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [baseOffset, baseOffset * SPREAD_OFFSET_MULTIPLIER],
          })
        : baseOffset;

      // Animated Y offset - cards move up during spread
      const animatedTranslateY = fanSpreadAnim
        ? fanSpreadAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -positionFromTop * 4], // Cards rise upward during animation
          })
        : 0;

      cards.push(
        <Animated.View
          key={i}
          style={[
            styles.darkroomCardWrapper,
            {
              position: 'absolute',
              transform: [
                { rotate: animatedRotation },
                { translateX: animatedOffset },
                { translateY: animatedTranslateY },
                ...(scaleAnim ? [{ scale: scaleAnim }] : []),
              ],
              zIndex: i + 1, // Higher index = on top
            },
          ]}
        >
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.darkroomCardGradient}
          >
            {/* Only show count on top card */}
            {isTopCard && <Text style={styles.darkroomCardText}>{count > 99 ? '99+' : count}</Text>}
          </LinearGradient>
        </Animated.View>
      );
    }

    return cards;
  };

  return (
    <TouchableOpacity
      style={[styles.darkroomCardContainer, isDisabled && styles.darkroomCardDisabled]}
      onPress={handlePress}
      disabled={isDisabled}
    >
      {renderCards()}
    </TouchableOpacity>
  );
};

const CameraScreen = () => {
  const {
    // Camera permissions
    permission,
    requestPermission,

    // Camera state
    facing,
    flash,
    zoom,
    isCapturing,
    zoomLevels,
    selectedLens,

    // Darkroom state
    darkroomCounts,
    isBottomSheetVisible,

    // Flash effect state
    showFlash,

    // Refs
    cameraRef,

    // Animation values
    flashOpacity,
    cardScale,
    cardFanSpread,

    // Handlers
    toggleCameraFacing,
    toggleFlash,
    handleZoomChange,
    takePicture,
    handleAvailableLensesChanged,

    // Bottom sheet handlers
    openBottomSheet,
    closeBottomSheet,
    handleBottomSheetComplete,
  } = useCamera();

  // Handle permission request
  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>Rewind needs access to your camera to take photos</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera Preview Container - with rounded corners */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          flash={flash}
          zoom={zoom.cameraZoom}
          onAvailableLensesChanged={handleAvailableLensesChanged}
          {...(Platform.OS === 'ios' && selectedLens && { selectedLens })}
        />
        {/* Flash Overlay (camera shutter effect) - contained within camera preview */}
        {showFlash && <Animated.View style={[styles.flashOverlay, { opacity: flashOpacity }]} />}
      </View>

      {/* Floating Controls Row - Flash (left), Zoom (center), Flip (right) - positioned above footer */}
      <View style={styles.floatingControls}>
        {/* Flash Button (far left) */}
        <TouchableOpacity style={styles.floatingButton} onPress={toggleFlash}>
          <FlashIcon color="#FFFFFF" mode={flash} />
          {flash === 'auto' && <Text style={styles.flashLabel}>A</Text>}
        </TouchableOpacity>

        {/* Zoom Control Bar - centered */}
        <View style={styles.zoomBar}>
          {zoomLevels.map(level => {
            const isSelected = zoom.value === level.value;
            return (
              <TouchableOpacity
                key={level.value}
                style={[styles.zoomButton, isSelected && styles.zoomButtonActive]}
                onPress={() => handleZoomChange(level)}
                activeOpacity={0.7}
              >
                <View style={styles.zoomLabelContainer}>
                  <Text style={[styles.zoomButtonText, isSelected && styles.zoomButtonTextActive]}>
                    {level.label}
                  </Text>
                  {isSelected && (
                    <Text
                      style={[
                        styles.zoomButtonText,
                        styles.zoomButtonTextActive,
                        styles.zoomSuffix,
                      ]}
                    >
                      x
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Flip Camera Button (far right) */}
        <TouchableOpacity style={styles.floatingButton} onPress={toggleCameraFacing}>
          <FlipCameraIcon color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Footer Bar - solid dark background */}
      <View style={styles.footerBar}>
        {/* Main Controls Row: Darkroom, Capture */}
        <View style={styles.footerControls}>
          {/* Darkroom Card Stack Button */}
          <DarkroomCardButton
            count={darkroomCounts.totalCount}
            onPress={openBottomSheet}
            scaleAnim={cardScale}
            fanSpreadAnim={cardFanSpread}
            hasRevealedPhotos={darkroomCounts.revealedCount > 0}
          />

          {/* Capture Button (center) - 10% larger with spaced ring, two-stage haptic */}
          <Pressable
            style={({ pressed }) => [
              styles.captureButtonOuter,
              isCapturing && styles.captureButtonDisabled,
              pressed && styles.captureButtonPressed,
            ]}
            onPressIn={() => {
              // First stage: light haptic on finger down (like half-press shutter)
              lightImpact();
            }}
            onPressOut={takePicture}
            disabled={isCapturing}
          >
            <View style={styles.captureButton}>
              <View style={styles.captureButtonInner} />
            </View>
          </Pressable>

          {/* Invisible spacer to balance darkroom button and center capture button */}
          <View style={styles.footerSpacer} />
        </View>
      </View>

      {/* Darkroom Bottom Sheet */}
      <DarkroomBottomSheet
        visible={isBottomSheetVisible}
        revealedCount={darkroomCounts.revealedCount}
        developingCount={darkroomCounts.developingCount}
        onClose={closeBottomSheet}
        onComplete={handleBottomSheetComplete}
      />
    </View>
  );
};

export default CameraScreen;
