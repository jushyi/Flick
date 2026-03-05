/**
 * Expo config plugin to ensure NSSupportsLiveActivities is set in the
 * FlickNotificationService extension's build settings.
 *
 * CRITICAL: This plugin MUST use @bacons/apple-targets' own Xcode project API
 * (withXcodeProjectBeta). Do NOT use the 'xcode' npm package — it has an
 * incompatible pbxproj serializer that corrupts build settings written by
 * @bacons/apple-targets. See 09-RESEARCH.md "NSE Plist Fix" for full diagnosis.
 *
 * Strategy: Add INFOPLIST_KEY_NSSupportsLiveActivities=YES as a build setting.
 * When GENERATE_INFOPLIST_FILE=YES (set by @bacons/apple-targets), Xcode merges
 * INFOPLIST_KEY_* build settings into the generated Info.plist at build time.
 * This ensures NSSupportsLiveActivities=true appears in the final compiled plist.
 */
const { withXcodeProjectBeta } = require('@bacons/apple-targets/build/with-bacons-xcode');

module.exports = function withNSELiveActivities(config) {
  return withXcodeProjectBeta(config, async config => {
    const project = config.modResults;
    const targets = project.rootObject.props.targets;

    let found = false;
    for (const target of targets) {
      // Match by target name via getDisplayName() which returns props.name
      // Also check props.productName as fallback
      const name =
        (typeof target.getDisplayName === 'function' ? target.getDisplayName() : null) ||
        target.props?.productName;

      if (name === 'FlickNotificationService') {
        // Add NSSupportsLiveActivities to ALL build configurations (Debug + Release)
        // This sets the INFOPLIST_KEY_NSSupportsLiveActivities build setting,
        // which Xcode translates to NSSupportsLiveActivities=true in the generated plist
        target.setBuildSetting('INFOPLIST_KEY_NSSupportsLiveActivities', 'YES');
        found = true;
        console.log(
          '[withNSELiveActivities] Set INFOPLIST_KEY_NSSupportsLiveActivities=YES for',
          name
        );
        break;
      }
    }

    if (!found) {
      console.warn(
        '[withNSELiveActivities] Could not find FlickNotificationService target.',
        'Available targets:',
        targets.map(t => t.getDisplayName?.() || t.props?.productName || 'unknown').join(', ')
      );
    }

    return config;
  });
};
