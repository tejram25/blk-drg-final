import Constants from 'expo-constants';

/**
 * Runtime configuration.
 *
 * The Spring Boot service in `diagram-poc/backend` is the Backend-for-Frontend
 * (BFF). Resolution order for the API host:
 *   1. EXPO_PUBLIC_API_URL (explicit override), e.g.
 *        EXPO_PUBLIC_API_URL=http://192.168.1.20:8080 npx expo start
 *   2. In Expo Go dev, the LAN IP the JS bundle was served from — the phone
 *      loaded the app from your PC's Metro (192.168.x.x:8081), and the backend
 *      runs on that same machine, so we target http://<that-ip>:8080.
 *   3. localhost (simulator / web).
 */

/** The dev machine's host (IP) that served this bundle, if running in Expo Go. */
function devHost(): string | null {
  const c = Constants as unknown as {
    expoConfig?: { hostUri?: string };
    expoGoConfig?: { debuggerHost?: string };
    manifest?: { debuggerHost?: string; hostUri?: string };
    manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } };
  };
  const hostUri =
    c.expoConfig?.hostUri ||
    c.expoGoConfig?.debuggerHost ||
    c.manifest2?.extra?.expoGo?.debuggerHost ||
    c.manifest?.debuggerHost ||
    c.manifest?.hostUri;
  if (typeof hostUri === 'string') {
    const host = hostUri.split('://').pop()!.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
  }
  return null;
}

const host = devHost();

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? (host ? `http://${host}:8080` : 'http://localhost:8080');

export const API_PREFIX = '/api';

export const COLLAB_WS_URL =
  process.env.EXPO_PUBLIC_COLLAB_WS_URL ?? (host ? `ws://${host}:1234` : 'ws://localhost:1234');

// EXPO_PUBLIC_API_ROOT (when set) is used verbatim, so a reverse-proxy path like
// `https://host/diagram-api` maps straight to the backend without appending /api.
export const apiRoot = process.env.EXPO_PUBLIC_API_ROOT ?? `${API_BASE_URL}${API_PREFIX}`;
