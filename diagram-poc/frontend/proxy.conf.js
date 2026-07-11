/**
 * Dev-server API proxy.  `/api/*` is forwarded to the Spring Boot backend on
 * :8080 so the auth session cookie stays first-party.
 *
 * Origin rewrite (why this is a .js and not the old .json): when you serve the
 * app over a LAN IP — `npm run start:lan`, e.g. to open it on a phone at
 * http://192.168.x.x:4200 — the browser treats the API call as same-origin, but
 * the forwarded request still carries `Origin: http://192.168.x.x:4200`. Spring
 * Security's CORS allowlist only knows localhost + *.arrow.com, so it rejects
 * that origin with "Invalid CORS request" and login fails. Rewriting the
 * forwarded Origin to the backend's own origin makes the request look
 * same-origin to Spring, so login works from localhost, a LAN IP, or a phone —
 * without touching any backend/auth configuration.
 */
module.exports = {
  '/api': {
    target: 'http://localhost:8080',
    secure: false,
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        if (proxyReq.getHeader('origin')) {
          proxyReq.setHeader('origin', 'http://localhost:8080');
        }
      });
    },
  },
};
