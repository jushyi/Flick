/**
 * Barrel export for component style files
 *
 * Style File Pattern:
 * - Style files are named: ComponentName.styles.js
 * - Each exports a `styles` object from StyleSheet.create()
 * - Style files import design tokens from src/constants/ (colors, spacing, typography)
 * - Components import styles: import { styles } from '../styles/ComponentName.styles'
 *
 * Example:
 *   // src/styles/MyComponent.styles.js
 *   import { StyleSheet } from 'react-native';
 *   import { colors, spacing } from '../constants';
 *
 *   export const styles = StyleSheet.create({
 *     container: { ... },
 *   });
 */

// Style exports will be added as style files are created
export { styles as swipeablePhotoCardStyles } from './SwipeablePhotoCard.styles';
export { styles as cameraScreenStyles } from './CameraScreen.styles';
export { styles as darkroomScreenStyles } from './DarkroomScreen.styles';
