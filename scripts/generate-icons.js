/**
 * Generate app icons for Lapse Clone
 * Creates minimalist "L" icon matching brand aesthetic
 */
const sharp = require('sharp');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// Icon configuration
const ICON_SIZE = 1024;
const BACKGROUND_COLOR = '#FFFFFF';
const TEXT_COLOR = '#000000';

// Create SVG for the "L" letter icon
function createLIconSvg(size) {
  // Bold "L" positioned slightly left of center for visual balance
  // Using a modern, bold sans-serif style
  const fontSize = Math.floor(size * 0.55);
  const textX = Math.floor(size * 0.36);
  const textY = Math.floor(size * 0.68);

  return `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${BACKGROUND_COLOR}"/>
  <text
    x="${textX}"
    y="${textY}"
    font-family="Helvetica Neue, Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="bold"
    fill="${TEXT_COLOR}"
  >L</text>
</svg>
  `.trim();
}

// Create SVG for adaptive icon (needs padding for Android safe zones)
function createAdaptiveIconSvg(size) {
  // Android adaptive icons need content in the center 66% (safe zone)
  // Scale down the L to fit in safe zone
  const fontSize = Math.floor(size * 0.40);
  const textX = Math.floor(size * 0.40);
  const textY = Math.floor(size * 0.62);

  return `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${BACKGROUND_COLOR}"/>
  <text
    x="${textX}"
    y="${textY}"
    font-family="Helvetica Neue, Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="bold"
    fill="${TEXT_COLOR}"
  >L</text>
</svg>
  `.trim();
}

async function generateIcons() {
  console.log('Generating app icons...');

  try {
    // Generate main app icon (1024x1024)
    const iconSvg = Buffer.from(createLIconSvg(ICON_SIZE));
    await sharp(iconSvg)
      .resize(ICON_SIZE, ICON_SIZE)
      .png()
      .toFile(path.join(ASSETS_DIR, 'icon.png'));
    console.log('✓ Created assets/icon.png (1024x1024)');

    // Generate adaptive icon for Android (1024x1024)
    const adaptiveSvg = Buffer.from(createAdaptiveIconSvg(ICON_SIZE));
    await sharp(adaptiveSvg)
      .resize(ICON_SIZE, ICON_SIZE)
      .png()
      .toFile(path.join(ASSETS_DIR, 'adaptive-icon.png'));
    console.log('✓ Created assets/adaptive-icon.png (1024x1024)');

    // Generate favicon (48x48)
    await sharp(iconSvg)
      .resize(48, 48)
      .png()
      .toFile(path.join(ASSETS_DIR, 'favicon.png'));
    console.log('✓ Created assets/favicon.png (48x48)');

    console.log('\n✅ All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
