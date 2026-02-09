/**
 * Generate app icons for Rewind — 16-Bit Retro Edition
 * Creates pixel-art camera viewfinder frame with rewind arrows on CRT dark background
 */
const sharp = require('sharp');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// Icon configuration
const ICON_SIZE = 1024;
const GRID = 32; // 32x32 pixel grid

// 16-bit retro color palette (from src/constants/colors.js)
const COLORS = {
  background: '#0A0A1A', // CRT navy-black
  cyan: '#00D4FF', // Electric cyan (viewfinder frame)
  magenta: '#FF2D78', // Hot magenta (rewind arrows)
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
 * Helper: get pixels for a left-pointing triangle (rewind arrow <)
 * Tip (single pixel) on the left, base (full height) on the right
 */
function leftTriangle(tipX, centerY, width, halfHeight) {
  const pixels = [];
  for (let col = 0; col < width; col++) {
    const progress = col / (width - 1 || 1); // 0 at tip, 1 at base
    const rowSpan = Math.max(0, Math.round(progress * halfHeight));
    for (let row = -rowSpan; row <= rowSpan; row++) {
      pixels.push([tipX + col, centerY + row]);
    }
  }
  return pixels;
}

/**
 * Build camera viewfinder corner brackets (L-shaped corners)
 * Each corner is an L-shape, 2px thick, armLength long
 */
function viewfinderCorners(x1, y1, x2, y2, armLength, thickness) {
  const pixels = [];

  // Top-left corner: horizontal arm going right, vertical arm going down
  pixels.push(...rectFill(x1, y1, x1 + armLength - 1, y1 + thickness - 1)); // horizontal
  pixels.push(...rectFill(x1, y1, x1 + thickness - 1, y1 + armLength - 1)); // vertical

  // Top-right corner: horizontal arm going left, vertical arm going down
  pixels.push(...rectFill(x2 - armLength + 1, y1, x2, y1 + thickness - 1)); // horizontal
  pixels.push(...rectFill(x2 - thickness + 1, y1, x2, y1 + armLength - 1)); // vertical

  // Bottom-left corner: horizontal arm going right, vertical arm going up
  pixels.push(...rectFill(x1, y2 - thickness + 1, x1 + armLength - 1, y2)); // horizontal
  pixels.push(...rectFill(x1, y2 - armLength + 1, x1 + thickness - 1, y2)); // vertical

  // Bottom-right corner: horizontal arm going left, vertical arm going up
  pixels.push(...rectFill(x2 - armLength + 1, y2 - thickness + 1, x2, y2)); // horizontal
  pixels.push(...rectFill(x2 - thickness + 1, y2 - armLength + 1, x2, y2)); // vertical

  return pixels;
}

/**
 * Build the pixel camera viewfinder icon on a 32x32 grid
 */
function getIconPixels() {
  const layers = [];

  // --- Camera viewfinder corner brackets (cyan) ---
  // Frame area: rows 4-27, cols 4-27
  // L-shaped corners, 2px thick, 7px arm length
  layers.push({
    color: COLORS.cyan,
    pixels: viewfinderCorners(4, 4, 27, 27, 7, 2),
  });

  // --- Rewind arrows (magenta) — two left-pointing triangles << ---
  // Arrows centered in the frame, pointing LEFT
  // First arrow: tip at col 8, 7px wide, ±5 rows tall at base
  const arrow1 = leftTriangle(8, 15, 7, 5);
  // Second arrow: tip at col 16, 7px wide, ±5 rows tall at base
  const arrow2 = leftTriangle(16, 15, 7, 5);

  layers.push({
    color: COLORS.magenta,
    pixels: [...arrow1, ...arrow2],
  });

  return layers;
}

/**
 * Build a simplified version for favicon (fewer details for 48x48 legibility)
 */
function getFaviconPixels() {
  const layers = [];

  // Simplified viewfinder corners (cyan)
  layers.push({
    color: COLORS.cyan,
    pixels: viewfinderCorners(3, 3, 28, 28, 8, 3),
  });

  // Two rewind arrows (magenta) — slightly larger for legibility
  const arrow1 = leftTriangle(7, 15, 8, 6);
  const arrow2 = leftTriangle(16, 15, 8, 6);

  layers.push({
    color: COLORS.magenta,
    pixels: [...arrow1, ...arrow2],
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
  console.log('Generating Rewind 16-bit retro app icons...');

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
    console.log('Design: 16-bit camera viewfinder with rewind arrows');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
