/**
 * useStreak and useStreakMap Hook Unit Tests
 *
 * Tests for streak hooks including:
 * - Subscription setup and cleanup
 * - State derivation from streak data
 * - Color derivation from state and dayCount
 * - Local countdown timer with expiry detection
 * - Null/undefined userId guard
 * - Batch streak map population
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

import { useStreak, useStreakMap } from '../../src/hooks/useStreaks';

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

// Mock streakService
const mockSubscribeToStreak = jest.fn();
const mockSubscribeToUserStreaks = jest.fn();
const mockDeriveStreakState = jest.fn();
const mockGetStreakColor = jest.fn();

jest.mock('../../src/services/firebase/streakService', () => ({
  subscribeToStreak: (...args) => mockSubscribeToStreak(...args),
  subscribeToUserStreaks: (...args) => mockSubscribeToUserStreaks(...args),
  deriveStreakState: (...args) => mockDeriveStreakState(...args),
  getStreakColor: (...args) => mockGetStreakColor(...args),
}));

describe('useStreak', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockDeriveStreakState.mockReturnValue('default');
    mockGetStreakColor.mockReturnValue('#666666');
  });

  it('subscribes to streak on mount with correct userId pair', () => {
    const mockUnsubscribe = jest.fn();
    mockSubscribeToStreak.mockReturnValue(mockUnsubscribe);

    renderHook(() => useStreak('userA', 'userB'));

    expect(mockSubscribeToStreak).toHaveBeenCalledTimes(1);
    expect(mockSubscribeToStreak).toHaveBeenCalledWith('userA', 'userB', expect.any(Function));
  });

  it('returns null streakData and default state initially', () => {
    mockSubscribeToStreak.mockReturnValue(jest.fn());

    const { result } = renderHook(() => useStreak('userA', 'userB'));

    expect(result.current.streakData).toBeNull();
    expect(result.current.streakState).toBe('default');
    expect(result.current.dayCount).toBe(0);
    expect(result.current.timeRemaining).toBeNull();
    expect(result.current.isExpired).toBe(false);
  });

  it('updates streakData when subscription fires', () => {
    let subscriptionCallback;
    mockSubscribeToStreak.mockImplementation((uid1, uid2, cb) => {
      subscriptionCallback = cb;
      return jest.fn();
    });

    const { result } = renderHook(() => useStreak('userA', 'userB'));

    const mockData = {
      id: 'userA_userB',
      dayCount: 5,
      participants: ['userA', 'userB'],
      warning: false,
    };

    act(() => {
      subscriptionCallback(mockData);
    });

    expect(result.current.streakData).toEqual(mockData);
  });

  it('derives streakState from streakData and currentUserId', () => {
    let subscriptionCallback;
    mockSubscribeToStreak.mockImplementation((uid1, uid2, cb) => {
      subscriptionCallback = cb;
      return jest.fn();
    });
    mockDeriveStreakState.mockReturnValue('active');

    const { result } = renderHook(() => useStreak('userA', 'userB'));

    const mockData = { dayCount: 5, participants: ['userA', 'userB'] };

    act(() => {
      subscriptionCallback(mockData);
    });

    expect(mockDeriveStreakState).toHaveBeenCalledWith(mockData, 'userA');
    expect(result.current.streakState).toBe('active');
  });

  it('derives streakColor from streakState and dayCount', () => {
    let subscriptionCallback;
    mockSubscribeToStreak.mockImplementation((uid1, uid2, cb) => {
      subscriptionCallback = cb;
      return jest.fn();
    });
    mockDeriveStreakState.mockReturnValue('active');
    mockGetStreakColor.mockReturnValue('#FF8C00');

    const { result } = renderHook(() => useStreak('userA', 'userB'));

    const mockData = { dayCount: 15, participants: ['userA', 'userB'] };

    act(() => {
      subscriptionCallback(mockData);
    });

    expect(mockGetStreakColor).toHaveBeenCalledWith('active', 15);
    expect(result.current.streakColor).toBe('#FF8C00');
  });

  it('returns dayCount from streakData', () => {
    let subscriptionCallback;
    mockSubscribeToStreak.mockImplementation((uid1, uid2, cb) => {
      subscriptionCallback = cb;
      return jest.fn();
    });

    const { result } = renderHook(() => useStreak('userA', 'userB'));

    act(() => {
      subscriptionCallback({ dayCount: 42, participants: ['userA', 'userB'] });
    });

    expect(result.current.dayCount).toBe(42);
  });

  it('cleans up subscription on unmount', () => {
    const mockUnsubscribe = jest.fn();
    mockSubscribeToStreak.mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() => useStreak('userA', 'userB'));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe when currentUserId is null', () => {
    renderHook(() => useStreak(null, 'userB'));

    expect(mockSubscribeToStreak).not.toHaveBeenCalled();
  });

  it('does not subscribe when friendId is null', () => {
    renderHook(() => useStreak('userA', null));

    expect(mockSubscribeToStreak).not.toHaveBeenCalled();
  });

  it('computes timeRemaining from expiresAt', () => {
    jest.useFakeTimers();
    const now = Date.now();
    jest.setSystemTime(now);

    let subscriptionCallback;
    mockSubscribeToStreak.mockImplementation((uid1, uid2, cb) => {
      subscriptionCallback = cb;
      return jest.fn();
    });

    const { result } = renderHook(() => useStreak('userA', 'userB'));

    const futureMs = now + 3600000; // 1 hour from now
    const mockData = {
      dayCount: 5,
      participants: ['userA', 'userB'],
      expiresAt: {
        toMillis: () => futureMs,
      },
    };

    act(() => {
      subscriptionCallback(mockData);
    });

    // timeRemaining should be approximately 3600000ms
    expect(result.current.timeRemaining).toBe(3600000);
    expect(result.current.isExpired).toBe(false);

    jest.useRealTimers();
  });

  it('sets isExpired=true when timeRemaining <= 0 (local countdown)', () => {
    jest.useFakeTimers();
    const now = Date.now();
    jest.setSystemTime(now);

    let subscriptionCallback;
    mockSubscribeToStreak.mockImplementation((uid1, uid2, cb) => {
      subscriptionCallback = cb;
      return jest.fn();
    });

    const { result } = renderHook(() => useStreak('userA', 'userB'));

    // expiresAt is in the past
    const pastMs = now - 1000;
    const mockData = {
      dayCount: 5,
      participants: ['userA', 'userB'],
      expiresAt: {
        toMillis: () => pastMs,
      },
    };

    act(() => {
      subscriptionCallback(mockData);
    });

    expect(result.current.timeRemaining).toBe(0);
    expect(result.current.isExpired).toBe(true);

    jest.useRealTimers();
  });
});

describe('useStreakMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeriveStreakState.mockReturnValue('default');
    mockGetStreakColor.mockReturnValue('#666666');
  });

  it('subscribes to user streaks on mount', () => {
    const mockUnsubscribe = jest.fn();
    mockSubscribeToUserStreaks.mockReturnValue(mockUnsubscribe);

    renderHook(() => useStreakMap('userA'));

    expect(mockSubscribeToUserStreaks).toHaveBeenCalledTimes(1);
    expect(mockSubscribeToUserStreaks).toHaveBeenCalledWith('userA', expect.any(Function));
  });

  it('returns empty streakMap initially', () => {
    mockSubscribeToUserStreaks.mockReturnValue(jest.fn());

    const { result } = renderHook(() => useStreakMap('userA'));

    expect(result.current.streakMap).toEqual({});
    expect(result.current.loading).toBe(true);
  });

  it('populates streakMap when subscription fires with streak array', () => {
    let subscriptionCallback;
    mockSubscribeToUserStreaks.mockImplementation((uid, cb) => {
      subscriptionCallback = cb;
      return jest.fn();
    });
    mockDeriveStreakState.mockReturnValue('active');
    mockGetStreakColor.mockReturnValue('#F5A623');

    const { result } = renderHook(() => useStreakMap('userA'));

    const mockStreaks = [
      {
        id: 'userA_userB',
        dayCount: 5,
        participants: ['userA', 'userB'],
        expiresAt: { toMillis: () => Date.now() + 86400000 },
        warning: false,
      },
      {
        id: 'userA_userC',
        dayCount: 10,
        participants: ['userA', 'userC'],
        expiresAt: { toMillis: () => Date.now() + 172800000 },
        warning: true,
      },
    ];

    act(() => {
      subscriptionCallback(mockStreaks);
    });

    expect(Object.keys(result.current.streakMap)).toHaveLength(2);
    expect(result.current.streakMap['userA_userB']).toBeDefined();
    expect(result.current.streakMap['userA_userB'].dayCount).toBe(5);
    expect(result.current.streakMap['userA_userC']).toBeDefined();
    expect(result.current.streakMap['userA_userC'].dayCount).toBe(10);
    expect(result.current.loading).toBe(false);
  });

  it('derives streakState for each streak in map', () => {
    let subscriptionCallback;
    mockSubscribeToUserStreaks.mockImplementation((uid, cb) => {
      subscriptionCallback = cb;
      return jest.fn();
    });
    mockDeriveStreakState.mockReturnValueOnce('active').mockReturnValueOnce('warning');
    mockGetStreakColor.mockReturnValueOnce('#F5A623').mockReturnValueOnce('#FF0000');

    const { result } = renderHook(() => useStreakMap('userA'));

    act(() => {
      subscriptionCallback([
        { id: 'userA_userB', dayCount: 5, participants: ['userA', 'userB'] },
        { id: 'userA_userC', dayCount: 3, participants: ['userA', 'userC'], warning: true },
      ]);
    });

    expect(result.current.streakMap['userA_userB'].streakState).toBe('active');
    expect(result.current.streakMap['userA_userB'].streakColor).toBe('#F5A623');
    expect(result.current.streakMap['userA_userC'].streakState).toBe('warning');
    expect(result.current.streakMap['userA_userC'].streakColor).toBe('#FF0000');
  });

  it('cleans up subscription on unmount', () => {
    const mockUnsubscribe = jest.fn();
    mockSubscribeToUserStreaks.mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() => useStreakMap('userA'));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe when userId is null', () => {
    const { result } = renderHook(() => useStreakMap(null));

    expect(mockSubscribeToUserStreaks).not.toHaveBeenCalled();
    expect(result.current.streakMap).toEqual({});
    expect(result.current.loading).toBe(false);
  });

  it('handles empty streak array', () => {
    let subscriptionCallback;
    mockSubscribeToUserStreaks.mockImplementation((uid, cb) => {
      subscriptionCallback = cb;
      return jest.fn();
    });

    const { result } = renderHook(() => useStreakMap('userA'));

    act(() => {
      subscriptionCallback([]);
    });

    expect(result.current.streakMap).toEqual({});
    expect(result.current.loading).toBe(false);
  });
});
