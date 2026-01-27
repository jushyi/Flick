// eslint.config.js
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  // Expo's React Native rules (includes React, RN globals, etc.)
  expoConfig,

  // Prettier integration - MUST be last to override conflicting rules
  eslintPluginPrettierRecommended,

  // Project-specific ignores
  {
    ignores: [
      'dist/*',
      'node_modules/*',
      '.expo/*',
      'android/*',
      'ios/*',
      'coverage/*',
      '.husky/*',
      'functions/*', // Cloud Functions have their own lint config
      'patches/*',
      'scripts/*',
    ],
  },

  // Rule overrides for Expo-specific packages
  {
    settings: {
      'import/ignore': ['@expo/vector-icons', 'react-native'],
    },
    rules: {
      // Allow @expo/vector-icons and @env which resolve at Expo runtime
      'import/no-unresolved': ['error', { ignore: ['^@expo/vector-icons$', '^@env$'] }],
      // Disable import/namespace for react-native (TypeScript parse issues)
      'import/namespace': 'off',
    },
  },

  // Jest test files - add Jest globals
  {
    files: ['__tests__/**/*.js', '__tests__/**/*.jsx'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        global: 'writable',
      },
    },
    rules: {
      // Allow duplicate keys in test factories (they're computed for user ID sorting)
      'no-dupe-keys': 'off',
    },
  },
]);
