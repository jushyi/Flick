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

  it('shows toggle in ON state when readReceiptsEnabled is undefined (default)', () => {
    mockUserProfile = { uid: 'test-uid', readReceiptsEnabled: undefined };
    render(<SettingsScreen />);
    // The Read Receipts toggle should show ON by default
    expect(screen.getByText('Read Receipts')).toBeTruthy();
    // Find the toggle near the Read Receipts label — it should show ON
    const toggles = screen.getAllByText('ON');
    expect(toggles.length).toBeGreaterThan(0);
  });

  it('shows toggle in OFF state when readReceiptsEnabled is false', () => {
    mockUserProfile = { uid: 'test-uid', readReceiptsEnabled: false };
    render(<SettingsScreen />);
    expect(screen.getByText('Read Receipts')).toBeTruthy();
    const toggles = screen.getAllByText('OFF');
    expect(toggles.length).toBeGreaterThan(0);
  });

  it('shows confirmation Alert when toggling OFF', () => {
    mockUserProfile = { uid: 'test-uid', readReceiptsEnabled: true };
    render(<SettingsScreen />);
    // Find the ON toggle for Read Receipts and press it to toggle OFF
    const onToggles = screen.getAllByText('ON');
    // Press the read receipts toggle (there should be one)
    fireEvent.press(onToggles[0]);
    expect(Alert.alert).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("you also won't see"),
      expect.any(Array)
    );
  });

  it('writes readReceiptsEnabled to Firestore on toggle confirm', async () => {
    mockUserProfile = { uid: 'test-uid', readReceiptsEnabled: true };
    render(<SettingsScreen />);
    // Toggle OFF
    const onToggles = screen.getAllByText('ON');
    fireEvent.press(onToggles[0]);
    // Get the Alert callback and simulate confirming
    const alertCall = Alert.alert.mock.calls[0];
    const buttons = alertCall[2];
    // Find the "Turn Off" button and press it
    const turnOffButton = buttons.find(b => b.text === 'Turn Off');
    expect(turnOffButton).toBeTruthy();
    await turnOffButton.onPress();
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ readReceiptsEnabled: false })
    );
  });

  it('toggles ON without confirmation dialog', async () => {
    mockUserProfile = { uid: 'test-uid', readReceiptsEnabled: false };
    render(<SettingsScreen />);
    // Toggle ON - press the OFF toggle
    const offToggles = screen.getAllByText('OFF');
    fireEvent.press(offToggles[0]);
    // Should NOT show Alert
    expect(Alert.alert).not.toHaveBeenCalled();
    // Should write directly to Firestore
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ readReceiptsEnabled: true })
    );
  });
});
