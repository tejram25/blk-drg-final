// Required so babel-preset-expo runs: it inlines EXPO_PUBLIC_* env vars at build
// time. Without it, a standalone (Hermes) build references `process`, which
// doesn't exist in Hermes → the app crashes immediately on launch. (Expo Go
// works without it because the dev runtime provides `process`.)
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
