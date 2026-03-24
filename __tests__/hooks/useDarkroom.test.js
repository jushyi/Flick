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

// Mock photoService (Supabase)
const mockTriagePhoto = jest.fn();
const mockSoftDeletePhoto = jest.fn();
const mockBatchTriagePhotos = jest.fn();
const mockUpdatePhotoCaption = jest.fn();

jest.mock('../../src/services/supabase/photoService', () => ({
  triagePhoto: (...args) => mockTriagePhoto(...args),
  softDeletePhoto: (...args) => mockSoftDeletePhoto(...args),
  batchTriagePhotos: (...args) => mockBatchTriagePhotos(...args),
  updatePhotoCaption: (...args) => mockUpdatePhotoCaption(...args),
}));

// Mock darkroomService (Supabase)
const mockCheckAndRevealPhotos = jest.fn();
const mockGetDevelopingPhotos = jest.fn();
const mockGetRevealedPhotos = jest.fn();
const mockCalculateBatchRevealAt = jest.fn();

jest.mock('../../src/services/supabase/darkroomService', () => ({
  checkAndRevealPhotos: (...args) => mockCheckAndRevealPhotos(...args),
  getDevelopingPhotos: (...args) => mockGetDevelopingPhotos(...args),
  getRevealedPhotos: (...args) => mockGetRevealedPhotos(...args),
  calculateBatchRevealAt: (...args) => mockCalculateBatchRevealAt(...args),
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

    // Default mock responses (Supabase service pattern: return data directly)
    mockCheckAndRevealPhotos.mockResolvedValue(0);
    mockGetDevelopingPhotos.mockResolvedValue([]);
    mockGetRevealedPhotos.mockResolvedValue(mockRevealedPhotos);
    mockTriagePhoto.mockResolvedValue();
    mockSoftDeletePhoto.mockResolvedValue();
    mockBatchTriagePhotos.mockResolvedValue();
    mockUpdatePhotoCaption.mockResolvedValue();
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

    expect(mockCheckAndRevealPhotos).toHaveBeenCalledWith('test-user-123');
    expect(mockGetRevealedPhotos).toHaveBeenCalledWith('test-user-123');
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

  test('calls checkAndRevealPhotos on mount', async () => {
    mockCheckAndRevealPhotos.mockResolvedValue(3);

    const { result } = await renderHook(() => useDarkroom());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should have called checkAndRevealPhotos (combines old reveal + schedule logic)
    expect(mockCheckAndRevealPhotos).toHaveBeenCalledWith('test-user-123');
  });

  test('loads photos even when no reveals needed', async () => {
    mockCheckAndRevealPhotos.mockResolvedValue(0);

    const { result } = await renderHook(() => useDarkroom());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should still load photos
    expect(mockGetDevelopingPhotos).toHaveBeenCalledWith('test-user-123');
    expect(mockGetRevealedPhotos).toHaveBeenCalledWith('test-user-123');
  });

  // =========================================================================
  // Handles no active darkroom (no photos)
  // =========================================================================

  test('handles no developing or revealed photos', async () => {
    mockGetDevelopingPhotos.mockResolvedValue([]);
    mockGetRevealedPhotos.mockResolvedValue([]);

    const { result } = await renderHook(() => useDarkroom());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.photos).toEqual([]);
    expect(result.current.visiblePhotos).toEqual([]);
    expect(result.current.currentPhoto).toBeUndefined();
  });

  test('handles getDevelopingPhotos failure gracefully', async () => {
    mockGetDevelopingPhotos.mockRejectedValue(new Error('Network error'));

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
    // getRevealedPhotos returns only revealed, getDevelopingPhotos returns developing
    mockGetRevealedPhotos.mockResolvedValue(mockRevealedPhotos);
    mockGetDevelopingPhotos.mockResolvedValue(mockDevelopingPhotos);

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
    mockGetRevealedPhotos.mockResolvedValue([mockRevealedPhotos[0]]);

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

    // Should have called individual triage functions for each decision
    expect(mockTriagePhoto).toHaveBeenCalledWith('photo-1', 'journal');
    expect(mockTriagePhoto).toHaveBeenCalledWith('photo-2', 'archive');
    expect(mockSoftDeletePhoto).toHaveBeenCalledWith('photo-3');

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

    // Should navigate back without calling triage functions
    expect(mockTriagePhoto).not.toHaveBeenCalled();
    expect(mockSoftDeletePhoto).not.toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalled();
  });

  test('handleDone calls triagePhoto for journaled photos', async () => {
    const { result } = await renderHook(() => useDarkroom());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Triage some photos as journal
    await act(async () => {
      await result.current.handleTriage('photo-1', 'journal');
    });
    await act(async () => {
      await result.current.handleTriage('photo-2', 'journal');
    });

    // Press Done
    await act(async () => {
      await result.current.handleDone();
    });

    // Should have called triagePhoto for each journaled photo
    expect(mockTriagePhoto).toHaveBeenCalledWith('photo-1', 'journal');
    expect(mockTriagePhoto).toHaveBeenCalledWith('photo-2', 'journal');
    expect(mockTriagePhoto).toHaveBeenCalledTimes(2);
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
    let resolveReveal;
    mockCheckAndRevealPhotos.mockReturnValue(
      new Promise(resolve => {
        resolveReveal = resolve;
      })
    );

    const { result } = await renderHook(() => useDarkroom());

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveReveal(0);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});
