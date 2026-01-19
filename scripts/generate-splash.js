/**
 * Generate splash screen for Lapse Clone
 * Creates "LAPSE" text centered on off-white background
 */
const sharp = require('sharp');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// Splash configuration
const SPLASH_WIDTH = 1284;
const SPLASH_HEIGHT = 2778;
const BACKGROUND_COLOR = '#FAFAFA';
const TEXT_COLOR = '#000000';

// Create SVG for splash screen
function createSplashSvg(width, height) {
  const fontSize = Math.floor(width * 0.15);
  const textY = Math.floor(height * 0.48);

  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${BACKGROUND_COLOR}"/>
  <text
    x="50%"
    y="${textY}"
    font-family="Helvetica Neue, Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="bold"
    fill="${TEXT_COLOR}"
    text-anchor="middle"
    dominant-baseline="middle"
    letter-spacing="0.15em"
  >LAPSE</text>
</svg>
  `.trim();
}

async function generateSplash() {
  console.log('Generating splash screen...');

  try {
    const splashSvg = Buffer.from(createSplashSvg(SPLASH_WIDTH, SPLASH_HEIGHT));
    await sharp(splashSvg)
      .resize(SPLASH_WIDTH, SPLASH_HEIGHT)
      .png()
      .toFile(path.join(ASSETS_DIR, 'splash.png'));
    console.log(`✓ Created assets/splash.png (${SPLASH_WIDTH}x${SPLASH_HEIGHT})`);

    console.log('\n✅ Splash screen generated successfully!');
  } catch (error) {
    console.error('Error generating splash:', error);
    process.exit(1);
  }
}

generateSplash();
