/**
 * StreakIndicator Component Unit Tests
 *
 * Tests for the streak-aware snap icon component in all 5 visual states:
 * - default:  Muted gray icon, no overlay
 * - building: Warm tint icon, no overlay
 * - pending:  Warm tint icon, no overlay
 * - active:   Tier-colored icon + day count overlay
 * - warning:  Red icon + "!" overlay
 * - Size prop forwarding and custom sizes
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';

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

// Track PixelIcon props for assertions
let lastPixelIconProps = null;
const MockPixelIcon = props => {
  lastPixelIconProps = props;
  const { Text } = require('react-native');
  return (
    <Text testID={`pixel-icon-${props.name}`}>{`${props.name}:${props.color}:${props.size}`}</Text>
  );
};
MockPixelIcon.displayName = 'MockPixelIcon';
jest.mock('../../src/components/PixelIcon', () => MockPixelIcon);

// Mock getStreakColor with real return values based on state
const mockGetStreakColor = jest.fn((state, dayCount) => {
  if (state === 'warning') return '#FF3333';
  if (state === 'active') {
    if (dayCount >= 50) return '#E65100';
    if (dayCount >= 10) return '#FF8C00';
    return '#F5A623';
  }
  if (state === 'pending') return '#D4A574';
  if (state === 'building') return '#D4A574';
  return '#7B7B9E';
});

jest.mock('../../src/services/firebase/streakService', () => ({
  getStreakColor: (...args) => mockGetStreakColor(...args),
}));

// Mock Firestore (required by transitive dependency)
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  onSnapshot: jest.fn(),
}));

const StreakIndicator = require('../../src/components/StreakIndicator').default;

describe('StreakIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastPixelIconProps = null;
  });

  // ================================================================
  // Basic rendering
  // ================================================================
  it('renders PixelIcon with snap-polaroid name', () => {
    render(<StreakIndicator />);
    expect(screen.getByTestId('pixel-icon-snap-polaroid')).toBeTruthy();
  });

  it('passes correct default color (muted gray) when no streakState prop', () => {
    render(<StreakIndicator />);
    expect(mockGetStreakColor).toHaveBeenCalledWith('default', 0);
    expect(lastPixelIconProps.color).toBe('#7B7B9E');
  });

  // ================================================================
  // Color per state
  // ================================================================
  it('passes building color when streakState is building', () => {
    render(<StreakIndicator streakState="building" />);
    expect(mockGetStreakColor).toHaveBeenCalledWith('building', 0);
    expect(lastPixelIconProps.color).toBe('#D4A574');
  });

  it('passes pending color when streakState is pending', () => {
    render(<StreakIndicator streakState="pending" />);
    expect(mockGetStreakColor).toHaveBeenCalledWith('pending', 0);
    expect(lastPixelIconProps.color).toBe('#D4A574');
  });

  it('passes warning color (red) for warning streakState', () => {
    render(<StreakIndicator streakState="warning" dayCount={10} />);
    expect(mockGetStreakColor).toHaveBeenCalledWith('warning', 10);
    expect(lastPixelIconProps.color).toBe('#FF3333');
  });

  it('passes light amber for active day 3', () => {
    render(<StreakIndicator streakState="active" dayCount={3} />);
    expect(mockGetStreakColor).toHaveBeenCalledWith('active', 3);
    expect(lastPixelIconProps.color).toBe('#F5A623');
  });

  it('passes orange for active day 15', () => {
    render(<StreakIndicator streakState="active" dayCount={15} />);
    expect(mockGetStreakColor).toHaveBeenCalledWith('active', 15);
    expect(lastPixelIconProps.color).toBe('#FF8C00');
  });

  it('passes deep orange for active day 50', () => {
    render(<StreakIndicator streakState="active" dayCount={50} />);
    expect(mockGetStreakColor).toHaveBeenCalledWith('active', 50);
    expect(lastPixelIconProps.color).toBe('#E65100');
  });

  // ================================================================
  // Overlay text visibility
  // ================================================================
  it('does NOT render overlay text for default state', () => {
    render(<StreakIndicator streakState="default" />);
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryByText('!')).toBeNull();
  });

  it('does NOT render overlay text for building state', () => {
    render(<StreakIndicator streakState="building" />);
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryByText('!')).toBeNull();
  });

  it('does NOT render overlay text for pending state', () => {
    render(<StreakIndicator streakState="pending" />);
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryByText('!')).toBeNull();
  });

  it('renders day count text for active state', () => {
    render(<StreakIndicator streakState="active" dayCount={5} />);
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('renders correct day count number (e.g., "5" for dayCount=5)', () => {
    render(<StreakIndicator streakState="active" dayCount={5} />);
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('renders "!" for warning state', () => {
    render(<StreakIndicator streakState="warning" dayCount={10} />);
    expect(screen.getByText('!')).toBeTruthy();
  });

  // ================================================================
  // Size prop
  // ================================================================
  it('uses size prop for icon size (default 18)', () => {
    render(<StreakIndicator />);
    expect(lastPixelIconProps.size).toBe(18);
  });

  it('renders with custom size (e.g., 22 for DMInput)', () => {
    render(<StreakIndicator size={22} />);
    expect(lastPixelIconProps.size).toBe(22);
  });
});
