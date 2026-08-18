import { environment } from '../../environments/environment';

/**
 * Resolve the backend API base URL. Uses `environment.apiBase` when set
 * (full URL or same-origin path); otherwise derives it from the current page so
 * the protocol matches — `https://` on an HTTPS page, `http://` on HTTP — which
 * prevents mixed-content blocking after an HTTPS deploy.
 */
export function apiBaseUrl(): string {
  const override = environment.apiBase;
  if (override) {
    return override.startsWith('/') ? `${window.location.origin}${override}` : override;
  }
  const host = window.location.hostname || 'localhost';
  return `${window.location.protocol}//${host}:${environment.apiPort}/api`;
}

/**
 * Resolve the collaboration WebSocket URL. Uses `environment.collabUrl` when set
 * (full ws/wss URL or same-origin path); otherwise derives it with a protocol
 * matching the page — `wss://` on HTTPS, `ws://` on HTTP.
 */
export function collabServerUrl(): string {
  const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const override = environment.collabUrl;
  if (override) {
    return override.startsWith('/') ? `${wsProto}://${window.location.host}${override}` : override;
  }
  const host = window.location.hostname || 'localhost';
  return `${wsProto}://${host}:${environment.collabPort}`;
}
