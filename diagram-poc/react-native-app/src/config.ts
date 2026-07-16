/**
 * Runtime configuration.
 *
 * The Spring Boot service in `diagram-poc/backend` is the Backend-for-Frontend
 * (BFF). Override the URLs at build/run time with Expo public env vars, e.g.:
 *   EXPO_PUBLIC_API_URL=http://192.168.1.20:8080 npx expo start
 *
 * Defaults target a local backend:
 *  - Android emulator reaches the host via 10.0.2.2
 *  - iOS simulator / web reach it via localhost (pass the env var)
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8080';

export const API_PREFIX = '/api';

export const COLLAB_WS_URL =
  process.env.EXPO_PUBLIC_COLLAB_WS_URL ?? 'ws://10.0.2.2:1234';

export const apiRoot = `${API_BASE_URL}${API_PREFIX}`;
