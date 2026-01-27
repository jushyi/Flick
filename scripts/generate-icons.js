/**
 * Generate app icons for Rewind
 * Creates cassette tape icon with nostalgic design
 */
const sharp = require('sharp');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// Icon configuration
const ICON_SIZE = 1024;
const BACKGROUND_COLOR = '#FFFFFF';
const APERTURE_COLOR = '#FF6B6B'; // Coral - warm, playful

/**
 * Create aperture blade path
 * Each blade is a triangular wedge pointing toward center
 */
function createApertureBladePath(cx, cy, innerRadius, outerRadius, startAngle, sweepAngle) {
  // Calculate points for the blade shape
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = ((startAngle + sweepAngle) * Math.PI) / 180;
  const midRad = ((startAngle + sweepAngle / 2) * Math.PI) / 180;

  // Outer arc points
  const outerStart = {
    x: cx + outerRadius * Math.cos(startRad),
    y: cy + outerRadius * Math.sin(startRad),
  };
  const outerEnd = {
    x: cx + outerRadius * Math.cos(endRad),
    y: cy + outerRadius * Math.sin(endRad),
  };

  // Inner point (creates the aperture opening)
  const innerPoint = {
    x: cx + innerRadius * Math.cos(midRad),
    y: cy + innerRadius * Math.sin(midRad),
  };

  // Create curved blade path
  return `M ${outerStart.x} ${outerStart.y}
          A ${outerRadius} ${outerRadius} 0 0 1 ${outerEnd.x} ${outerEnd.y}
          L ${innerPoint.x} ${innerPoint.y}
          Z`;
}

/**
 * Create SVG for the aperture icon
 * 6 blades creating a hexagonal opening (the "O")
 */
function createApertureIconSvg(size, padding = 0) {
  const cx = size / 2;
  const cy = size / 2;

  // Adjust for padding (used in adaptive icon)
  const effectiveRadius = size / 2 - padding;
  const outerRadius = effectiveRadius * 0.85;
  const innerRadius = effectiveRadius * 0.28; // Size of the "O" opening

  const numBlades = 6;
  const sweepAngle = 360 / numBlades - 2; // Small gap between blades

  let blades = '';
  for (let i = 0; i < numBlades; i++) {
    const startAngle = (i * 360) / numBlades - 90; // Start from top
    blades += `<path d="${createApertureBladePath(cx, cy, innerRadius, outerRadius, startAngle, sweepAngle)}" fill="${APERTURE_COLOR}"/>`;
  }

  // Add subtle center circle to define the "O" more clearly
  const centerCircle = `<circle cx="${cx}" cy="${cy}" r="${innerRadius * 0.15}" fill="${APERTURE_COLOR}" opacity="0.3"/>`;

  return `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${BACKGROUND_COLOR}"/>
  ${blades}
  ${centerCircle}
</svg>
  `.trim();
}

/**
 * Create SVG for adaptive icon (needs padding for Android safe zones)
 * Android adaptive icons need content in the center 66% (safe zone)
 */
function createAdaptiveIconSvg(size) {
  // Add padding to keep content within safe zone
  const padding = size * 0.17;
  return createApertureIconSvg(size, padding);
}

async function generateIcons() {
  console.log('Generating Rewind app icons...');

  try {
    // Generate main app icon (1024x1024)
    const iconSvg = Buffer.from(createApertureIconSvg(ICON_SIZE));
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
    await sharp(iconSvg).resize(48, 48).png().toFile(path.join(ASSETS_DIR, 'favicon.png'));
    console.log('✓ Created assets/favicon.png (48x48)');

    console.log('\n✅ All icons generated successfully!');
    console.log('Design: Coral aperture blades with "O" opening');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
