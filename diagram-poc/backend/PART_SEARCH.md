# Part search — running against the live catalogue

Out of the box the app runs in **mock mode**: it serves the bundled sample
catalogue (`sample-partsearch.json` + `sample-parts.json`) so the whole
search → link → BOM flow works with no credentials. To hit the real catalogue,
switch off the mock and supply credentials.

## What the backend does

The frontend never talks to the catalogue directly. It calls
`GET /api/parts/search`, and the backend:

1. gets an OAuth2 **client-credentials** token from the auth host and caches it
   (this is the Bearer token you pasted into Postman by hand — the server mints
   it itself from the client id/secret, so the secret never reaches the browser);
2. calls the part service
   (`/eupartservice/search?srchtxt=…&render=json&appid=gen&start=…&limit=…`);
3. **normalises** the response — the catalogue returns one row per stocking
   location, so a common part comes back as dozens of near-identical rows; the
   server groups them by `itemId` into one part with its locations folded in
   (`PartSearchNormalizer`);
4. returns the typed, de-duplicated `PartSearchResponse`.

Mock and live go through the same normaliser, so both produce the identical
shape — the UI cannot tell which one served a result.

## Turning on live mode

Set these (environment variables, or a gitignored
`src/main/resources/application-local.properties` — copy
`application-local.properties.example`). **Never commit real secrets.**

```bash
export ARROW_MOCK=false
export ARROW_CLIENT_ID=…          # your APIM client id
export ARROW_CLIENT_SECRET=…      # your APIM client secret
```

Everything else already defaults to the working configuration:

| Property | Env var | Default |
|---|---|---|
| `arrow.auth-base-url` | `ARROW_AUTH_BASE_URL` | `https://gc-apiext-dev-apimgwt.apps.usdenpos02.arrow.com` |
| `arrow.token-path` | `ARROW_TOKEN_PATH` | `/auth/oauth2/token` |
| `arrow.search-base-url` | `ARROW_SEARCH_BASE_URL` | `https://gc-apim-dev1.azure-api.net` |
| `arrow.search-path` | `ARROW_SEARCH_PATH` | `/eupartservice/search` |
| `arrow.app-id` | `ARROW_APP_ID` | `gen` |
| `arrow.search-limit` | `ARROW_SEARCH_LIMIT` | `25` |

So the minimum to go live is `ARROW_MOCK=false` plus the two credentials. Point
`ARROW_SEARCH_PATH` at a different region's endpoint if needed.

## Verifying

The health endpoint reports which mode is active and whether auth is reachable,
without exposing secrets:

```bash
curl -s localhost:8080/api/parts/health | jq
# mock mode  → { "ok": true, "mock": true, "rows": 31, … }
# live mode  → { "mock": false, "searchUrl": "…/eupartservice/search", …auth status… }
```

Then a real search (needs a signed-in session cookie):

```bash
curl -s "localhost:8080/api/parts/search?q=BAV99&limit=25" | jq '.returned, (.parts|length), .total, .hasMore'
# 25   1   2222   true      ← 25 rows grouped to 1 part; 2222 total; more pages available
```

## Paging

The catalogue pages over **rows**, and rows are per-location, so a later page
usually adds locations to parts already shown rather than new parts. The API
exposes `start` / `limit`, and every response carries `start`, `returned`,
`nextStart`, `hasMore` and `total`. The UI's "Load more" button walks the pages
and merges each into the parts on screen (union of locations, stock roll-up
recomputed), reporting rows loaded (`20 of 2222 catalogue rows`) rather than
implying that many more parts remain.

## Troubleshooting

- **503 from `/api/parts/search`** — live mode is on but credentials are missing
  or blank (`arrow.client-id` / `arrow.client-secret`). `/api/parts/health`
  shows `configured: false`.
- **Auth host unreachable / 401 on the token call** — check `ARROW_AUTH_BASE_URL`
  and that the client id/secret are valid for that host; the token error surfaces
  the upstream cause.
- **Empty results but HTTP 200** — the search text matched nothing, or a region
  mismatch: confirm `ARROW_SEARCH_PATH` is the right regional endpoint.
- **Want the sample back** — unset `ARROW_MOCK` (or set it `true`); no
  credentials needed.
