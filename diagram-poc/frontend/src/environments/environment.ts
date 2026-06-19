/**
 * Runtime endpoints for the backend API and the collaboration WebSocket.
 *
 * Leave `apiBase` / `collabUrl` empty to AUTO-DERIVE from the page: same
 * protocol and hostname as the app, with the ports below. On an HTTPS page the
 * derived URLs automatically use `https://` and `wss://`, which avoids the
 * mixed-content blocking you'd otherwise hit after deploying over HTTPS.
 *
 * To point elsewhere, set either value to:
 *   - a full URL:           'https://api.example.com/api'  /  'wss://collab.example.com'
 *   - a same-origin path:   '/api'  /  '/collab'   (handy behind a reverse proxy)
 */
export const environment = {
  production: false,
  // Same-origin via the Angular dev proxy (proxy.conf.json -> :8080) so the auth
  // session cookie is first-party. Collab stays auto-derived (ws://host:1234).
  apiBase: '/api',
  collabUrl: '',
  apiPort: 8080,
  collabPort: 1234,
};
