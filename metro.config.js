// const { getDefaultConfig } = require('@react-native/metro-config');

// module.exports = (async () => {
//   const defaultConfig = await getDefaultConfig();
//   const { assetExts } = defaultConfig.resolver;

//   return {
//     transformer: {
//       getTransformOptions: async () => ({
//         transform: {
//           experimentalImportSupport: false,
//           inlineRequires: true,
//         },
//       }),
//     },
//     resolver: {
//       ...defaultConfig.resolver,
//       assetExts: [...assetExts],
//       sourceExts: ['js', 'json', 'ts', 'tsx', 'jsx'],
//       resolverMainFields: ['react-native', 'browser', 'main'],
//     },
//   };
// })();
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
