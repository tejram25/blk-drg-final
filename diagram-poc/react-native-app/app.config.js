// Extends the static app.json. Adds a web sub-path base URL so the exported
// site can live under e.g. https://host/diagram-builder-mobile/ (set
// EXPO_BASE_URL=/diagram-builder-mobile at export time). Empty base = root,
// which keeps native and local web dev unchanged.
module.exports = ({ config }) => ({
  ...config,
  web: { ...config.web, output: 'single', bundler: 'metro' },
  experiments: { ...(config.experiments || {}), baseUrl: process.env.EXPO_BASE_URL || '' },
});
