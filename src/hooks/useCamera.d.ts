/**
 * Type declarations for useCamera platform-specific modules.
 * Metro resolves useCamera.ios.ts / useCamera.android.ts at runtime;
 * this declaration satisfies TypeScript's module resolution.
 */
export {
  TAB_BAR_HEIGHT,
  FOOTER_HEIGHT,
  CAMERA_HEIGHT,
  CAMERA_BORDER_RADIUS,
  FLOATING_BUTTON_SIZE,
  FLOATING_BUTTON_OFFSET,
  CARD_WIDTH,
  CARD_HEIGHT,
  BASE_ROTATION_PER_CARD,
  BASE_OFFSET_PER_CARD,
  SPREAD_ROTATION_MULTIPLIER,
  SPREAD_OFFSET_MULTIPLIER,
} from './useCameraBase';

declare const useCamera: (options?: {
  mode?: 'normal' | 'snap';
  onSnapCapture?: ((media: { uri: string; mediaType: 'photo' | 'video' }) => void) | null;
}) => any;

export default useCamera;
