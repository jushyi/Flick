/**
 * TaggedPhotoBubble Component Tests
 *
 * Tests for the tagged photo message card rendering in DM conversations.
 * Covers: photo rendering, header text variants, button states,
 * no-caption display, press handlers, and reaction badges.
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

import TaggedPhotoBubble from '../../src/components/TaggedPhotoBubble';

// Mock expo-image
jest.mock('expo-image', () => ({
  Image: 'Image',
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'Light',
    Medium: 'Medium',
    Heavy: 'Heavy',
  },
}));

// Mock PixelIcon
jest.mock('../../src/components/PixelIcon', () => 'PixelIcon');

// Mock ReactionBadges
jest.mock('../../src/components/ReactionBadges', () => {
  const { View } = require('react-native');
  return function MockReactionBadges(props) {
    return <View testID="reaction-badges" {...props} />;
  };
});

// Mock photoTagService
const mockAddTaggedPhotoToFeed = jest.fn();
jest.mock('../../src/services/firebase/photoTagService', () => ({
  addTaggedPhotoToFeed: (...args) => mockAddTaggedPhotoToFeed(...args),
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock date-fns format
jest.mock('date-fns', () => ({
  format: jest.fn(() => '3:45 PM'),
}));

const baseMessage = {
  id: 'msg-123',
  type: 'tagged_photo',
  senderId: 'sender-user',
  photoId: 'photo-456',
  photoURL: 'https://example.com/photo.jpg',
  photoOwnerId: 'owner-789',
  createdAt: { toDate: () => new Date('2026-02-24T15:45:00Z') },
};

const defaultProps = {
  message: baseMessage,
  isCurrentUser: false,
  showTimestamp: false,
  onPress: jest.fn(),
  reactions: null,
  onReactionPress: jest.fn(),
  currentUserId: 'current-user-id',
  conversationId: 'conv-abc',
};

describe('TaggedPhotoBubble', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddTaggedPhotoToFeed.mockResolvedValue({ success: true, newPhotoId: 'new-photo-id' });
  });

  it('renders photo card with tagged photo image', () => {
    const { UNSAFE_getAllByType } = render(<TaggedPhotoBubble {...defaultProps} />);

    // expo-image is mocked as 'Image' string component
    const images = UNSAFE_getAllByType('Image');
    expect(images.length).toBeGreaterThan(0);

    // Verify the image source contains the photo URL
    const photoImage = images.find(
      img => img.props.source?.uri === 'https://example.com/photo.jpg'
    );
    expect(photoImage).toBeDefined();
    expect(photoImage.props.cachePolicy).toBe('memory-disk');
    expect(photoImage.props.contentFit).toBe('cover');
  });

  it('shows "Tagged you in a photo" header for recipient', () => {
    const { getByText } = render(<TaggedPhotoBubble {...defaultProps} isCurrentUser={false} />);

    expect(getByText('Tagged you in a photo')).toBeTruthy();
  });

  it('shows sender header text for current user', () => {
    const { getByText } = render(<TaggedPhotoBubble {...defaultProps} isCurrentUser={true} />);

    expect(getByText('You tagged in a photo')).toBeTruthy();
  });

  it('shows "Add to feed" button for recipient only', () => {
    // Recipient (not current user) should see the button
    const { getByText: getByTextRecipient } = render(
      <TaggedPhotoBubble {...defaultProps} isCurrentUser={false} />
    );
    expect(getByTextRecipient('Add to feed')).toBeTruthy();

    // Sender (current user) should NOT see the button
    const { queryByText } = render(<TaggedPhotoBubble {...defaultProps} isCurrentUser={true} />);
    expect(queryByText('Add to feed')).toBeNull();
    expect(queryByText('Added to feed')).toBeNull();
  });

  it('shows "Added to feed" disabled state when addedToFeedBy includes current user', () => {
    const messageWithAdded = {
      ...baseMessage,
      addedToFeedBy: { 'current-user-id': 'new-photo-id' },
    };

    const { getByText, getByLabelText } = render(
      <TaggedPhotoBubble {...defaultProps} message={messageWithAdded} isCurrentUser={false} />
    );

    expect(getByText('Added to feed')).toBeTruthy();
    expect(getByLabelText('Added to feed').props.accessibilityRole).toBe('button');
  });

  it('does NOT show caption text', () => {
    const messageWithCaption = {
      ...baseMessage,
      caption: 'This is a caption that should not appear',
      text: 'Some text that should not appear',
    };

    const { queryByText } = render(
      <TaggedPhotoBubble {...defaultProps} message={messageWithCaption} />
    );

    expect(queryByText('This is a caption that should not appear')).toBeNull();
    expect(queryByText('Some text that should not appear')).toBeNull();
  });

  it('calls onPress when photo card is tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<TaggedPhotoBubble {...defaultProps} onPress={onPress} />);

    // Tap the header area (which is inside the TouchableOpacity wrapping the card)
    fireEvent.press(getByText('Tagged you in a photo'));

    expect(onPress).toHaveBeenCalledWith(baseMessage);
  });

  it('renders ReactionBadges when reactions exist', () => {
    const reactions = {
      heart: [{ senderId: 'user-1', messageId: 'msg-1' }],
    };

    const { getByTestId } = render(<TaggedPhotoBubble {...defaultProps} reactions={reactions} />);

    expect(getByTestId('reaction-badges')).toBeTruthy();
  });
});
