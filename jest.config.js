function canUseReactNativePreset() {
  try {
    require.resolve('react-native/jest/preset');
    return true;
  } catch {
    return false;
  }
}

/** Fallback when react-native is not fully installed (e.g. partial npm install). */
const nodePreset = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx)$': [
      'babel-jest',
      {
        presets: [
          ['@babel/preset-env', {targets: {node: 'current'}}],
          '@babel/preset-typescript',
        ],
      },
    ],
    '^.+\\.js$': [
      'babel-jest',
      {presets: [['@babel/preset-env', {targets: {node: 'current'}}]]},
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
};

module.exports = canUseReactNativePreset()
  ? {preset: 'react-native'}
  : nodePreset;
