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
  ],

  // Only match test files in __tests__ directory
  testMatch: ['**/__tests__/**/*.test.js'],

  // Auto-clear mocks between tests for clean test isolation
  clearMocks: true,

  // Module name mapper for path aliases (if used)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Transform ignore patterns - jest-expo handles most, but add any custom ones here
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@react-native-firebase/.*)',
  ],

  // Collect coverage from src directory
  collectCoverageFrom: ['src/**/*.{js,jsx}', '!src/**/*.test.{js,jsx}', '!**/node_modules/**'],

  // Coverage directory
  coverageDirectory: 'coverage',

  // Verbose output for better debugging
  verbose: true,
};
