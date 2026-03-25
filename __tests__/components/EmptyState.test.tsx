/**
 * Tests for EmptyState component
 *
 * Verifies pixel art styled empty state with icon, message, and optional CTA.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { EmptyState } from '@/components/EmptyState';

// Mock PixelIcon as a simple View with testID
jest.mock('@/components/PixelIcon', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => (
      <View testID="pixel-icon" {...props} />
    ),
  };
});

describe('EmptyState', () => {
  it('renders PixelIcon with name prop, size 48, color #4D4D6A', () => {
    const { getByTestId } = render(
      <EmptyState icon="camera-outline" message="No photos yet" />
    );

    const icon = getByTestId('pixel-icon');
    expect(icon.props.name).toBe('camera-outline');
    expect(icon.props.size).toBe(48);
    expect(icon.props.color).toBe('#4D4D6A');
  });

  it('renders message text with correct color', () => {
    const { getByText } = render(
      <EmptyState icon="camera-outline" message="No photos yet" />
    );

    const message = getByText('No photos yet');
    expect(message).toBeTruthy();
    // Check the text has the secondary color style
    const style = message.props.style;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flatStyle.color).toBe('#7B7B9E');
  });

  it('renders CTA button when ctaLabel and onCtaPress provided', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <EmptyState
        icon="camera-outline"
        message="No photos yet"
        ctaLabel="Add friends"
        onCtaPress={onPress}
      />
    );

    const cta = getByText('Add friends');
    expect(cta).toBeTruthy();
  });

  it('does NOT render CTA button when ctaLabel is undefined', () => {
    const { queryByTestId, queryByText } = render(
      <EmptyState icon="camera-outline" message="No photos yet" />
    );

    // No CTA text should be present
    expect(queryByText('Add friends')).toBeNull();
  });

  it('CTA onPress fires the onCtaPress callback', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <EmptyState
        icon="camera-outline"
        message="No photos yet"
        ctaLabel="Add friends"
        onCtaPress={onPress}
      />
    );

    fireEvent.press(getByText('Add friends'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('container has justifyContent center and alignItems center', () => {
    const { getByTestId } = render(
      <EmptyState icon="camera-outline" message="No photos yet" />
    );

    // The outermost container should have the centering styles
    const container = getByTestId('empty-state-container');
    const style = container.props.style;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flatStyle.justifyContent).toBe('center');
    expect(flatStyle.alignItems).toBe('center');
  });
});
