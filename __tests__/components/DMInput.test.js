/**
 * DMInput Component Unit Tests
 *
 * Tests for the camera/send button morph behavior:
 * - Camera button rendered when text input is empty and no media
 * - Send arrow rendered when text input has content
 * - Camera button press calls onOpenSnapCamera callback
 * - Send button press calls onSend callback
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

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
const MockPixelIcon = ({ name, testID }) => {
  const { Text } = require('react-native');
  return <Text testID={testID || `pixel-icon-${name}`}>{name}</Text>;
};
MockPixelIcon.displayName = 'MockPixelIcon';
jest.mock('../../src/components/PixelIcon', () => MockPixelIcon);

// Mock ReplyPreview
jest.mock('../../src/components/ReplyPreview', () => {
  const { View } = require('react-native');
  return function MockReplyPreview() {
    return <View testID="reply-preview" />;
  };
});

// Mock GifPicker
jest.mock('../../src/components/comments/GifPicker', () => ({
  openGifPicker: jest.fn(),
  useGifSelection: jest.fn(),
}));

// Mock expo-image
jest.mock('expo-image', () => ({
  Image: 'MockImage',
}));

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: [] })),
  MediaTypeOptions: { Images: 'Images' },
}));

// Mock storageService
jest.mock('../../src/services/firebase/storageService', () => ({
  uploadCommentImage: jest.fn(() => Promise.resolve('https://mock-url.com/image.jpg')),
}));

// Mock safe area
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const DMInput = require('../../src/components/DMInput').default;

describe('DMInput', () => {
  const defaultProps = {
    onSendMessage: jest.fn(),
    onSend: jest.fn(),
    onOpenSnapCamera: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('camera/send button morph', () => {
    it('shows camera button when text input is empty and no media selected', () => {
      render(<DMInput {...defaultProps} />);
      expect(screen.getByTestId('camera-button')).toBeTruthy();
      expect(screen.queryByTestId('send-button')).toBeNull();
    });

    it('shows send arrow when text input has content', () => {
      render(<DMInput {...defaultProps} />);

      const input = screen.getByPlaceholderText('Message...');
      fireEvent.changeText(input, 'Hello world');

      expect(screen.getByTestId('send-button')).toBeTruthy();
      expect(screen.queryByTestId('camera-button')).toBeNull();
    });

    it('calls onOpenSnapCamera when camera button is pressed', () => {
      const onOpenSnapCamera = jest.fn();
      render(<DMInput {...defaultProps} onOpenSnapCamera={onOpenSnapCamera} />);

      const cameraButton = screen.getByTestId('camera-button');
      fireEvent.press(cameraButton);

      expect(onOpenSnapCamera).toHaveBeenCalledTimes(1);
    });

    it('calls onSend after send button press with text', async () => {
      const onSendMessage = jest.fn();
      const onSend = jest.fn();
      render(<DMInput {...defaultProps} onSendMessage={onSendMessage} onSend={onSend} />);

      const input = screen.getByPlaceholderText('Message...');
      fireEvent.changeText(input, 'Test message');

      const sendButton = screen.getByTestId('send-button');
      fireEvent.press(sendButton);

      expect(onSendMessage).toHaveBeenCalledWith('Test message', null, null);
    });

    it('does not show camera button when disabled', () => {
      render(<DMInput {...defaultProps} disabled />);
      expect(screen.queryByTestId('camera-button')).toBeNull();
      expect(screen.queryByTestId('send-button')).toBeNull();
    });

    it('does not show camera button when onOpenSnapCamera is not provided', () => {
      render(<DMInput onSendMessage={jest.fn()} onSend={jest.fn()} />);
      expect(screen.queryByTestId('camera-button')).toBeNull();
    });
  });
});
