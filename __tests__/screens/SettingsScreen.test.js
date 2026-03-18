/**
 * SettingsScreen Unit Tests - Read Receipts
 *
 * Tests for the Read Receipts privacy toggle:
 * - Toggle presence in Privacy section
 * - Default ON state when readReceiptsEnabled is undefined
 * - OFF state when readReceiptsEnabled is false
 * - Confirmation Alert when toggling OFF
 * - Firestore write on toggle confirm
 * - Toggle ON without confirmation dialog
 */

import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

// Mock Alert
jest.spyOn(Alert, 'alert');

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock expo-application
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0.0',
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const RN = require('react-native');
  const MockSafeAreaView = function MockSafeAreaView(props) {
    return React.createElement(RN.View, null, props.children);
  };
  MockSafeAreaView.displayName = 'MockSafeAreaView';
  return {
    SafeAreaView: MockSafeAreaView,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// Mock PixelIcon
jest.mock('../../src/components/PixelIcon', () => 'PixelIcon');

// Mock PixelToggle - render as a touchable element that calls onValueChange
jest.mock('../../src/components/PixelToggle', () => {
  const React = require('react');
  const RN = require('react-native');
  const MockPixelToggle = function MockPixelToggle(props) {
    return React.createElement(
      RN.TouchableOpacity,
      { testID: 'pixel-toggle', onPress: () => props.onValueChange(!props.value) },
      React.createElement(RN.Text, null, props.value ? 'ON' : 'OFF')
    );
  };
  MockPixelToggle.displayName = 'MockPixelToggle';
  return MockPixelToggle;
});

// Mock Firestore
const mockUpdateDoc = jest.fn(() => Promise.resolve());
const mockDocRef = jest.fn(() => ({ _mockDocRef: true }));
const mockGetFirestore = jest.fn(() => ({}));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: (...args) => mockGetFirestore(...args),
  doc: (...args) => mockDocRef(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  serverTimestamp: jest.fn(() => 'mock-server-timestamp'),
}));

// Mock AuthContext
let mockUserProfile = { uid: 'test-uid', readReceiptsEnabled: undefined };
const mockSignOut = jest.fn();
const mockUpdateUserProfile = jest.fn();

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'test-uid' },
    userProfile: mockUserProfile,
    signOut: mockSignOut,
    updateUserProfile: mockUpdateUserProfile,
  }),
}));

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

const SettingsScreen = require('../../src/screens/SettingsScreen').default;

describe('SettingsScreen - Read Receipts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserProfile = { uid: 'test-uid', readReceiptsEnabled: undefined };
  });

  it('renders a "Read Receipts" toggle item in the Privacy section', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Read Receipts')).toBeTruthy();
  });

  // NOTE: The read receipts toggle was moved from SettingsScreen to a dedicated
  // ReadReceiptsSettings screen (quick-15). The toggle tests below were removed
  // because they tested behavior that no longer exists on this screen.
  // SettingsScreen now just shows a navigation item to ReadReceiptsSettings.

  it('shows Read Receipts as a navigation item (not a toggle)', () => {
    render(<SettingsScreen />);
    // Read Receipts should be present as a navigation link, not a toggle
    expect(screen.getByText('Read Receipts')).toBeTruthy();
    // There should be no ON/OFF toggle text for read receipts
    expect(screen.queryAllByText('ON').length).toBe(0);
    expect(screen.queryAllByText('OFF').length).toBe(0);
  });
});
