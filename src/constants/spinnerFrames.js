/**
 * Spinner frame data for PixelSpinner — 16-Bit Retro Edition
 *
 * Defines a 12x12 pixel grid square-ring spinner with 8 animation frames.
 * A bright highlight segment cycles clockwise around the ring.
 *
 * Grid layout (12x12, ring occupies rows/cols 1-10):
 *
 *     1 2 3 4 5 6 7 8 9 10
 *  1  # # # # # # # # # #
 *  2  # # # # # # # # # #
 *  3  # #             # #
 *  4  # #             # #
 *  5  # #             # #
 *  6  # #             # #
 *  7  # #             # #
 *  8  # #             # #
 *  9  # # # # # # # # # #
 * 10  # # # # # # # # # #
 */

// Full square ring outline (all pixels rendered at dim opacity)
const BASE_PIXELS = [
  // Top edge (rows 1-2)
  [1, 1],
  [2, 1],
  [3, 1],
  [4, 1],
  [5, 1],
  [6, 1],
  [7, 1],
  [8, 1],
  [9, 1],
  [10, 1],
  [1, 2],
  [2, 2],
  [3, 2],
  [4, 2],
  [5, 2],
  [6, 2],
  [7, 2],
  [8, 2],
  [9, 2],
  [10, 2],
  // Right edge (rows 3-8)
  [9, 3],
  [10, 3],
  [9, 4],
  [10, 4],
  [9, 5],
  [10, 5],
  [9, 6],
  [10, 6],
  [9, 7],
  [10, 7],
  [9, 8],
  [10, 8],
  // Bottom edge (rows 9-10)
  [1, 9],
  [2, 9],
  [3, 9],
  [4, 9],
  [5, 9],
  [6, 9],
  [7, 9],
  [8, 9],
  [9, 9],
  [10, 9],
  [1, 10],
  [2, 10],
  [3, 10],
  [4, 10],
  [5, 10],
  [6, 10],
  [7, 10],
  [8, 10],
  [9, 10],
  [10, 10],
  // Left edge (rows 3-8)
  [1, 3],
  [2, 3],
  [1, 4],
  [2, 4],
  [1, 5],
  [2, 5],
  [1, 6],
  [2, 6],
  [1, 7],
  [2, 7],
  [1, 8],
  [2, 8],
];

// 8 highlight frames — each is a segment of the ring that glows bright
const HIGHLIGHT_FRAMES = [
  // Frame 0: Top-left
  [
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
    [5, 2],
  ],
  // Frame 1: Top-right
  [
    [6, 1],
    [7, 1],
    [8, 1],
    [9, 1],
    [10, 1],
    [6, 2],
    [7, 2],
    [8, 2],
    [9, 2],
    [10, 2],
  ],
  // Frame 2: Right-top
  [
    [9, 3],
    [10, 3],
    [9, 4],
    [10, 4],
    [9, 5],
    [10, 5],
  ],
  // Frame 3: Right-bottom
  [
    [9, 6],
    [10, 6],
    [9, 7],
    [10, 7],
    [9, 8],
    [10, 8],
  ],
  // Frame 4: Bottom-right
  [
    [6, 9],
    [7, 9],
    [8, 9],
    [9, 9],
    [10, 9],
    [6, 10],
    [7, 10],
    [8, 10],
    [9, 10],
    [10, 10],
  ],
  // Frame 5: Bottom-left
  [
    [1, 9],
    [2, 9],
    [3, 9],
    [4, 9],
    [5, 9],
    [1, 10],
    [2, 10],
    [3, 10],
    [4, 10],
    [5, 10],
  ],
  // Frame 6: Left-bottom
  [
    [1, 6],
    [2, 6],
    [1, 7],
    [2, 7],
    [1, 8],
    [2, 8],
  ],
  // Frame 7: Left-top
  [
    [1, 3],
    [2, 3],
    [1, 4],
    [2, 4],
    [1, 5],
    [2, 5],
  ],
];

// Pre-computed Sets for O(1) highlight lookup per frame
const HIGHLIGHT_SETS = HIGHLIGHT_FRAMES.map(frame => new Set(frame.map(([x, y]) => (x << 4) | y)));

export const GRID_SIZE = 12;
export const FRAME_COUNT = HIGHLIGHT_FRAMES.length;

export { BASE_PIXELS, HIGHLIGHT_SETS };
