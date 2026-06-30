# Arrow APIM Part Search — Postman

Test the Arrow part-search flow directly (token → search), independent of the app.

## Files
- `ArrowPartSearch.postman_collection.json` — the two requests.
- `ArrowPartSearch-DEV.postman_environment.json` — DEV endpoints.
- `ArrowPartSearch-QUAL.postman_environment.json` — QUAL endpoints.

## Use
1. **Import** the collection and one environment (Postman → Import → drop the files).
2. **Select** the environment (top-right dropdown), then open its variables and fill in
   `client_id` and `client_secret` (created for that environment — DEV and QUAL use
   separate credentials).
3. Run **`1. Get OAuth Token`** — on success the script saves the token into `part_token`.
4. Run **`2. Part Search`** — change `srchtxt` (default `BAV99`) for other parts. The
   search path defaults to `/arrowapi/dw/partservice/search` (`search_path` variable).

## Reading failures on request 1
- **503** — the auth service/route is unavailable (usually the environment is down, not
  your credentials). The response body often shows an "Application is not available" page.
- **401 / 403** — credentials rejected (wrong id/secret, or not valid for this environment).
- **404** — wrong token path/host.
- **Could not get a response / timeout** — you're not on the Arrow network/VPN.

These map 1:1 to what the backend reports at `GET /api/parts/health`.

> Credentials are NOT committed — the `client_id` / `client_secret` fields ship blank.
