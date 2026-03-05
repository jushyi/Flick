/**
 * Expo config plugin to ensure NSSupportsLiveActivities is in the
 * FlickNotificationService extension's built Info.plist.
 *
 * Strategy: Disable GENERATE_INFOPLIST_FILE so Xcode uses the manually
 * managed Info.plist from targets/FlickNotificationService/ as-is,
 * preserving our NSSupportsLiveActivities key.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');
const xcode = require('xcode');

module.exports = function withNSELiveActivities(config) {
  return withDangerousMod(config, [
    'ios',
    async config => {
      const iosDir = config.modRequest.platformProjectRoot;
      const projectName = config.modRequest.projectName;

      const pbxprojPath = path.join(iosDir, `${projectName}.xcodeproj`, 'project.pbxproj');

      if (!fs.existsSync(pbxprojPath)) {
        console.warn('[withNSELiveActivities] .pbxproj not found at', pbxprojPath);
        return config;
      }

      const project = xcode.project(pbxprojPath);
      project.parseSync();

      const targetName = 'FlickNotificationService';
      let modified = false;

      const nativeTargets = project.pbxNativeTargetSection();
      for (const key of Object.keys(nativeTargets)) {
        const target = nativeTargets[key];
        if (typeof target === 'object' && target.name === targetName) {
          const configListId = target.buildConfigurationList;
          const configLists = project.pbxXCConfigurationList();
          const configList = configLists[configListId];

          if (configList && configList.buildConfigurations) {
            const buildConfigs = project.pbxXCBuildConfigurationSection();
            for (const configEntry of configList.buildConfigurations) {
              const configId = configEntry.value;
              const buildConfig = buildConfigs[configId];

              if (buildConfig && buildConfig.buildSettings) {
                // Disable auto-generation so Xcode uses our Info.plist directly
                buildConfig.buildSettings.GENERATE_INFOPLIST_FILE = 'NO';
                // Also set via build setting as belt-and-suspenders
                buildConfig.buildSettings.INFOPLIST_KEY_NSSupportsLiveActivities = 'YES';
                modified = true;
              }
            }
          }
          break;
        }
      }

      if (modified) {
        fs.writeFileSync(pbxprojPath, project.writeSync());
        console.log('[withNSELiveActivities] Configured', targetName, 'for Live Activities');
      } else {
        console.warn('[withNSELiveActivities] Could not find target:', targetName);
      }

      return config;
    },
  ]);
};
