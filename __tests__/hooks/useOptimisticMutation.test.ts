/**
 * Tests for useOptimisticMutation hook
 *
 * Covers:
 * - Single-key optimistic updates with rollback
 * - Multi-key optimistic updates (updaters array)
 * - Callback passthrough (onSuccess, onMutate, onSettled)
 * - Toast.show on error
 */

import { renderHook } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCancelQueries = jest.fn().mockResolvedValue(undefined);
const mockGetQueryData = jest.fn();
const mockSetQueryData = jest.fn();
const mockInvalidateQueries = jest.fn().mockResolvedValue(undefined);

jest.mock('@tanstack/react-query', () => {
  // Capture the options passed to useMutation so we can invoke callbacks
  let capturedOptions: any = null;

  return {
    useMutation: jest.fn((options: any) => {
      capturedOptions = options;
      return {
        mutate: jest.fn(),
        mutateAsync: jest.fn(),
        isPending: false,
        isError: false,
        isSuccess: false,
        data: undefined,
        error: null,
        reset: jest.fn(),
        // Expose captured options for test inspection
        _options: options,
      };
    }),
    useQueryClient: jest.fn(() => ({
      cancelQueries: mockCancelQueries,
      getQueryData: mockGetQueryData,
      setQueryData: mockSetQueryData,
      invalidateQueries: mockInvalidateQueries,
    })),
    // Re-export the captured options getter for tests
    _getCapturedOptions: () => capturedOptions,
  };
});

const mockToastShow = jest.fn();
jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: (...args: any[]) => mockToastShow(...args) },
}));

// Import after mocks
import { useMutation, _getCapturedOptions } from '@tanstack/react-query';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';

// Helper: render the hook and return the captured mutation options
function renderAndCapture(hookOptions: any) {
  const result = renderHook(() => useOptimisticMutation(hookOptions));
  const options = (result.result.current as any)._options;
  return { result, options };
}

// ---------------------------------------------------------------------------
// Single-key tests
// ---------------------------------------------------------------------------

describe('useOptimisticMutation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('single-key mode', () => {
    const queryKey = ['photos', 'detail', 'photo-1'];
    const mutationFn = jest.fn();
    const updater = jest.fn((old: any, vars: any) => ({ ...old, liked: true }));

    function setup() {
      return renderAndCapture({
        mutationFn,
        queryKey,
        updater,
        errorMessage: 'Failed to react',
      });
    }

    it('cancels queries, snapshots, and sets data on onMutate', async () => {
      const { options } = setup();
      mockGetQueryData.mockReturnValue({ id: 'photo-1', liked: false });

      const context = await options.onMutate({ photoId: 'photo-1' });

      expect(mockCancelQueries).toHaveBeenCalledWith({ queryKey });
      expect(mockGetQueryData).toHaveBeenCalledWith(queryKey);
      expect(mockSetQueryData).toHaveBeenCalledWith(
        queryKey,
        expect.any(Function),
      );
      // Context should contain previous data for rollback
      expect(context).toBeDefined();
      expect(context.previous).toBeDefined();
    });

    it('restores previous data and shows toast on error', async () => {
      const { options } = setup();
      const previousData = { id: 'photo-1', liked: false };
      mockGetQueryData.mockReturnValue(previousData);

      const context = await options.onMutate({ photoId: 'photo-1' });

      // Simulate error
      options.onError(new Error('Network error'), { photoId: 'photo-1' }, context);

      // Should restore previous data
      expect(mockSetQueryData).toHaveBeenCalledWith(queryKey, previousData);
      // Should show toast
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text1: 'Failed to react',
        }),
      );
    });

    it('invalidates queries on settled', async () => {
      const { options } = setup();
      mockGetQueryData.mockReturnValue({});

      const context = await options.onMutate({});
      await options.onSettled(undefined, null, {}, context);

      expect(mockInvalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Multi-key tests
  // ---------------------------------------------------------------------------

  describe('multi-key mode (updaters array)', () => {
    const photoDetailKey = ['photos', 'detail', 'photo-1'];
    const feedKey = ['photos', 'feed'];

    function setup() {
      return renderAndCapture({
        mutationFn: jest.fn(),
        updaters: [
          {
            queryKey: photoDetailKey,
            updater: (old: any) => ({ ...old, reactionCount: (old?.reactionCount ?? 0) + 1 }),
          },
          {
            queryKey: feedKey,
            updater: (old: any) => old,
          },
        ],
        errorMessage: 'Failed to react',
      });
    }

    it('cancels, snapshots, and updates ALL specified query keys', async () => {
      const { options } = setup();
      mockGetQueryData
        .mockReturnValueOnce({ id: 'photo-1', reactionCount: 5 })
        .mockReturnValueOnce([{ id: 'photo-1' }]);

      await options.onMutate({ photoId: 'photo-1' });

      // Both keys should be cancelled
      expect(mockCancelQueries).toHaveBeenCalledTimes(2);
      expect(mockCancelQueries).toHaveBeenCalledWith({ queryKey: photoDetailKey });
      expect(mockCancelQueries).toHaveBeenCalledWith({ queryKey: feedKey });

      // Both keys should have data set
      expect(mockSetQueryData).toHaveBeenCalledTimes(2);
    });

    it('restores ALL previous snapshots on error', async () => {
      const { options } = setup();
      const detailData = { id: 'photo-1', reactionCount: 5 };
      const feedData = [{ id: 'photo-1' }];
      mockGetQueryData
        .mockReturnValueOnce(detailData)
        .mockReturnValueOnce(feedData);

      const context = await options.onMutate({ photoId: 'photo-1' });
      options.onError(new Error('fail'), {}, context);

      // Both keys should be restored
      expect(mockSetQueryData).toHaveBeenCalledWith(photoDetailKey, detailData);
      expect(mockSetQueryData).toHaveBeenCalledWith(feedKey, feedData);
      expect(mockToastShow).toHaveBeenCalled();
    });

    it('invalidates ALL updated keys on settled', async () => {
      const { options } = setup();
      mockGetQueryData.mockReturnValue({});

      const context = await options.onMutate({});
      await options.onSettled(undefined, null, {}, context);

      expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Callback passthrough tests
  // ---------------------------------------------------------------------------

  describe('callback passthrough', () => {
    it('calls consumer onMutate after internal optimistic update', async () => {
      const consumerOnMutate = jest.fn();
      const { options } = renderAndCapture({
        mutationFn: jest.fn(),
        queryKey: ['test'],
        updater: (old: any) => old,
        errorMessage: 'Error',
        onMutate: consumerOnMutate,
      });
      mockGetQueryData.mockReturnValue({});

      await options.onMutate({ foo: 'bar' });

      expect(consumerOnMutate).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('calls consumer onSuccess after mutation success', () => {
      const consumerOnSuccess = jest.fn();
      const { options } = renderAndCapture({
        mutationFn: jest.fn(),
        queryKey: ['test'],
        updater: (old: any) => old,
        errorMessage: 'Error',
        onSuccess: consumerOnSuccess,
      });

      options.onSuccess({ result: true }, { foo: 'bar' });

      expect(consumerOnSuccess).toHaveBeenCalledWith({ result: true }, { foo: 'bar' });
    });

    it('calls consumer onSettled after internal invalidation', async () => {
      const consumerOnSettled = jest.fn();
      const { options } = renderAndCapture({
        mutationFn: jest.fn(),
        queryKey: ['test'],
        updater: (old: any) => old,
        errorMessage: 'Error',
        onSettled: consumerOnSettled,
      });
      mockGetQueryData.mockReturnValue({});

      const context = await options.onMutate({});
      await options.onSettled({ result: true }, null, { foo: 'bar' }, context);

      expect(consumerOnSettled).toHaveBeenCalledWith(
        { result: true },
        null,
        { foo: 'bar' },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Return value test
  // ---------------------------------------------------------------------------

  it('returns standard useMutation result (mutate, isPending, etc.)', () => {
    const { result } = renderAndCapture({
      mutationFn: jest.fn(),
      queryKey: ['test'],
      updater: (old: any) => old,
      errorMessage: 'Error',
    });

    expect(result.result.current).toHaveProperty('mutate');
    expect(result.result.current).toHaveProperty('isPending');
  });
});
