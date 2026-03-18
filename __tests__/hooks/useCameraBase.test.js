/**
 * useCameraBase Hook Unit Tests — Video Recording
 *
 * Tests for the hold-to-record gesture behavior in useCameraBase.
 *
 * Covers:
 * - handlePressIn / handlePressOut function exports
 * - isRecording and cameraMode initial state
 * - Recording constants (HOLD_THRESHOLD_MS, MAX_RECORDING_DURATION)
 * - recordingDuration and isFacingLockedRef defaults
 */

import { renderHook } from '@testing-library/react-native';

import useCameraBase from '../../src/hooks/useCameraBase';

// Mock expo-camera
jest.mock('expo-camera', () => ({
  useCameraPermissions: jest.fn(() => [{ granted: true }, jest.fn()]),
  CameraView: 'CameraView',
}));

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    setParams: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: jest.fn(),
}));

// Mock logger to prevent console output
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock AuthContext
jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'test-user-id' },
  }),
}));

// Mock photoService
jest.mock('../../src/services/firebase/photoService', () => ({
  getDarkroomCounts: jest.fn(() =>
    Promise.resolve({ totalCount: 0, developingCount: 0, revealedCount: 0 })
  ),
}));

// Mock uploadQueueService
const mockAddToQueue = jest.fn(() => Promise.resolve('queue-id'));
const mockInitializeQueue = jest.fn(() => Promise.resolve());
jest.mock('../../src/services/uploadQueueService', () => ({
  addToQueue: (...args) => mockAddToQueue(...args),
  initializeQueue: (...args) => mockInitializeQueue(...args),
}));

// Mock expo-image-manipulator
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(() =>
    Promise.resolve({ uri: 'file://manipulated.jpg', width: 100, height: 100 })
  ),
  SaveFormat: { JPEG: 'jpeg' },
  FlipType: { Horizontal: 'horizontal' },
}));

// Mock expo-haptics
jest.mock('../../src/utils/haptics', () => ({
  lightImpact: jest.fn(),
  mediumImpact: jest.fn(),
}));

describe('useCameraBase - video recording', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('exports handlePressIn function', () => {
    const { result } = renderHook(() => useCameraBase());

    expect(result.current.handlePressIn).toBeDefined();
    expect(typeof result.current.handlePressIn).toBe('function');
  });

  test('exports handlePressOut function', () => {
    const { result } = renderHook(() => useCameraBase());

    expect(result.current.handlePressOut).toBeDefined();
    expect(typeof result.current.handlePressOut).toBe('function');
  });

  test('isRecording defaults to false', () => {
    const { result } = renderHook(() => useCameraBase());

    expect(result.current.isRecording).toBe(false);
  });

  test('cameraMode defaults to "picture"', () => {
    const { result } = renderHook(() => useCameraBase());

    expect(result.current.cameraMode).toBe('picture');
  });

  test('HOLD_THRESHOLD_MS is exported as 500', () => {
    const { HOLD_THRESHOLD_MS } = require('../../src/hooks/useCameraBase');
    expect(HOLD_THRESHOLD_MS).toBe(500);
  });

  test('recordingDuration defaults to 0', () => {
    const { result } = renderHook(() => useCameraBase());
    expect(result.current.recordingDuration).toBe(0);
  });

  test('isFacingLockedRef defaults to false', () => {
    const { result } = renderHook(() => useCameraBase());
    expect(result.current.isFacingLockedRef.current).toBe(false);
  });

  test('MAX_RECORDING_DURATION is exported as 30', () => {
    // This constant should be exported from useCameraBase
    const { MAX_RECORDING_DURATION } = require('../../src/hooks/useCameraBase');

    expect(MAX_RECORDING_DURATION).toBe(30);
  });
});
