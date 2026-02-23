/**
 * ReadReceiptIndicator Component Unit Tests
 *
 * Tests for the read receipt indicator display logic:
 * - Shows "Delivered" when isRead is false
 * - Shows "Read [time]" when isRead is true with readAt timestamp
 * - Hidden when visible is false
 * - Edge case: isRead true but visible false stays hidden
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';

// Mock date-fns format to return deterministic time
const mockFormat = jest.fn(() => '2:45 PM');
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

const ReadReceiptIndicator = require('../../src/components/ReadReceiptIndicator').default;

describe('ReadReceiptIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "Delivered" when isRead is false', () => {
    render(<ReadReceiptIndicator isRead={false} visible={true} />);
    expect(screen.getByText('Delivered')).toBeTruthy();
  });

  it('renders "Read [time]" when isRead is true and readAt is provided', () => {
    const readAt = { toDate: () => new Date('2026-02-23T14:45:00Z') };
    render(<ReadReceiptIndicator isRead={true} readAt={readAt} visible={true} />);
    expect(screen.getByText('Read 2:45 PM')).toBeTruthy();
  });

  it('renders nothing visible when visible is false', () => {
    const { toJSON } = render(<ReadReceiptIndicator isRead={false} visible={false} />);
    // When visible is false, the component should not render meaningful content
    // The container should have opacity 0
    const tree = toJSON();
    if (tree) {
      // Check that opacity is 0 on the container
      const style = Array.isArray(tree.props?.style) ? tree.props.style : [tree.props?.style];
      const hasZeroOpacity = style.some(
        s => s && (s.opacity === 0 || (s.opacity && s.opacity._value === 0))
      );
      expect(hasZeroOpacity || tree === null).toBeTruthy();
    }
  });

  it('shows nothing when isRead is true but visible is false', () => {
    const readAt = { toDate: () => new Date('2026-02-23T14:45:00Z') };
    const { toJSON } = render(
      <ReadReceiptIndicator isRead={true} readAt={readAt} visible={false} />
    );
    const tree = toJSON();
    if (tree) {
      const style = Array.isArray(tree.props?.style) ? tree.props.style : [tree.props?.style];
      const hasZeroOpacity = style.some(
        s => s && (s.opacity === 0 || (s.opacity && s.opacity._value === 0))
      );
      expect(hasZeroOpacity || tree === null).toBeTruthy();
    }
  });
});
