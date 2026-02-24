/**
 * ConversationHeader Component
 *
 * Header bar for the DM conversation screen with:
 * - Back button (chevron-back)
 * - Tappable profile photo (circular, expo-image)
 * - Tappable display name
 * - Three-dot menu with "Report User" option
 * - Safe area top padding for status bar
 */
import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PixelIcon from './PixelIcon';
import StreakIndicator from './StreakIndicator';
import DropdownMenu from './DropdownMenu';

import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

const ConversationHeader = ({
  friendProfile,
  onBackPress,
  onProfilePress,
  onReportPress,
  streakState = 'default',
  streakDayCount = 0,
}) => {
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const menuButtonRef = useRef(null);

  const handleMenuPress = useCallback(() => {
    menuButtonRef.current?.measureInWindow((x, y, width, height) => {
      setMenuAnchor({ x, y, width, height });
      setMenuVisible(true);
    });
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.contentRow}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <PixelIcon name="chevron-back" size={24} color={colors.icon.primary} />
        </TouchableOpacity>

        {/* Profile Photo */}
        <TouchableOpacity onPress={onProfilePress} style={styles.profilePhotoWrapper}>
          {friendProfile?.profilePhotoURL || friendProfile?.photoURL ? (
            <Image
              source={{ uri: friendProfile?.profilePhotoURL || friendProfile?.photoURL }}
              style={styles.profilePhoto}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.profilePhoto, styles.profilePhotoFallback]}>
              <Text style={styles.profilePhotoFallbackText}>
                {(friendProfile?.displayName || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Display Name */}
        <TouchableOpacity onPress={onProfilePress} style={styles.nameWrapper}>
          <Text style={styles.displayName} numberOfLines={1}>
            {friendProfile?.displayName || 'Unknown'}
          </Text>
        </TouchableOpacity>

        {/* Streak Indicator */}
        <View style={styles.streakWrapper}>
          <StreakIndicator streakState={streakState} dayCount={streakDayCount} size={18} />
        </View>

        {/* Three-dot Menu */}
        <TouchableOpacity ref={menuButtonRef} style={styles.menuButton} onPress={handleMenuPress}>
          <PixelIcon name="ellipsis-vertical" size={20} color={colors.icon.primary} />
        </TouchableOpacity>
      </View>

      {/* Dropdown Menu */}
      <DropdownMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        anchorPosition={menuAnchor}
        options={[
          {
            label: 'Report User',
            icon: 'flag',
            destructive: true,
            onPress: onReportPress,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.primary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  contentRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  profilePhotoWrapper: {
    marginRight: 10,
  },
  profilePhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.tertiary,
  },
  profilePhotoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePhotoFallbackText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontFamily: typography.fontFamily.bodyBold,
  },
  nameWrapper: {
    flex: 1,
    marginRight: 8,
  },
  streakWrapper: {
    marginRight: 8,
  },
  displayName: {
    color: colors.text.primary,
    fontSize: 13,
    fontFamily: typography.fontFamily.bodyBold,
  },
  menuButton: {
    padding: 4,
  },
});

export default ConversationHeader;
