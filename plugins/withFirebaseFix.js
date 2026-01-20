const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to fix React Native Firebase build issues with Expo 54
 *
 * This plugin:
 * 1. Adds CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES build setting
 * 2. This is required for firebase-ios-sdk to compile correctly with useFrameworks: static
 *
 * See: https://github.com/invertase/react-native-firebase/issues/8657
 */
const withFirebaseFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      if (fs.existsSync(podfilePath)) {
        let podfileContent = fs.readFileSync(podfilePath, 'utf8');

        // Add the build setting after post_install
        const postInstallFix = `
    # Fix for React Native Firebase with Expo 54
    installer.pods_project.build_configurations.each do |config|
      config.build_settings["CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES"] = "YES"
    end`;

        // Find the post_install block and add our fix
        if (!podfileContent.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
          // Look for the closing of the post_install block
          const postInstallRegex = /(post_install do \|installer\|[\s\S]*?)(^  end)/m;
          podfileContent = podfileContent.replace(postInstallRegex, `$1${postInstallFix}\n$2`);

          fs.writeFileSync(podfilePath, podfileContent);
        }
      }

      return config;
    },
  ]);
};

module.exports = withFirebaseFix;
