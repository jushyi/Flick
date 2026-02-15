import { View, Text, TouchableOpacity, Pressable, Animated, Platform } from 'react-native';
import { CameraView } from 'expo-camera';

import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { colors } from '../constants/colors';
import PixelIcon from '../components/PixelIcon';
import PixelSpinner from '../components/PixelSpinner';

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

// Flash icon - pixel art lightning bolt
const FlashIcon = ({ color = colors.icon.primary, mode = 'off' }) => (
  <PixelIcon
    name={mode === 'on' || mode === 'auto' ? 'flash-on' : 'flash-off'}
    size={24}
    color={color}
  />
);

// Flip camera icon - pixel art rotation arrows
const FlipCameraIcon = ({ color = colors.icon.primary }) => (
  <PixelIcon name="flip-camera" size={24} color={color} />
);

// Card dimensions (must match styles for proper SVG sizing)
const CARD_WIDTH = 63;
const CARD_HEIGHT = 84;

// Card with gradient border effect - consistent edge highlight using stroke
const GradientCard = ({ centerColor, children }) => {
  const strokeWidth = 1.5;
  const inset = strokeWidth / 2;

  return (
    <View style={{ width: CARD_WIDTH, height: CARD_HEIGHT, position: 'relative' }}>
      <Svg width={CARD_WIDTH} height={CARD_HEIGHT} style={{ position: 'absolute' }}>
        <Defs>
          {/* Gradient for stroke - fades from white at edge to transparent inside */}
          <LinearGradient id="strokeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.6" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.6" />
          </LinearGradient>
        </Defs>
        {/* Base color fill */}
        <Rect
          x="0"
          y="0"
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          rx="2"
          ry="2"
          fill={centerColor}
        />
        {/* White stroke/border for consistent edge highlight */}
        <Rect
          x={inset}
          y={inset}
          width={CARD_WIDTH - strokeWidth}
          height={CARD_HEIGHT - strokeWidth}
          rx="1.5"
          ry="1.5"
          fill="none"
          stroke="url(#strokeGrad)"
          strokeWidth={strokeWidth}
        />
      </Svg>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>{children}</View>
    </View>
  );
};

// DarkroomCardButton Component - photo card stack design with capture animation
const DarkroomCardButton = ({ count, onPress, scaleAnim, fanSpreadAnim, hasRevealedPhotos }) => {
  const isDisabled = count === 0;

  // Get card color based on state
  const cardColor = hasRevealedPhotos
    ? colors.interactive.primaryPressed // Cyan pressed (ready)
    : colors.status.developing; // Retro amber (developing)

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
            <GradientCard centerColor={cardColor}>
              {count === 0 ? (
                <PixelIcon name="camera-outline" size={20} color={colors.text.secondary} />
              ) : (
                <Text style={styles.darkroomCardText}>{count > 99 ? '99+' : count}</Text>
              )}
            </GradientCard>
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
          <GradientCard centerColor={cardColor}>
            {/* Only show count on top card */}
            {isTopCard && <Text style={styles.darkroomCardText}>{count > 99 ? '99+' : count}</Text>}
          </GradientCard>
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
        <PixelSpinner size="large" color={colors.icon.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>Flick needs access to your camera to take photos</Text>
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
          <FlashIcon color={colors.icon.primary} mode={flash} />
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
          <FlipCameraIcon color={colors.icon.primary} />
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
