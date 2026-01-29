import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * DropdownMenu - Reusable dropdown menu component to replace Alert.alert menus
 *
 * Design Note: Uses centered positioning (iOS action sheet pattern)
 * ----------------------------------------------------------------
 * The menu appears centered on screen with a semi-transparent backdrop.
 * This is a standard iOS pattern for contextual actions and provides:
 * - Consistent placement regardless of trigger location
 * - Full-width tap target for dismissal
 * - Clear visual hierarchy with backdrop
 *
 * Alternative: Anchored positioning would require callers to measure their
 * trigger elements and pass coordinates. This adds complexity but provides
 * more contextual feel. See anchorPosition prop (currently unused).
 *
 * @param {boolean} visible - Whether the menu is visible
 * @param {function} onClose - Callback to close the menu
 * @param {Array} options - Array of menu options with { label, icon?, onPress, destructive? }
 * @param {Object} anchorPosition - Reserved for future anchored positioning { x, y }
 */
const DropdownMenu = ({ visible, onClose, options = [], anchorPosition }) => {
  if (!visible) return null;

  const handleOptionPress = option => {
    option.onPress?.();
    onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.menuContainer}>
          <View style={styles.menu}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={option.label}
                style={[styles.menuItem, index < options.length - 1 && styles.menuItemBorder]}
                onPress={() => handleOptionPress(option)}
                activeOpacity={0.7}
              >
                {option.icon && (
                  <Ionicons
                    name={option.icon}
                    size={20}
                    color={option.destructive ? '#ff4444' : colors.text.primary}
                    style={styles.menuIcon}
                  />
                )}
                <Text style={[styles.menuText, option.destructive && styles.destructiveText]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    width: '80%',
    maxWidth: 300,
  },
  menu: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuIcon: {
    marginRight: 12,
  },
  menuText: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '500',
  },
  destructiveText: {
    color: '#ff4444',
  },
});

export default DropdownMenu;
