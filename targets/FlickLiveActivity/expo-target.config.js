/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'widget',
  name: 'FlickLiveActivity',
  bundleIdentifier: '.FlickLiveActivity',
  deploymentTarget: '16.2',
  frameworks: ['SwiftUI', 'ActivityKit', 'WidgetKit'],
  entitlements: {
    'com.apple.security.application-groups': ['group.com.spoodsjs.flick'],
  },
};
