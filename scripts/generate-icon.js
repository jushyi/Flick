const { Jimp } = require('jimp');

// Icon dimensions
const SIZE = 1024;

// Colors from app theme (hex numbers)
const BG_COLOR = 0x0a0a1aff; // CRT navy-black
const FRAME_COLOR = 0x1e1e35ff; // Dark indigo
const ACCENT_COLOR = 0x00d4ffff; // Electric cyan
const SECONDARY_COLOR = 0xff2d78ff; // Hot magenta

// Film strip constants - THICK
const PERF_WIDTH = 175; // Thick film strip (175px)
const PERF_HOLE_SIZE = 90; // Larger perforation holes
const PERF_SPACING = 120; // Space between perforations (evenly distributed)
const PERF_COUNT = 8; // Number of perforation holes
const PERF_OFFSET = (SIZE - (PERF_COUNT - 1) * PERF_SPACING - PERF_HOLE_SIZE) / 2; // Center holes vertically

// Pixel size for solid chunky F
const PIXEL_SIZE = 100; // Size of each solid block in the F (chunky)
const TEXT_PIXEL_SIZE = 60; // Size for FLICK text blocks (smaller for splash)

async function generateIcon() {
  console.log('Creating icon canvas...');
  const image = new Jimp({ width: SIZE, height: SIZE, color: BG_COLOR });

  console.log('Drawing thicker film strip perforations...');
  // Draw film strip perforations on left and right
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < PERF_WIDTH; x++) {
      image.setPixelColor(FRAME_COLOR, x, y);
    }
  }
  for (let y = 0; y < SIZE; y++) {
    for (let x = SIZE - PERF_WIDTH; x < SIZE; x++) {
      image.setPixelColor(FRAME_COLOR, x, y);
    }
  }

  console.log('Drawing perforation holes...');
  // Draw perforation holes (dark squares) - evenly spaced
  for (let i = 0; i < PERF_COUNT; i++) {
    const perfY = Math.floor(PERF_OFFSET + i * PERF_SPACING);
    const perfX = Math.floor((PERF_WIDTH - PERF_HOLE_SIZE) / 2);

    // Left side holes
    for (let y = perfY; y < perfY + PERF_HOLE_SIZE; y++) {
      for (let x = perfX; x < perfX + PERF_HOLE_SIZE; x++) {
        if (y >= 0 && y < SIZE && x >= 0 && x < SIZE) {
          image.setPixelColor(BG_COLOR, x, y);
        }
      }
    }

    // Right side holes
    for (let y = perfY; y < perfY + PERF_HOLE_SIZE; y++) {
      for (let x = SIZE - PERF_WIDTH + perfX; x < SIZE - PERF_WIDTH + perfX + PERF_HOLE_SIZE; x++) {
        if (y >= 0 && y < SIZE && x >= 0 && x < SIZE) {
          image.setPixelColor(BG_COLOR, x, y);
        }
      }
    }
  }

  console.log('Drawing gradient background...');
  // Draw gradient background for center area
  const centerStart = PERF_WIDTH;
  const centerEnd = SIZE - PERF_WIDTH;
  for (let y = 0; y < SIZE; y++) {
    for (let x = centerStart; x < centerEnd; x++) {
      const t = y / SIZE;
      const color = blendColors(ACCENT_COLOR, SECONDARY_COLOR, Math.sin(t * Math.PI) * 0.3);
      image.setPixelColor(color, x, y);
    }
  }

  console.log('Drawing solid chunky F letter...');
  // Draw solid "F" - chunky retro letter with thick bars
  // F pattern: 6 blocks wide x 10 blocks tall (thick horizontal bars)
  const fPattern = [
    [1, 1, 1, 1, 1, 1], // Top bar row 1 (2 rows thick)
    [1, 1, 1, 1, 1, 1], // Top bar row 2
    [1, 1, 0, 0, 0, 0], // Thick vertical bar
    [1, 1, 0, 0, 0, 0], // Thick vertical bar
    [1, 1, 1, 1, 1, 0], // Middle bar row 1 (2 rows thick)
    [1, 1, 1, 1, 1, 0], // Middle bar row 2
    [1, 1, 0, 0, 0, 0], // Thick vertical bar
    [1, 1, 0, 0, 0, 0], // Thick vertical bar
    [1, 1, 0, 0, 0, 0], // Thick vertical bar
    [1, 1, 0, 0, 0, 0], // Thick vertical bar
  ];

  // Center the F pattern
  const patternHeight = fPattern.length;
  const patternWidth = fPattern[0].length;
  const fStartY = Math.floor((SIZE - patternHeight * PIXEL_SIZE) / 2);
  const fStartX = Math.floor((SIZE - patternWidth * PIXEL_SIZE) / 2);

  // Draw each block as solid filled rectangle
  for (let row = 0; row < patternHeight; row++) {
    for (let col = 0; col < patternWidth; col++) {
      if (fPattern[row][col] === 1) {
        const pixelY = fStartY + row * PIXEL_SIZE;
        const pixelX = fStartX + col * PIXEL_SIZE;
        // Fill solid rectangle
        for (let y = pixelY; y < pixelY + PIXEL_SIZE; y++) {
          for (let x = pixelX; x < pixelX + PIXEL_SIZE; x++) {
            if (y >= 0 && y < SIZE && x >= 0 && x < SIZE) {
              image.setPixelColor(ACCENT_COLOR, x, y);
            }
          }
        }
      }
    }
  }

  console.log('Saving icons...');
  // Save main icon
  await image.write('assets/icon.png');
  console.log('✓ Generated assets/icon.png (1024x1024)');

  // Android adaptive icon
  await image.write('assets/adaptive-icon.png');
  console.log('✓ Generated assets/adaptive-icon.png (1024x1024)');

  // Favicon (smaller version)
  const favicon = image.clone();
  await favicon.resize({ w: 48, h: 48 });
  await favicon.write('assets/favicon.png');
  console.log('✓ Generated assets/favicon.png (48x48)');

  // Splash screen - generate separately with FLICK text
  console.log('Generating splash screen with FLICK text...');
  const splash = await generateSplashWithText();
  await splash.write('assets/splash.png');
  console.log('✓ Generated assets/splash.png (1024x1024) with FLICK text');

  console.log('\n✓ Icon generation complete!');
  console.log('Film strip with solid chunky retro F design created.');
}

// Draw a single pixel box with border
function drawPixelBox(image, x, y, size, fillColor, borderColor) {
  const borderWidth = 2;

  // Draw fill
  for (let py = y; py < y + size; py++) {
    for (let px = x; px < x + size; px++) {
      if (py >= 0 && py < SIZE && px >= 0 && px < SIZE) {
        image.setPixelColor(fillColor, px, py);
      }
    }
  }

  // Draw border
  for (let py = y; py < y + size; py++) {
    for (let px = x; px < x + borderWidth; px++) {
      if (py >= 0 && py < SIZE && px >= 0 && px < SIZE) {
        image.setPixelColor(borderColor, px, py);
      }
    }
    for (let px = x + size - borderWidth; px < x + size; px++) {
      if (py >= 0 && py < SIZE && px >= 0 && px < SIZE) {
        image.setPixelColor(borderColor, px, py);
      }
    }
  }
  for (let px = x; px < x + size; px++) {
    for (let py = y; py < y + borderWidth; py++) {
      if (py >= 0 && py < SIZE && px >= 0 && px < SIZE) {
        image.setPixelColor(borderColor, px, py);
      }
    }
    for (let py = y + size - borderWidth; py < y + size; py++) {
      if (py >= 0 && py < SIZE && px >= 0 && px < SIZE) {
        image.setPixelColor(borderColor, px, py);
      }
    }
  }
}

// Helper function to blend two colors (RGBA hex format)
function blendColors(color1, color2, factor) {
  const r1 = (color1 >> 24) & 0xff;
  const g1 = (color1 >> 16) & 0xff;
  const b1 = (color1 >> 8) & 0xff;
  const a1 = color1 & 0xff;

  const r2 = (color2 >> 24) & 0xff;
  const g2 = (color2 >> 16) & 0xff;
  const b2 = (color2 >> 8) & 0xff;
  const a2 = color2 & 0xff;

  const r = Math.floor(r1 + (r2 - r1) * factor);
  const g = Math.floor(g1 + (g2 - g1) * factor);
  const b = Math.floor(b1 + (b2 - b1) * factor);
  const a = Math.floor(a1 + (a2 - a1) * factor);

  return (r << 24) | (g << 16) | (b << 8) | a;
}

// Generate splash screen with FLICK text
async function generateSplashWithText() {
  const splash = new Jimp({ width: SIZE, height: SIZE, color: BG_COLOR });

  // Draw film strip perforations (same as icon)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < PERF_WIDTH; x++) {
      splash.setPixelColor(FRAME_COLOR, x, y);
    }
  }
  for (let y = 0; y < SIZE; y++) {
    for (let x = SIZE - PERF_WIDTH; x < SIZE; x++) {
      splash.setPixelColor(FRAME_COLOR, x, y);
    }
  }

  // Draw perforation holes
  for (let i = 0; i < PERF_COUNT; i++) {
    const perfY = Math.floor(PERF_OFFSET + i * PERF_SPACING);
    const perfX = Math.floor((PERF_WIDTH - PERF_HOLE_SIZE) / 2);

    for (let y = perfY; y < perfY + PERF_HOLE_SIZE; y++) {
      for (let x = perfX; x < perfX + PERF_HOLE_SIZE; x++) {
        if (y >= 0 && y < SIZE && x >= 0 && x < SIZE) {
          splash.setPixelColor(BG_COLOR, x, y);
        }
      }
    }

    for (let y = perfY; y < perfY + PERF_HOLE_SIZE; y++) {
      for (let x = SIZE - PERF_WIDTH + perfX; x < SIZE - PERF_WIDTH + perfX + PERF_HOLE_SIZE; x++) {
        if (y >= 0 && y < SIZE && x >= 0 && x < SIZE) {
          splash.setPixelColor(BG_COLOR, x, y);
        }
      }
    }
  }

  // Draw gradient background
  const centerStart = PERF_WIDTH;
  const centerEnd = SIZE - PERF_WIDTH;
  for (let y = 0; y < SIZE; y++) {
    for (let x = centerStart; x < centerEnd; x++) {
      const t = y / SIZE;
      const color = blendColors(ACCENT_COLOR, SECONDARY_COLOR, Math.sin(t * Math.PI) * 0.3);
      splash.setPixelColor(color, x, y);
    }
  }

  // Letter patterns for FLICK (5x7 grid each for compact spacing)
  const letterF = [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
  ];

  const letterL = [
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 1],
  ];

  const letterI = [
    [1, 1, 1, 1, 1],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [1, 1, 1, 1, 1],
  ];

  const letterC = [
    [0, 1, 1, 1, 1],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [0, 1, 1, 1, 1],
  ];

  const letterK = [
    [1, 0, 0, 0, 1],
    [1, 0, 0, 1, 0],
    [1, 0, 1, 0, 0],
    [1, 1, 0, 0, 0],
    [1, 0, 1, 0, 0],
    [1, 0, 0, 1, 0],
    [1, 0, 0, 0, 1],
  ];

  const letters = [letterF, letterL, letterI, letterC, letterK];
  const letterSpacing = TEXT_PIXEL_SIZE * 0.5; // Space between letters
  const totalWidth = letters.length * 5 * TEXT_PIXEL_SIZE + (letters.length - 1) * letterSpacing;
  const startX = (SIZE - totalWidth) / 2;
  const startY = (SIZE - 7 * TEXT_PIXEL_SIZE) / 2;

  // Draw each letter
  for (let letterIdx = 0; letterIdx < letters.length; letterIdx++) {
    const letter = letters[letterIdx];
    const letterX = startX + letterIdx * (5 * TEXT_PIXEL_SIZE + letterSpacing);

    for (let row = 0; row < letter.length; row++) {
      for (let col = 0; col < letter[row].length; col++) {
        if (letter[row][col] === 1) {
          const pixelY = startY + row * TEXT_PIXEL_SIZE;
          const pixelX = letterX + col * TEXT_PIXEL_SIZE;

          for (let y = pixelY; y < pixelY + TEXT_PIXEL_SIZE; y++) {
            for (let x = pixelX; x < pixelX + TEXT_PIXEL_SIZE; x++) {
              if (y >= 0 && y < SIZE && x >= 0 && x < SIZE) {
                splash.setPixelColor(ACCENT_COLOR, x, y);
              }
            }
          }
        }
      }
    }
  }

  return splash;
}

// Run the generator
generateIcon().catch(err => {
  console.error('Error generating icon:', err);
  console.error(err.stack);
  process.exit(1);
});
