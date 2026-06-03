module.exports = {
  assets: ['./assets/', './node_modules/react-native-vector-icons/Fonts'],
  dependencies: {
    '@react-navigation/elements': {
      platforms: {
        android: null, // disable Android platform, might help
      },
    },
    'react-native-vector-icons': {
      platforms: {
        ios: {},
        android: {},
      },
    },
  },
resolve: {
      fallback: {
        crypto: require.resolve('crypto-js'),//'react-native-quick-crypto'), //require.resolve('crypto-browserify'),
      },
    }
};
