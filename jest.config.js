/**
 * Jest Configuration for Lapse Clone App
 *
 * Uses jest-expo preset for Expo/React Native compatibility.
 * Firebase modules are mocked in __tests__/setup/jest.setup.js
 */

module.exports = {
  // jest-expo handles Expo-specific transforms and mocks automatically
  preset: 'jest-expo',

  // Setup file runs before each test file
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup/jest.setup.js'],

  // Ignore setup files and node_modules when looking for tests
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/__tests__/setup/',
    '<rootDir>/__tests__/__mocks__/',
    '<rootDir>/functions/__tests__/',
    '<rootDir>/functions/',
    '<rootDir>/.claude/',
  ],

  // Only match test files in __tests__ directory
  testMatch: ['**/__tests__/**/*.test.{js,ts,tsx}'],

  // Auto-clear mocks between tests for clean test isolation
  clearMocks: true,

  // Module name mapper for path aliases and uninstalled native modules
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^expo-screen-capture$': '<rootDir>/__tests__/__mocks__/expo-screen-capture.js',
    '^react-native-url-polyfill/dist/polyfill$':
      '<rootDir>/__tests__/__mocks__/react-native-url-polyfill.js',
    '^react-native-url-polyfill/auto$':
      '<rootDir>/__tests__/__mocks__/react-native-url-polyfill.js',
    '^@powersync/react-native$': '<rootDir>/__tests__/__mocks__/@powersync/react-native.js',
    '^@powersync/react$': '<rootDir>/__tests__/__mocks__/@powersync/react.js',
    '^react-native-toast-message$': '<rootDir>/__tests__/__mocks__/react-native-toast-message.js',
  },

  // Transform ignore patterns - jest-expo handles most, but add any custom ones here
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@react-native-firebase/.*|@supabase/supabase-js|@tanstack/.*|@powersync/.*|@journeyapps/.*)',
  ],

  // Collect coverage from src directory
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!**/node_modules/**',
  ],

  // Coverage directory
  coverageDirectory: 'coverage',

  // Verbose output for better debugging
  verbose: true,
};
