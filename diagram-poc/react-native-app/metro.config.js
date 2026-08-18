// Metro configuration.
// Alias `isomorphic-webcrypto` (pulled in by Yjs's lib0 on React Native) to a
// small JS shim, so the app bundles in Expo Go without that native module.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const webcryptoShim = path.resolve(__dirname, 'shims/isomorphic-webcrypto.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'isomorphic-webcrypto' || moduleName.startsWith('isomorphic-webcrypto/')) {
    return { type: 'sourceFile', filePath: webcryptoShim };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
