// app.config.js
module.exports = ({ config }) => {
  const isProduction = process.env.APP_ENV === 'production';

  return {
    ...config,
    name: isProduction ? 'Flick' : 'Flick Dev',
    ios: {
      ...config.ios,
      bundleIdentifier: isProduction ? 'com.spoodsjs.flick' : 'com.spoodsjs.flick.dev',
      // EAS sets this to file path during builds
      // Falls back to local file for development
      googleServicesFile: process.env.GOOGLE_SERVICES_PLIST ?? './GoogleService-Info.plist',
      entitlements: {
        ...config.ios.entitlements,
        'aps-environment': isProduction ? 'production' : 'development',
        'com.apple.security.application-groups': ['group.com.spoodsjs.flick'],
      },
    },
    android: {
      ...config.android,
      package: isProduction ? 'com.spoodsjs.flick' : 'com.spoodsjs.flick.dev',
      googleServicesFile: isProduction
        ? (process.env.GOOGLE_SERVICES_JSON_PROD ?? './google-services-prod.json')
        : (process.env.GOOGLE_SERVICES_JSON_DEV ?? './google-services.json'),
    },
  };
};
