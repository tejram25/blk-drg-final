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
| `arrow.search-path` | `ARROW_SEARCH_PATH` | *(empty — derived from the region)* |
| `arrow.app-id` | `ARROW_APP_ID` | `gen` |
| `arrow.search-limit` | `ARROW_SEARCH_LIMIT` | `25` |
| `arrow.region` | `ARROW_REGION` | `eu` |

So the minimum to go live is `ARROW_MOCK=false` plus the two credentials. See
[Regions](#regions) for searching another region.

## Regions

The part service is deployed per region and the region is the path prefix:

| Region | Path |
|---|---|
| `eu` — Europe | `/eupartservice/search` |
| `ap` — Asia Pacific | `/appartservice/search` |
| `ac` — Americas | `/acpartservice/search` |

Same contract and same response shape everywhere — but **not the same answers**.
Stock, lead time, pricing, lifecycle status and the stocking sites all come from
that region's warehouses and ERP, so the same part number gives different
figures per region. That is why region is a request parameter rather than
deployment config: a board built in Penang and the same board built in Munich
are different sourcing questions.

```
GET /api/parts/search?q=BAV99&region=ap     # search one region
GET /api/parts/regions                      # regions this deployment offers
GET /api/parts/availability?part=LM317T     # the same part in every region
```

An unknown region code is a 400 rather than a silent fallback — otherwise a typo
returns another region's stock figures, which looks like a valid answer.

### Configuration

`arrow.region` is only the default for requests that do not name one.

```bash
export ARROW_REGION=ap        # default region for requests that omit one
```

`arrow.search-path` is normally left blank so the path derives from the region.
Set it only for a deployment that does not follow the
`/{region}partservice/search` convention; it then overrides every region.

### Request parameters

The search itself is plain: `srchtxt`, `render=json`, `appid`, `start`, `limit`.
The region only changes the path.

The sample URL from the part-search team carries ~35 further parameters —
`ioebs`, `source=Workbench`, `srchmode`, `whsetype`, `retWhseFilter`,
`ftzBoostFlag`, plus customer and order context (`billto`, `shipto`, `custnum`,
`headerId`, `lineId`, …). Those belong to Workbench, an order-entry tool that
knows which customer it is quoting for and where the goods ship. A block diagram
has no customer and no order line, so none of them are sent.

Part numbers containing `#` (`LTC1732EMS-4.2#PBF`) are percent-encoded — left
raw, the `#` would open a URI fragment and drop every parameter after it.

### Mock mode

The bundled sample is one region's data. Mock mode applies a fixed per-region
skew (AP: longer leads, thinner stock; AC: deeper stock, higher price) so the
region selector and the comparison view show real differences rather than three
identical columns. The skew is deterministic, not random, so repeated searches
agree with each other.

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
- **Empty results but HTTP 200** — the search text matched nothing in that
  region. Try another region: a part stocked in the Americas may be absent from
  the EU catalogue entirely.
- **Plausible results but wrong figures** — likely the wrong region. Stock, lead
  and price are all regional; `/api/parts/health` reports the active region and
  the exact query built for each one.
- **Want the sample back** — unset `ARROW_MOCK` (or set it `true`); no
  credentials needed.
