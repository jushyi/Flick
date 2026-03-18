/**
 * usePinPreference Hook Unit Tests
 *
 * Tests for the per-friend sticky pin preference hook:
 * - Default state when no stored preference
 * - Loading stored preference from AsyncStorage
 * - Toggle pin state and persistence
 * - Correct AsyncStorage key format
 * - Tooltip shown state management
 * - Friend ID change reloads preference
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { usePinPreference } from '../../src/hooks/usePinPreference';

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

describe('usePinPreference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(undefined);
  });

  it('returns pinEnabled: false and loaded: true when no stored preference exists', async () => {
    const { result } = renderHook(() => usePinPreference('friend-1'));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.pinEnabled).toBe(false);
  });

  it('returns pinEnabled: true when AsyncStorage has "true" for the friend', async () => {
    AsyncStorage.getItem.mockImplementation(key => {
      if (key === 'pin_pref_friend-2') return Promise.resolve('true');
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => usePinPreference('friend-2'));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.pinEnabled).toBe(true);
  });

  it('togglePin(true) updates state and calls AsyncStorage.setItem', async () => {
    const { result } = renderHook(() => usePinPreference('friend-3'));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    await act(async () => {
      await result.current.togglePin(true);
    });

    expect(result.current.pinEnabled).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('pin_pref_friend-3', 'true');
  });

  it('togglePin(false) updates state and persists false', async () => {
    AsyncStorage.getItem.mockImplementation(key => {
      if (key === 'pin_pref_friend-4') return Promise.resolve('true');
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => usePinPreference('friend-4'));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.pinEnabled).toBe(true);

    await act(async () => {
      await result.current.togglePin(false);
    });

    expect(result.current.pinEnabled).toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('pin_pref_friend-4', 'false');
  });

  it('uses correct key format: pin_pref_{friendId}', async () => {
    const { result } = renderHook(() => usePinPreference('abc-123'));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(AsyncStorage.getItem).toHaveBeenCalledWith('pin_pref_abc-123');
  });

  it('showTooltip is true when pin_tooltip_shown has no value', async () => {
    const { result } = renderHook(() => usePinPreference('friend-5'));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.showTooltip).toBe(true);
  });

  it('showTooltip is false when pin_tooltip_shown is "true"', async () => {
    AsyncStorage.getItem.mockImplementation(key => {
      if (key === 'pin_tooltip_shown') return Promise.resolve('true');
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => usePinPreference('friend-6'));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.showTooltip).toBe(false);
  });

  it('dismissTooltip() sets showTooltip to false and persists to AsyncStorage', async () => {
    const { result } = renderHook(() => usePinPreference('friend-7'));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.showTooltip).toBe(true);

    await act(async () => {
      await result.current.dismissTooltip();
    });

    expect(result.current.showTooltip).toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('pin_tooltip_shown', 'true');
  });

  it('changing friendId reloads the preference for the new friend', async () => {
    AsyncStorage.getItem.mockImplementation(key => {
      if (key === 'pin_pref_friend-A') return Promise.resolve('true');
      if (key === 'pin_pref_friend-B') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const { result, rerender } = renderHook(({ friendId }) => usePinPreference(friendId), {
      initialProps: { friendId: 'friend-A' },
    });

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.pinEnabled).toBe(true);

    rerender({ friendId: 'friend-B' });

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.pinEnabled).toBe(false);
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('pin_pref_friend-B');
  });
});
