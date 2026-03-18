/**
 * Manual mock for expo-screen-capture
 *
 * This mock exists because expo-screen-capture is not yet installed as a dependency
 * (requires a native EAS build). The moduleNameMapper in jest.config.js resolves
 * imports to this file, and jest.setup.js overrides with configurable mock functions.
 */

module.exports = {
  addScreenshotListener: jest.fn(() => ({ remove: jest.fn() })),
  usePreventScreenCapture: jest.fn(),
  preventScreenCaptureAsync: jest.fn(() => Promise.resolve()),
  allowScreenCaptureAsync: jest.fn(() => Promise.resolve()),
};
