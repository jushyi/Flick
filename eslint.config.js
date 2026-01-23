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
      // Allow @expo/vector-icons which resolves at Expo runtime
      'import/no-unresolved': ['error', { ignore: ['^@expo/vector-icons$'] }],
      // Disable import/namespace for react-native (TypeScript parse issues)
      'import/namespace': 'off',
    },
  },
]);
