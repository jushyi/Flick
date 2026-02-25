/**
 * useDarkroom Hook Unit Tests
 *
 * Tests for the darkroom screen logic hook including:
 * - Loads darkroom state on mount
 * - Returns developing/revealed photos
 * - Handles reveal ready state
 * - Handles no active darkroom (no developing photos)
 * - Triage actions (archive, journal, delete)
 * - Undo stack management
 * - Done button batch save
 * - Loading state management
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// Import hook after mocks
import useDarkroom from '../../src/hooks/useDarkroom';

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

// Mock photoService
const mockGetDevelopingPhotos = jest.fn();
const mockRevealPhotos = jest.fn();
const mockBatchTriagePhotos = jest.fn();

jest.mock('../../src/services/firebase/photoService', () => ({
  getDevelopingPhotos: (...args) => mockGetDevelopingPhotos(...args),
  revealPhotos: (...args) => mockRevealPhotos(...args),
  batchTriagePhotos: (...args) => mockBatchTriagePhotos(...args),
}));

// Mock darkroomService
const mockIsDarkroomReadyToReveal = jest.fn();
const mockScheduleNextReveal = jest.fn();
const mockRecordTriageCompletion = jest.fn();

jest.mock('../../src/services/firebase/darkroomService', () => ({
  isDarkroomReadyToReveal: (...args) => mockIsDarkroomReadyToReveal(...args),
  scheduleNextReveal: (...args) => mockScheduleNextReveal(...args),
  recordTriageCompletion: (...args) => mockRecordTriageCompletion(...args),
  clearRevealCache: jest.fn(),
}));

// Mock haptics
jest.mock('../../src/utils/haptics', () => ({
  successNotification: jest.fn(),
}));

// Mock sound utils
jest.mock('../../src/utils/soundUtils', () => ({
  playSuccessSound: jest.fn(),
}));

// Mock expo-image
jest.mock('expo-image', () => ({
  Image: {
    prefetch: jest.fn(() => Promise.resolve()),
  },
}));

// Mock AuthContext
const mockUser = { uid: 'test-user-123' };
const mockUserProfile = {
  soundPreferences: {
    effectsEnabled: false, // Default: sound effects disabled
  },
};
jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, userProfile: mockUserProfile }),
}));

// Mock navigation - useFocusEffect delegates to useEffect for deferred execution
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => {
  const mockReact = require('react');
  return {
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: mockGoBack,
      setOptions: jest.fn(),
      dispatch: jest.fn(),
      reset: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
    }),
    useRoute: () => ({ params: {} }),
    useFocusEffect: callback => {
      // Use useEffect to defer callback execution (like the real useFocusEffect)
      // This ensures loadDevelopingPhotos is defined before it's called

      mockReact.useEffect(() => {
        const cleanup = callback();
        return cleanup;
      }, [callback]);
    },
    useIsFocused: () => true,
  };
});

// Test data
const mockRevealedPhotos = [
  {
    id: 'photo-1',
    userId: 'test-user-123',
    imageURL: 'https://storage.example.com/photo-1.jpg',
    status: 'revealed',
    capturedAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
  },
  {
    id: 'photo-2',
    userId: 'test-user-123',
    imageURL: 'https://storage.example.com/photo-2.jpg',
    status: 'revealed',
    capturedAt: { _seconds: (Date.now() - 60000) / 1000, _nanoseconds: 0 },
  },
  {
    id: 'photo-3',
    userId: 'test-user-123',
    imageURL: 'https://storage.example.com/photo-3.jpg',
    status: 'revealed',
    capturedAt: { _seconds: (Date.now() - 120000) / 1000, _nanoseconds: 0 },
  },
];

const mockDevelopingPhotos = [
  {
    id: 'photo-dev-1',
    userId: 'test-user-123',
    imageURL: 'https://storage.example.com/dev-1.jpg',
    status: 'developing',
    capturedAt: { _seconds: Date.now() / 1000, _nanoseconds: 0 },
  },
];

describe('useDarkroom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default mock responses
    mockIsDarkroomReadyToReveal.mockResolvedValue(true);
    mockRevealPhotos.mockResolvedValue({ success: true, count: 3 });
    mockScheduleNextReveal.mockResolvedValue({ success: true });
    mockGetDevelopingPhotos.mockResolvedValue({
      success: true,
      photos: mockRevealedPhotos,
    });
    mockBatchTriagePhotos.mockResolvedValue({
      success: true,
      journaledCount: 0,
    });
    mockRecordTriageCompletion.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // =========================================================================
  // Loads darkroom state on mount
  // =========================================================================

  test('loads darkroom state on mount and returns revealed photos', async () => {
    const { result } = await renderHook(() => useDarkroom());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockIsDarkroomReadyToReveal).toHaveBeenCalledWith('test-user-123');
    expect(mockGetDevelopingPhotos).toHaveBeenCalledWith('test-user-123');
    // Should have revealed photos
    expect(result.current.photos).toHaveLength(3);
    expect(result.current.visiblePhotos).toHaveLength(3);
  });

  // =========================================================================
  // Returns photo counts
  // =========================================================================

  test('returns correct photo counts and currentPhoto', async () => {
    const { result } = await renderHook(() => useDarkroom());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.photos).toHaveLength(3);
    expect(result.current.currentPhoto).toEqual(mockRevealedPhotos[0]);
    expect(result.current.visiblePhotos).toHaveLength(3);
  });

  // =========================================================================
  // Handles reveal ready state
  // =========================================================================

  test('reveals photos and schedules next reveal when darkroom is ready', async () => {
    mockIsDarkroomReadyToReveal.mockResolvedValue(true);

    const { result } = await renderHook(() => useDarkroom());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should have revealed and scheduled
    expect(mockRevealPhotos).toHaveBeenCalledWith('test-user-123');
    expect(mockScheduleNextReveal).toHaveBeenCalledWith('test-user-123');
  });

  test('does not reveal when darkroom is not ready', async () => {
    mockIsDarkroomReadyToReveal.mockResolvedValue(false);

    const { result } = await renderHook(() => useDarkroom());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should NOT have revealed
    expect(mockRevealPhotos).not.toHaveBeenCalled();
    expect(mockScheduleNextReveal).not.toHaveBeenCalled();
    // Should still load photos
    expect(mockGetDevelopingPhotos).toHaveBeenCalledWith('test-user-123');
  });

  // =========================================================================
  // Handles no active darkroom (no photos)
  // =========================================================================

  test('handles no developing or revealed photos', async () => {
    mockGetDevelopingPhotos.mockResolvedValue({
      success: true,
      photos: [],
    });

    const { result } = await renderHook(() => useDarkroom());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.photos).toEqual([]);
    expect(result.current.visiblePhotos).toEqual([]);
    expect(result.current.currentPhoto).toBeUndefined();
  });

  test('handles getDevelopingPhotos failure gracefully', async () => {
    mockGetDevelopingPhotos.mockResolvedValue({
      success: false,
      error: 'Network error',
    });

    const { result } = await renderHook(() => useDarkroom());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.photos).toEqual([]);
  });

  // =========================================================================
  // Filters to revealed photos only
  // =========================================================================

  test('filters photos to only show revealed status', async () => {
    // Mix of developing and revealed photos
    const mixedPhotos = [...mockRevealedPhotos, ...mockDevelopingPhotos];

    mockGetDevelopingPhotos.mockResolvedValue({
      success: true,
      photos: mixedPhotos,
    });

    const { result } = await renderHook(() => useDarkroom());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should only include revealed photos
    expect(result.current.photos).toHaveLength(3);
    result.current.photos.forEach(photo => {
      expect(photo.status).toBe('revealed');
    });
  });

  // =========================================================================
  // Triage actions
  // =========================================================================

  test('handleTriage hides photo and pushes to undo stack', async () => {
    const { result } = await renderHook(() => useDarkroom());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.visiblePhotos).toHaveLength(3);
    expect(result.current.undoStack).toHaveLength(0);

    // Triage first photo as journal
    await act(async () => {
      await result.current.handleTriage('photo-1', 'journal');
    });

    // Photo should be hidden
    expect(result.current.visiblePhotos).toHaveLength(2);
    expect(result.current.hiddenPhotoIds.has('photo-1')).toBe(true);

    // Undo stack should have the decision
    expect(result.current.undoStack).toHaveLength(1);
    expect(result.current.undoStack[0].action).toBe('journal');
    expect(result.current.undoStack[0].photo.id).toBe('photo-1');
  });

  test('handleTriage sets triageComplete when last photo is triaged', async () => {
    // Only one revealed photo
    mockGetDevelopingPhotos.mockResolvedValue({
      success: true,
      photos: [mockRevealedPhotos[0]],
    });

    const { result } = await renderHook(() => useDarkroom());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.visiblePhotos).toHaveLength(1);

    // Triage the only photo
    await act(async () => {
      await result.current.handleTriage('photo-1', 'archive');
    });

    // pendingSuccess should be set immediately
    expect(result.current.pendingSuccess).toBe(true);

    // Run timers for triageComplete delay (300ms)
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current.triageComplete).toBe(true);
  });

  // =========================================================================
  // Undo functionality
  // =========================================================================

  test('handleUndo restores last triaged photo', async () => {
    const { result } = await renderHook(() => useDarkroom());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Triage first photo
    await act(async () => {
      await result.current.handleTriage('photo-1', 'archive');
    });

    expect(result.current.visiblePhotos).toHaveLength(2);
    expect(result.current.undoStack).toHaveLength(1);

    // Undo
    await act(async () => {
      result.current.handleUndo();
    });

    // Photo should be visible again
    expect(result.current.visiblePhotos).toHaveLength(3);
    expect(result.current.undoStack).toHaveLength(0);
    expect(result.current.hiddenPhotoIds.has('photo-1')).toBe(false);
  });

  test('handleUndo does nothing when undo stack is empty', async () => {
    const { result } = await renderHook(() => useDarkroom());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.undoStack).toHaveLength(0);

    // Undo with empty stack should be a no-op
    await act(async () => {
      result.current.handleUndo();
    });

    expect(result.current.visiblePhotos).toHaveLength(3);
  });

  // =========================================================================
  // Done button batch save
  // =========================================================================

  test('handleDone batch saves triage decisions and navigates back', async () => {
    const { result } = await renderHook(() => useDarkroom());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Triage all photos
    await act(async () => {
      await result.current.handleTriage('photo-1', 'journal');
    });
    await act(async () => {
      await result.current.handleTriage('photo-2', 'archive');
    });
    await act(async () => {
      await result.current.handleTriage('photo-3', 'delete');
    });

    expect(result.current.undoStack).toHaveLength(3);

    // Press Done
    await act(async () => {
      await result.current.handleDone();
    });

    // Should have called batchTriagePhotos with decisions
    expect(mockBatchTriagePhotos).toHaveBeenCalledWith(
      [
        { photoId: 'photo-1', action: 'journal' },
        { photoId: 'photo-2', action: 'archive' },
        { photoId: 'photo-3', action: 'delete' },
      ],
      {}, // photoTags
      {} // photoCaptions
    );

    // Should navigate back
    expect(mockGoBack).toHaveBeenCalled();
  });

  test('handleDone navigates back directly when no decisions made', async () => {
    const { result } = await renderHook(() => useDarkroom());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Press Done without triaging any photos
    await act(async () => {
      await result.current.handleDone();
    });

    // Should navigate back without calling batchTriagePhotos
    expect(mockBatchTriagePhotos).not.toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalled();
  });

  test('handleDone records triage completion when photos are journaled', async () => {
    mockBatchTriagePhotos.mockResolvedValue({
      success: true,
      journaledCount: 2,
    });

    const { result } = await renderHook(() => useDarkroom());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Triage some photos
    await act(async () => {
      await result.current.handleTriage('photo-1', 'journal');
    });

    // Press Done
    await act(async () => {
      await result.current.handleDone();
    });

    // Should record triage completion because journaledCount > 0
    expect(mockRecordTriageCompletion).toHaveBeenCalledWith('test-user-123', 2);
  });

  // =========================================================================
  // Photo tagging
  // =========================================================================

  test('handleTagFriends updates photo tags', async () => {
    const { result } = await renderHook(() => useDarkroom());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      result.current.handleTagFriends('photo-1', ['friend-a', 'friend-b']);
    });

    expect(result.current.getTagsForPhoto('photo-1')).toEqual(['friend-a', 'friend-b']);
    expect(result.current.getTagsForPhoto('photo-2')).toEqual([]);
  });

  // =========================================================================
  // Loading state
  // =========================================================================

  test('loading is true during initial load', async () => {
    let resolvePhotos;
    mockGetDevelopingPhotos.mockReturnValue(
      new Promise(resolve => {
        resolvePhotos = resolve;
      })
    );

    const { result } = await renderHook(() => useDarkroom());

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolvePhotos({ success: true, photos: mockRevealedPhotos });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});
