module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ['react-native-reanimated/plugin'],
    ['react-native-paper/babel'],
    ['@babel/plugin-transform-private-methods', { loose: true }],
    [
      "module:react-native-dotenv", {
        "moduleName": "@env",
        "path": ".env",
        "safe": false,
        "allowUndefined": true,        
        "blocklist": null,
        "allowlist": null,
        "verbose": false
      },
    ],
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: [
          '.ios.ts',
          '.android.ts',
          '.ts',
          '.js',
          '.jsx',
          '.ios.tsx',
          '.android.tsx',
          '.tsx',
          '.jsx',
          '.js',
          '.json',
        ],
        alias: {
          '@app': './src',
          'crypto': 'crypto-js',
        },
      },
    ],
  ],
};
