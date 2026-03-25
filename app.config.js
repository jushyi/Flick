// app.config.js
module.exports = ({ config }) => {
  const isProduction = process.env.APP_ENV === 'production';

  return {
    ...config,
    name: isProduction ? 'Flick' : 'Flick Dev',
    ios: {
      ...config.ios,
      bundleIdentifier: isProduction ? 'com.spoodsjs.flick' : 'com.spoodsjs.flick.dev',
      entitlements: {
        ...config.ios.entitlements,
        'aps-environment': isProduction ? 'production' : 'development',
        'com.apple.security.application-groups': ['group.com.spoodsjs.flick'],
      },
    },
    android: {
      ...config.android,
      package: isProduction ? 'com.spoodsjs.flick' : 'com.spoodsjs.flick.dev',
    },
  };
};
