/**
 * Production endpoints. Same shape as environment.ts (see it for the rules).
 *
 * Defaults to auto-deriving from the page (matching protocol/host + the ports
 * below). For a typical reverse-proxy deployment where the API and collab
 * server sit behind the same HTTPS origin, set e.g.:
 *   apiBase: '/api',  collabUrl: '/collab'
 */
export const environment = {
  production: true,
  // Same-origin reverse proxy (recommended — see DEPLOYMENT.md). Session-based auth
  // needs the API same-origin so the session cookie is first-party (not SameSite=None).
  // Unique path prefixes are used because this Apache vhost is shared with other apps;
  // Apache maps /diagram-api/ -> backend /api/ and /diagram-collab -> the y-websocket server.
  apiBase: '/diagram-api',
  collabUrl: '/diagram-collab',
  apiPort: 8080,
  collabPort: 1234,
};
