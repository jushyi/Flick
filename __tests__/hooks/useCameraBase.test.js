/**
 * useCameraBase Hook Unit Tests — Video Recording (RED scaffolds)
 *
 * Tests for the hold-to-record gesture behavior that will be
 * implemented in Plan 11-04. These tests are expected to FAIL
 * until the recording logic is added to useCameraBase.
 *
 * Covers:
 * - handlePressIn / handlePressOut function exports
 * - isRecording and cameraMode initial state
 * - Tap vs hold distinction (photo vs video)
 * - Hold threshold triggers recording
 * - Release during recording stops recording
 * - MAX_RECORDING_DURATION constant
 */

import { renderHook, act } from '@testing-library/react-native';

import useCameraBase from '../../src/hooks/useCameraBase';

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

  test('pressing and releasing quickly (tap) calls takePicture, not recordAsync', async () => {
    const { result } = renderHook(() => useCameraBase());

    // Simulate a mock camera ref
    const mockTakePictureAsync = jest.fn(() => Promise.resolve({ uri: 'file://photo.jpg' }));
    const mockRecordAsync = jest.fn(() => Promise.resolve({ uri: 'file://video.mp4' }));

    result.current.cameraRef.current = {
      takePictureAsync: mockTakePictureAsync,
      recordAsync: mockRecordAsync,
      stopRecording: jest.fn(),
    };

    // Press in and immediately press out (tap gesture)
    await act(async () => {
      result.current.handlePressIn();
    });
    // Release before hold threshold (~500ms)
    await act(async () => {
      jest.advanceTimersByTime(100);
      result.current.handlePressOut();
    });

    // Should take a photo, not start video recording
    expect(mockRecordAsync).not.toHaveBeenCalled();
  });

  test('holding past HOLD_THRESHOLD_MS starts recording', async () => {
    const { result } = renderHook(() => useCameraBase());

    const mockRecordAsync = jest.fn(
      () => new Promise(() => {}) // Never resolves (recording in progress)
    );
    const mockTakePictureAsync = jest.fn();

    result.current.cameraRef.current = {
      takePictureAsync: mockTakePictureAsync,
      recordAsync: mockRecordAsync,
      stopRecording: jest.fn(),
    };

    // Press in
    await act(async () => {
      result.current.handlePressIn();
    });

    // Hold past the threshold (500ms + buffer)
    await act(async () => {
      jest.advanceTimersByTime(700);
    });

    // Should be in recording state
    expect(result.current.isRecording).toBe(true);
    expect(result.current.cameraMode).toBe('video');
  });

  test('releasing during recording stops recording and resets state', async () => {
    const { result } = renderHook(() => useCameraBase());

    const mockStopRecording = jest.fn();
    const mockRecordAsync = jest.fn(
      () => new Promise(() => {}) // Never resolves until stopRecording
    );

    result.current.cameraRef.current = {
      takePictureAsync: jest.fn(),
      recordAsync: mockRecordAsync,
      stopRecording: mockStopRecording,
    };

    // Start recording by holding past threshold
    await act(async () => {
      result.current.handlePressIn();
    });
    await act(async () => {
      jest.advanceTimersByTime(700);
    });

    // Verify recording is active
    expect(result.current.isRecording).toBe(true);

    // Release to stop recording
    await act(async () => {
      result.current.handlePressOut();
    });

    // Should stop recording and reset state
    expect(mockStopRecording).toHaveBeenCalled();
    expect(result.current.isRecording).toBe(false);
    expect(result.current.cameraMode).toBe('picture');
  });

  test('MAX_RECORDING_DURATION is exported as 30', () => {
    // This constant should be exported from useCameraBase
    const { MAX_RECORDING_DURATION } = require('../../src/hooks/useCameraBase');

    expect(MAX_RECORDING_DURATION).toBe(30);
  });
});
