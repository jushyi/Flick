/**
 * usePinPreference Hook Unit Tests
 *
 * Tests for the pin preference hook including:
 * - Default state when no stored preference exists
 * - Loading stored preference from AsyncStorage
 * - Toggle pin state and persistence
 * - Correct key format: pin_pref_{friendId}
 * - Tooltip shown state management
 * - Tooltip dismissal and persistence
 * - Reloading preference when friendId changes
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import usePinPreference from '../../src/hooks/usePinPreference';

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
    AsyncStorage.getItem.mockResolvedValue(null);

    const { result } = renderHook(() => usePinPreference('friend-123'));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.pinEnabled).toBe(false);
  });

  it('returns pinEnabled: true when AsyncStorage has "true" for the friend', async () => {
    AsyncStorage.getItem.mockImplementation(key => {
      if (key === 'pin_pref_friend-abc') return Promise.resolve('true');
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => usePinPreference('friend-abc'));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.pinEnabled).toBe(true);
  });

  it('togglePin(true) updates state and calls AsyncStorage.setItem', async () => {
    const { result } = renderHook(() => usePinPreference('friend-123'));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    await act(async () => {
      await result.current.togglePin(true);
    });

    expect(result.current.pinEnabled).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('pin_pref_friend-123', 'true');
  });

  it('togglePin(false) updates state and persists false', async () => {
    AsyncStorage.getItem.mockImplementation(key => {
      if (key === 'pin_pref_friend-123') return Promise.resolve('true');
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => usePinPreference('friend-123'));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.pinEnabled).toBe(true);

    await act(async () => {
      await result.current.togglePin(false);
    });

    expect(result.current.pinEnabled).toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('pin_pref_friend-123', 'false');
  });

  it('uses correct key format: pin_pref_{friendId}', async () => {
    const { result } = renderHook(() => usePinPreference('user-xyz-456'));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(AsyncStorage.getItem).toHaveBeenCalledWith('pin_pref_user-xyz-456');
  });

  it('showTooltip is true when pin_tooltip_shown has no value', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);

    const { result } = renderHook(() => usePinPreference('friend-123'));

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

    const { result } = renderHook(() => usePinPreference('friend-123'));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.showTooltip).toBe(false);
  });

  it('dismissTooltip() sets showTooltip to false and persists to AsyncStorage', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);

    const { result } = renderHook(() => usePinPreference('friend-123'));

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

    const { result, rerender } = renderHook(({ id }) => usePinPreference(id), {
      initialProps: { id: 'friend-A' },
    });

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.pinEnabled).toBe(true);

    rerender({ id: 'friend-B' });

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
      expect(result.current.pinEnabled).toBe(false);
    });

    expect(AsyncStorage.getItem).toHaveBeenCalledWith('pin_pref_friend-B');
  });
});
