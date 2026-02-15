/**
 * Generate splash screen for Flick
 * Creates pixel-art "FLICK" text on dark background with subtle glow
 */
const sharp = require('sharp');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// Splash configuration
const SPLASH_WIDTH = 1284;
const SPLASH_HEIGHT = 2778;

// Color palette
const COLORS = {
  background: '#0A0A1A', // CRT navy-black
  text: '#00D4FF', // Electric cyan
  glow: '#00D4FF', // Glow color (same, with opacity via filter)
};

/**
 * Pixel-art letter definitions on 5x7 grids
 * Each letter is an array of [x, y] coordinates for filled pixels
 */
const PIXEL_LETTERS = {
  F: {
    width: 5,
    height: 7,
    pixels: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
      [0, 4],
      [0, 5],
      [0, 6],
    ],
  },
  L: {
    width: 5,
    height: 7,
    pixels: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
      [0, 5],
      [0, 6],
      [1, 6],
      [2, 6],
      [3, 6],
      [4, 6],
    ],
  },
  I: {
    width: 5,
    height: 7,
    pixels: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [2, 1],
      [2, 2],
      [2, 3],
      [2, 4],
      [2, 5],
      [0, 6],
      [1, 6],
      [2, 6],
      [3, 6],
      [4, 6],
    ],
  },
  C: {
    width: 5,
    height: 7,
    pixels: [
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
      [0, 5],
      [1, 6],
      [2, 6],
      [3, 6],
      [4, 6],
    ],
  },
  K: {
    width: 5,
    height: 7,
    pixels: [
      [0, 0],
      [4, 0],
      [0, 1],
      [3, 1],
      [0, 2],
      [2, 2],
      [0, 3],
      [1, 3],
      [0, 4],
      [2, 4],
      [0, 5],
      [3, 5],
      [0, 6],
      [4, 6],
    ],
  },
};

/**
 * Render the word as pixel-art SVG rect elements
 */
function renderPixelText(word, cellSize, startX, startY) {
  let rects = '';
  let offsetX = startX;

  for (const char of word) {
    const letter = PIXEL_LETTERS[char];
    if (!letter) continue;

    for (const [x, y] of letter.pixels) {
      rects += `<rect x="${offsetX + x * cellSize}" y="${startY + y * cellSize}" width="${cellSize}" height="${cellSize}" fill="${COLORS.text}"/>`;
    }

    offsetX += (letter.width + 2) * cellSize; // 2-cell gap between letters
  }

  return rects;
}

/**
 * Calculate total pixel width of a word
 */
function getWordWidth(word) {
  let totalWidth = 0;
  for (let i = 0; i < word.length; i++) {
    const letter = PIXEL_LETTERS[word[i]];
    if (!letter) continue;
    totalWidth += letter.width;
    if (i < word.length - 1) totalWidth += 2; // gap between letters
  }
  return totalWidth;
}

/**
 * Create SVG for the splash screen
 */
function createSplashSvg(width, height) {
  const word = 'FLICK';
  const wordWidthInCells = getWordWidth(word);

  // Size each pixel cell so the text fills ~60% of screen width
  const targetWidth = width * 0.6;
  const cellSize = Math.floor(targetWidth / wordWidthInCells);

  // Center the text
  const actualWidth = wordWidthInCells * cellSize;
  const textX = Math.floor((width - actualWidth) / 2);
  const textHeight = 7 * cellSize;
  const textY = Math.floor((height - textHeight) / 2);

  // Render the pixel text
  const textRects = renderPixelText(word, cellSize, textX, textY);

  // Glow filter for subtle phosphor effect
  const glowFilter = `
    <defs>
      <filter id="crt-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="${cellSize * 0.8}" result="blur"/>
        <feColorMatrix in="blur" type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.35 0" result="glow"/>
        <feMerge>
          <feMergeNode in="glow"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
  `;

  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  ${glowFilter}
  <rect width="100%" height="100%" fill="${COLORS.background}"/>
  <g filter="url(#crt-glow)">
    ${textRects}
  </g>
</svg>
  `.trim();
}

async function generateSplash() {
  console.log('Generating Flick splash screen...');

  try {
    const splashSvg = Buffer.from(createSplashSvg(SPLASH_WIDTH, SPLASH_HEIGHT));
    await sharp(splashSvg)
      .resize(SPLASH_WIDTH, SPLASH_HEIGHT)
      .png()
      .toFile(path.join(ASSETS_DIR, 'splash.png'));
    console.log(`✓ Created assets/splash.png (${SPLASH_WIDTH}x${SPLASH_HEIGHT})`);

    console.log('\n✅ Splash screen generated successfully!');
    console.log('Design: Pixel-art FLICK text with subtle glow on dark background');
  } catch (error) {
    console.error('Error generating splash:', error);
    process.exit(1);
  }
}

generateSplash();
