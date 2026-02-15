/**
 * Generate app icons for Flick
 * Creates hand-frame gesture (director's frame) on dark background
 */
const sharp = require('sharp');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// Icon configuration
const ICON_SIZE = 1024;
const GRID = 32; // 32x32 pixel grid

// Color palette (from src/constants/colors.js)
const COLORS = {
  background: '#0A0A1A', // CRT navy-black
  cyan: '#00D4FF', // Electric cyan (hands)
};

/**
 * Helper: get pixels for a filled rectangle
 */
function rectFill(x1, y1, x2, y2) {
  const pixels = [];
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      pixels.push([x, y]);
    }
  }
  return pixels;
}

/**
 * Build the hand-frame icon on a 32x32 grid
 * Two hands at opposite corners forming a clean empty director's frame
 */
function getIconPixels() {
  const layers = [];

  // --- Hand frame gesture (cyan) ---
  // Two L-shapes forming a rectangular frame, spaced out for breathing room

  // Top-right hand: thumb across top, finger hangs DOWN from right end
  const topRightHand = [
    ...rectFill(3, 4, 28, 5), // thumb (horizontal bar)
    ...rectFill(26, 4, 28, 19), // pointer finger (vertical, pointing DOWN from bar)
  ];

  // Bottom-left hand: thumb across bottom, finger reaches UP from left end
  const bottomLeftHand = [
    ...rectFill(3, 26, 28, 27), // thumb (horizontal bar)
    ...rectFill(3, 12, 5, 27), // pointer finger (vertical, pointing UP toward bar)
  ];

  layers.push({
    color: COLORS.cyan,
    pixels: [...topRightHand, ...bottomLeftHand],
  });

  return layers;
}

/**
 * Simplified version for favicon (thicker strokes, no text)
 */
function getFaviconPixels() {
  const layers = [];

  // Thicker hand frame for favicon legibility (same spaced-out frame)
  const topRightHand = [
    ...rectFill(2, 3, 28, 5), // thumb across top (3px thick)
    ...rectFill(25, 3, 28, 19), // finger DOWN from right end (4px wide)
  ];

  const bottomLeftHand = [
    ...rectFill(3, 26, 29, 28), // thumb across bottom (3px thick)
    ...rectFill(3, 12, 6, 28), // finger UP from left end (4px wide)
  ];

  layers.push({
    color: COLORS.cyan,
    pixels: [...topRightHand, ...bottomLeftHand],
  });

  return layers;
}

/**
 * Convert pixel layers to SVG string
 */
function layersToSvg(size, layers, padding = 0) {
  const cellSize = (size - 2 * padding) / GRID;
  const offsetX = padding;
  const offsetY = padding;

  let rects = '';
  for (const layer of layers) {
    for (const [x, y] of layer.pixels) {
      rects += `<rect x="${offsetX + x * cellSize}" y="${offsetY + y * cellSize}" width="${cellSize + 0.5}" height="${cellSize + 0.5}" fill="${layer.color}"/>`;
    }
  }

  return `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${COLORS.background}"/>
  ${rects}
</svg>
  `.trim();
}

async function generateIcons() {
  console.log('Generating Flick app icons...');

  try {
    // Generate main app icon (1024x1024)
    const iconSvg = Buffer.from(layersToSvg(ICON_SIZE, getIconPixels()));
    await sharp(iconSvg)
      .resize(ICON_SIZE, ICON_SIZE)
      .png()
      .toFile(path.join(ASSETS_DIR, 'icon.png'));
    console.log('✓ Created assets/icon.png (1024x1024)');

    // Generate adaptive icon for Android (1024x1024 with safe-zone padding)
    const adaptivePadding = ICON_SIZE * 0.17;
    const adaptiveSvg = Buffer.from(layersToSvg(ICON_SIZE, getIconPixels(), adaptivePadding));
    await sharp(adaptiveSvg)
      .resize(ICON_SIZE, ICON_SIZE)
      .png()
      .toFile(path.join(ASSETS_DIR, 'adaptive-icon.png'));
    console.log('✓ Created assets/adaptive-icon.png (1024x1024)');

    // Generate favicon (48x48) — simplified for legibility
    const faviconSvg = Buffer.from(layersToSvg(48, getFaviconPixels()));
    await sharp(faviconSvg).resize(48, 48).png().toFile(path.join(ASSETS_DIR, 'favicon.png'));
    console.log('✓ Created assets/favicon.png (48x48)');

    console.log('\n✅ All icons generated successfully!');
    console.log('Design: Hand-frame gesture');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
