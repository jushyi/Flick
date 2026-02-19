// app.config.js
module.exports = ({ config }) => {
  const isProduction = process.env.APP_ENV === 'production';

  return {
    ...config,
    ios: {
      ...config.ios,
      // EAS sets this to file path during builds
      // Falls back to local file for development
      googleServicesFile: process.env.GOOGLE_SERVICES_PLIST ?? './GoogleService-Info.plist',
      entitlements: {
        ...config.ios.entitlements,
        'aps-environment': isProduction ? 'production' : 'development',
      },
    },
    android: {
      ...config.android,
      googleServicesFile: isProduction
        ? (process.env.GOOGLE_SERVICES_JSON_PROD ?? './google-services-prod.json')
        : (process.env.GOOGLE_SERVICES_JSON_DEV ?? './google-services.json'),
    },
  };
};
