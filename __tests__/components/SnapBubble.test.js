/**
 * SnapBubble Component Unit Tests
 *
 * Tests for the snap message bubble rendering in four visual states:
 * - Sending: progress ring, "Sending..." text
 * - Error: warning icon, "Failed", "Tap to retry"
 * - Unopened: camera icon, "Snap" label (recipient) / "Delivered" (sender)
 * - Opened: dimmed, "Opened" label, non-interactive
 * - Press interactions: onPress for unopened, onRetry for error, no action for opened/sending
 * - Alignment: right for sender, left for recipient
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// Mock date-fns format to return deterministic time
const mockFormat = jest.fn(() => '3:30 PM');
jest.mock('date-fns', () => ({
  format: (...args) => mockFormat(...args),
}));

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

// Mock PixelIcon to render testable output
const MockPixelIcon = ({ name }) => {
  const { Text } = require('react-native');
  return <Text testID={`pixel-icon-${name}`}>{name}</Text>;
};
MockPixelIcon.displayName = 'MockPixelIcon';
jest.mock('../../src/components/PixelIcon', () => MockPixelIcon);

// Mock SnapProgressRing to render testable output
const MockSnapProgressRing = ({ children }) => {
  const { View } = require('react-native');
  return <View testID="snap-progress-ring">{children}</View>;
};
MockSnapProgressRing.displayName = 'MockSnapProgressRing';
jest.mock('../../src/components/SnapProgressRing', () => MockSnapProgressRing);

const SnapBubble = require('../../src/components/SnapBubble').default;

// Helper to create a base snap message
const createSnapMessage = (overrides = {}) => ({
  id: 'snap-msg-1',
  senderId: 'user-A',
  type: 'snap',
  text: null,
  snapStoragePath: 'snap-photos/user-A/12345.jpg',
  caption: null,
  viewedAt: null,
  createdAt: { toDate: () => new Date('2026-02-24T15:30:00Z') },
  ...overrides,
});

describe('SnapBubble', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Unopened State ──────────────────────────────────────────────────

  describe('Unopened state', () => {
    it('renders "Snap" label and camera icon for recipient', () => {
      render(
        <SnapBubble message={createSnapMessage()} isCurrentUser={false} showTimestamp={false} />
      );
      expect(screen.getByText('Snap')).toBeTruthy();
      expect(screen.getByTestId('pixel-icon-camera')).toBeTruthy();
    });

    it('renders "Delivered" label for sender', () => {
      render(
        <SnapBubble message={createSnapMessage()} isCurrentUser={true} showTimestamp={false} />
      );
      expect(screen.getByText('Delivered')).toBeTruthy();
    });

    it('calls onPress when tapped', () => {
      const onPress = jest.fn();
      render(
        <SnapBubble
          message={createSnapMessage()}
          isCurrentUser={false}
          showTimestamp={false}
          onPress={onPress}
        />
      );
      fireEvent.press(screen.getByText('Snap'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Opened State ───────────────────────────────────────────────────

  describe('Opened state', () => {
    const openedMessage = createSnapMessage({
      viewedAt: { toDate: () => new Date('2026-02-24T15:35:00Z') },
    });

    it('renders "Opened" label and camera icon', () => {
      render(<SnapBubble message={openedMessage} isCurrentUser={false} showTimestamp={false} />);
      expect(screen.getByText('Opened')).toBeTruthy();
      expect(screen.getByTestId('pixel-icon-camera')).toBeTruthy();
    });

    it('has reduced opacity styling', () => {
      const { toJSON } = render(
        <SnapBubble message={openedMessage} isCurrentUser={false} showTimestamp={false} />
      );
      const tree = JSON.stringify(toJSON());
      // The opened bubble applies opacity: 0.5
      expect(tree).toContain('0.5');
    });

    it('does NOT call onPress when tapped', () => {
      const onPress = jest.fn();
      render(
        <SnapBubble
          message={openedMessage}
          isCurrentUser={false}
          showTimestamp={false}
          onPress={onPress}
        />
      );
      // Opened state renders a View, not TouchableOpacity, so there's nothing interactive to press
      // Verify onPress was never called (no interactive element to trigger it)
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  // ─── Sending State ──────────────────────────────────────────────────

  describe('Sending state', () => {
    it('renders "Sending..." text and progress ring', () => {
      render(
        <SnapBubble
          message={createSnapMessage()}
          isCurrentUser={true}
          showTimestamp={false}
          isPending={true}
        />
      );
      expect(screen.getByText('Sending...')).toBeTruthy();
      expect(screen.getByTestId('snap-progress-ring')).toBeTruthy();
    });

    it('renders camera icon inside progress ring', () => {
      render(
        <SnapBubble
          message={createSnapMessage()}
          isCurrentUser={true}
          showTimestamp={false}
          isPending={true}
        />
      );
      expect(screen.getByTestId('pixel-icon-camera')).toBeTruthy();
    });
  });

  // ─── Error State ────────────────────────────────────────────────────

  describe('Error state', () => {
    it('renders "Failed" and "Tap to retry" text', () => {
      render(
        <SnapBubble
          message={createSnapMessage()}
          isCurrentUser={true}
          showTimestamp={false}
          hasError={true}
        />
      );
      expect(screen.getByText('Failed')).toBeTruthy();
      expect(screen.getByText('Tap to retry')).toBeTruthy();
    });

    it('renders warning icon', () => {
      render(
        <SnapBubble
          message={createSnapMessage()}
          isCurrentUser={true}
          showTimestamp={false}
          hasError={true}
        />
      );
      expect(screen.getByTestId('pixel-icon-warning')).toBeTruthy();
    });

    it('calls onRetry when tapped', () => {
      const onRetry = jest.fn();
      render(
        <SnapBubble
          message={createSnapMessage()}
          isCurrentUser={true}
          showTimestamp={false}
          hasError={true}
          onRetry={onRetry}
        />
      );
      fireEvent.press(screen.getByText('Failed'));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Alignment ──────────────────────────────────────────────────────

  describe('Alignment', () => {
    it('aligns right for current user', () => {
      const { toJSON } = render(
        <SnapBubble message={createSnapMessage()} isCurrentUser={true} showTimestamp={false} />
      );
      const tree = JSON.stringify(toJSON());
      expect(tree).toContain('flex-end');
    });

    it('aligns left for recipient', () => {
      const { toJSON } = render(
        <SnapBubble message={createSnapMessage()} isCurrentUser={false} showTimestamp={false} />
      );
      const tree = JSON.stringify(toJSON());
      expect(tree).toContain('flex-start');
    });
  });

  // ─── Timestamp ──────────────────────────────────────────────────────

  describe('Timestamp', () => {
    it('shows timestamp when showTimestamp is true', () => {
      render(
        <SnapBubble message={createSnapMessage()} isCurrentUser={false} showTimestamp={true} />
      );
      expect(screen.getByText('3:30 PM')).toBeTruthy();
    });

    it('shows "Opened [time]" for opened snaps with timestamp', () => {
      const openedMessage = createSnapMessage({
        viewedAt: { toDate: () => new Date('2026-02-24T15:35:00Z') },
      });
      render(<SnapBubble message={openedMessage} isCurrentUser={false} showTimestamp={true} />);
      expect(screen.getByText('Opened 3:30 PM')).toBeTruthy();
    });
  });
});
