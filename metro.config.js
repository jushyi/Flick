const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

config.transformer.getTransformOptions = async () => ({
  transform: {
    inlineRequires: {
      blockList: {
        [require.resolve('@powersync/react-native')]: true,
      },
    },
  },
});

module.exports = config;
