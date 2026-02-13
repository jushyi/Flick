const { Jimp } = require('jimp');

// Icon dimensions
const SIZE = 1024;

// Colors from app theme (hex numbers)
const BG_COLOR = 0x0a0a1aff; // CRT navy-black
const FRAME_COLOR = 0x1e1e35ff; // Dark indigo
const ACCENT_COLOR = 0x00d4ffff; // Electric cyan
const SECONDARY_COLOR = 0xff2d78ff; // Hot magenta

// Film strip constants
const PERF_WIDTH = 60; // Width of perforation strip on each side
const PERF_HOLE_SIZE = 32;
const PERF_SPACING = 52; // Space between perforations

async function generateIcon() {
  console.log('Creating icon canvas...');
  // Create base image with dark background
  const image = new Jimp({ width: SIZE, height: SIZE, color: BG_COLOR });

  console.log('Drawing film strip perforations...');
  // Draw film strip perforations on left and right
  // Left strip
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < PERF_WIDTH; x++) {
      image.setPixelColor(FRAME_COLOR, x, y);
    }
  }
  // Right strip
  for (let y = 0; y < SIZE; y++) {
    for (let x = SIZE - PERF_WIDTH; x < SIZE; x++) {
      image.setPixelColor(FRAME_COLOR, x, y);
    }
  }

  console.log('Drawing perforation holes...');
  // Draw perforation holes (dark squares)
  const perfCount = Math.floor(SIZE / PERF_SPACING);
  for (let i = 0; i < perfCount; i++) {
    const perfY = Math.floor(i * PERF_SPACING + (PERF_SPACING - PERF_HOLE_SIZE) / 2);
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
      // Simple vertical gradient from cyan to magenta
      const t = y / SIZE;
      const color = blendColors(ACCENT_COLOR, SECONDARY_COLOR, Math.sin(t * Math.PI) * 0.3);
      image.setPixelColor(color, x, y);
    }
  }

  console.log('Drawing retro F letter...');
  // Draw retro "F" letter
  const fWidth = 380;
  const fHeight = 600;
  const strokeWidth = 100;
  const crossbarWidth = 300;
  const crossbarHeight = 80;

  const fX = Math.floor((SIZE - fWidth) / 2);
  const fY = Math.floor((SIZE - fHeight) / 2);

  // Vertical bar of F
  drawRect(image, fX, fY, strokeWidth, fHeight, ACCENT_COLOR);

  // Top horizontal bar
  drawRect(image, fX, fY, fWidth, strokeWidth, ACCENT_COLOR);

  // Middle crossbar
  const crossbarY = fY + Math.floor(fHeight / 2 - crossbarHeight / 2 - 40);
  drawRect(image, fX, crossbarY, crossbarWidth, crossbarHeight, ACCENT_COLOR);

  console.log('Adding border details...');
  // Add border/outline to F for depth
  drawRectOutline(image, fX, fY, strokeWidth, fHeight, FRAME_COLOR, 4);
  drawRectOutline(image, fX, fY, fWidth, strokeWidth, FRAME_COLOR, 4);
  drawRectOutline(image, fX, crossbarY, crossbarWidth, crossbarHeight, FRAME_COLOR, 4);

  console.log('Saving icons...');
  // Save main icon
  await image.write('assets/icon.png');
  console.log('✓ Generated assets/icon.png (1024x1024)');

  // Android adaptive icon is the same for this design
  await image.write('assets/adaptive-icon.png');
  console.log('✓ Generated assets/adaptive-icon.png (1024x1024)');

  console.log('\n✓ Icon generation complete!');
  console.log('Film strip with retro F design created.');
}

// Helper function to draw a filled rectangle
function drawRect(image, x, y, width, height, color) {
  for (let py = y; py < y + height; py++) {
    for (let px = x; px < x + width; px++) {
      if (py >= 0 && py < SIZE && px >= 0 && px < SIZE) {
        image.setPixelColor(color, px, py);
      }
    }
  }
}

// Helper function to draw rectangle outline
function drawRectOutline(image, x, y, width, height, color, thickness) {
  // Top border
  drawRect(image, x - thickness, y - thickness, width + 2 * thickness, thickness, color);
  // Bottom border
  drawRect(image, x - thickness, y + height, width + 2 * thickness, thickness, color);
  // Left border
  drawRect(image, x - thickness, y, thickness, height, color);
  // Right border
  drawRect(image, x + width, y, thickness, height, color);
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

// Run the generator
generateIcon().catch(err => {
  console.error('Error generating icon:', err);
  console.error(err.stack);
  process.exit(1);
});
