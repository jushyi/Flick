import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MENU_WIDTH = 200;
const EDGE_PADDING = 16;

/**
 * DropdownMenu - Reusable dropdown menu component to replace Alert.alert menus
 *
 * Supports two positioning modes:
 * 1. Centered (default): Standard iOS action sheet pattern, menu appears centered
 * 2. Anchored: Menu appears near the trigger element when anchorPosition is provided
 *
 * @param {boolean} visible - Whether the menu is visible
 * @param {function} onClose - Callback to close the menu
 * @param {Array} options - Array of menu options with { label, icon?, onPress, destructive? }
 * @param {Object} anchorPosition - Position { x, y, width?, height? } for anchored mode
 *   - x: X coordinate of trigger element
 *   - y: Y coordinate of trigger element
 *   - width: Width of trigger element (optional, defaults to 0)
 *   - height: Height of trigger element (optional, defaults to 0)
 */
const DropdownMenu = ({ visible, onClose, options = [], anchorPosition }) => {
  if (!visible) return null;

  const handleOptionPress = option => {
    option.onPress?.();
    onClose?.();
  };

  // Calculate menu position for anchored mode
  const getAnchoredPosition = () => {
    if (!anchorPosition) return null;

    const { x, y, width = 0, height = 0 } = anchorPosition;
    const menuHeight = options.length * 52; // Approximate height per item

    // Default: position menu below and to the right of anchor
    let menuX = x;
    let menuY = y + height + 8;

    // Clamp horizontal position to screen bounds
    if (menuX + MENU_WIDTH > SCREEN_WIDTH - EDGE_PADDING) {
      menuX = SCREEN_WIDTH - MENU_WIDTH - EDGE_PADDING;
    }
    if (menuX < EDGE_PADDING) {
      menuX = EDGE_PADDING;
    }

    // If menu would go off bottom, position above anchor instead
    if (menuY + menuHeight > SCREEN_HEIGHT - EDGE_PADDING) {
      menuY = y - menuHeight - 8;
    }

    // Final clamp to ensure it stays on screen
    if (menuY < EDGE_PADDING) {
      menuY = EDGE_PADDING;
    }

    return { left: menuX, top: menuY };
  };

  const anchoredPosition = getAnchoredPosition();
  const isAnchored = anchoredPosition !== null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={[styles.backdrop, isAnchored && styles.backdropAnchored]}
        activeOpacity={1}
        onPress={onClose}
      >
        {isAnchored ? (
          // Anchored positioning mode
          <View style={[styles.menuAnchored, anchoredPosition]}>
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
        ) : (
          // Centered positioning mode (default)
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
        )}
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
  backdropAnchored: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
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
  menuAnchored: {
    position: 'absolute',
    width: MENU_WIDTH,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
