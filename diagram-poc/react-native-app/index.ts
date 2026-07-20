// Gesture handler must be the very first import in the entry file (Android
// release builds crash otherwise).
import 'react-native-gesture-handler';

// Node-API polyfills must land before any library loads. y-websocket (via
// lib0) touches `Buffer`, which Hermes and browsers don't provide.
import { Buffer } from 'buffer';
if (typeof global.Buffer === 'undefined') {
  (global as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
