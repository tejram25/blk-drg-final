/**
 * Minimal WebCrypto shim so Yjs's `lib0` resolves on React Native (Expo Go).
 * lib0's webcrypto.react-native.cjs requires `isomorphic-webcrypto`, whose
 * native module isn't available in Expo Go; Metro aliases that import here.
 *
 * Uses the platform's global crypto when present (web / Hermes with a polyfill),
 * otherwise falls back to a Math.random fill — good enough for Yjs client IDs
 * and update encoding in this app (not used for anything security-sensitive).
 */
const g = typeof global !== 'undefined' ? global : {};
const native = g.crypto && typeof g.crypto.getRandomValues === 'function' ? g.crypto : null;

function getRandomValues(typedArray) {
  if (native) return native.getRandomValues(typedArray);
  for (let i = 0; i < typedArray.length; i++) {
    typedArray[i] = Math.floor(Math.random() * 256);
  }
  return typedArray;
}

const webcrypto = { getRandomValues, subtle: native ? native.subtle : undefined };

module.exports = webcrypto;
module.exports.default = webcrypto;
module.exports.getRandomValues = getRandomValues;
module.exports.subtle = webcrypto.subtle;
