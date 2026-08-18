# The artifacts API

Everything a design produces as a **file**: block diagrams as PNG, tabular
things as spreadsheets, everything else as PDF. Sibling of the
[tabs API](./sfdc-embed-api.md) — same service, same audience rule, same
key/value vocabulary.

```
GET /api/sfdc/opportunities/{opportunityId}/artifacts?embed=true
GET /api/sfdc/opportunities/{opportunityId}/artifacts/{artifactId}?embed=true
```

Served by the **Design Workspace backend** (`diagram-poc/dws-backend`, port
8091).

| | |
|---|---|
| Auth | **None.** POC only — see [Before this is real](#before-this-is-real) |
| Caching | `Cache-Control: no-store` on downloads. A stale approved document is the one thing this must not serve |

## Why two endpoints

The list returns **metadata only** — names, sizes, download URLs. A client that
wants to draw a file list gets it in one small response instead of
base64-inflating every artifact on every call. The download returns one file
with the right `Content-Type`.

Both sit under the opportunity, so the audience filter is applied in one place
and a download cannot be reached by guessing an id on its own.

## Formats

Three, and only three — a customer opens all of them without installing
anything. The mapping is stated once, on `ArtifactKind`, so adding a kind
*forces* a format decision rather than leaving one to a call site.

| Kind | Format | One per |
|---|---|---|
| `DESIGN_SUMMARY` | PDF | design |
| `BLOCK_DIAGRAM` | **PNG** | diagram |
| `BILL_OF_MATERIALS` | XLSX | design (if it has parts) |
| `QUERY_LOG` | XLSX | design (if it has queries) |
| `DOCUMENT` | PDF | document filed against the design |

Artifacts are **derived, not stored**. Nothing is uploaded and nothing is kept
on disk — the list and the download compute the same set from the same code, so
they cannot disagree about what exists.

## What `embed=true` leaves out

Same rule as the tabs API: internal artifacts are **absent** from the response,
not marked and returned. Visibility is inherited from whatever the artifact was
derived from:

- **a document** carries its own visibility
- **a block diagram** is customer-visible only once it is *approved* — a diagram
  still being reworked is not something to hand a customer
- **the query log** is always internal: the questions an FAE is still chasing
  are not a customer-facing document
- **the summary and the bill of materials** are customer-visible

An id that is filtered out is also not downloadable — `GET .../artifacts/query-log?embed=true`
is a 404, not a 403, because "it does not exist for you" is the only thing the
embed is entitled to learn.

On PRJ-008 that is **9 artifacts internally, 3 embedded**:

```bash
curl -s ".../artifacts?embed=false" | jq '[.artifacts[].id]'
# ["summary","diagram-BD-1330","diagram-BD-1338","diagram-BD-1341",
#  "bill-of-materials","query-log","document-redundant-power-stage-rev-c-pdf",
#  "document-validation-findings-xlsx","document-sil-4-evidence-pack-pdf"]

curl -s ".../artifacts" | jq '[.artifacts[].id]'
# ["summary","bill-of-materials","document-sil-4-evidence-pack-pdf"]
```

## The list response

```jsonc
{
  "opportunityId":  "0061t00000TuVwXyZaBc",
  "designId":       "PRJ-008",
  "name":           "Railway Signaling System",
  "customer":       "Hitachi Rail",
  "audience":       "internal",          // or "embedded"
  "artifactCount":  9,
  "totalSizeBytes": 96907,
  "generatedAt":    "2026-08-07T09:02:11.204Z",

  "artifacts": [
    {
      "id":          "diagram-BD-1330",       // stable; safe in a URL
      "fileName":    "Signalling Interface.png",
      "title":       "Signalling Interface",
      "description": "Rev B · In review",
      "kind":        "BLOCK_DIAGRAM",
      "kindLabel":   "Block diagram",
      "format":      "png",                   // png · pdf · xlsx
      "mediaType":   "image/png",
      "sizeBytes":   26990,
      "inline":      true,                    // a browser will display it
      "downloadUrl": "/api/sfdc/opportunities/0061t00000TuVwXyZaBc/artifacts/diagram-BD-1330",
      "fields": [
        { "key": "kind",   "label": "Kind",   "value": "Block diagram", "tone": "neutral" },
        { "key": "format", "label": "Format", "value": "Image",         "tone": "info"    },
        { "key": "size",   "label": "Size",   "value": "26 KB",         "tone": "neutral" }
      ]
    }
    // …8 more
  ]
}
```

`fields` is the **same shape the tabs API uses** — `key` / `label` / `value` /
`tone`. A client that already renders a tab row renders an artifact row with the
same component and no second vocabulary.

`sizeBytes` is exact, not estimated: the list renders each artifact to measure
it. That is honest and it is fine for a fixture — see
[Before this is real](#before-this-is-real).

## The download

```
GET /api/sfdc/opportunities/{opportunityId}/artifacts/{artifactId}
```

```
Content-Type:        application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="PRJ-008 bill of materials.xlsx"
Content-Length:      4061
Cache-Control:       no-store
```

**PNGs and PDFs are sent `inline`**, so a `<img src={downloadUrl}>` shows a
block diagram with no extra work. **Spreadsheets are sent as an attachment**,
because a browser cannot render one and would otherwise show bytes. `inline` in
the list tells a client which it will get without parsing a header.

Filenames are stripped to ASCII on the way out and the header carries **no
charset**. With one, Spring encodes the plain `filename` parameter as an
RFC 2047 word — `=?UTF-8?Q?...?=` — which browsers ignore in favour of
`filename*` but `curl` and most HTTP client libraries do not: they save the
literal encoded string as the file's name. There is a test holding this.

404 for an unknown opportunity, and for an artifact id this audience may not
see.

## Rendering

| Format | Written with | Notes |
|---|---|---|
| PNG | Java2D | 1200 × 675 (16:9), so it drops into a slide or a card without letterboxing |
| XLSX | Apache POI | header row, one row per item, at-risk and open rows highlighted |
| PDF | PDFBox | A4, wraps to the page, breaks pages by itself |

The PDF fonts are the standard WinAnsi-encoded ones, which **throw** on a
character they cannot encode — an em dash in a project name would otherwise fail
the whole download. Text is sanitised on the way in (em dash → hyphen, degree
sign → `deg`, and so on) rather than rejected. The bullet `•` is explicitly kept:
it *is* in WinAnsi, and a catch-all that dropped it would make every list in
every PDF read `?`. There is a test holding that too.

> If you dump the PDF's text on a terminal and see `?` where the bullets are,
> that is the terminal's encoding, not the file's. Check the code point.

Each renderer implements `ArtifactRenderer` and declares the kind it handles.
`ArtifactRendererRegistry` **fails at startup** if any kind has no renderer, or
two — a kind that lists fine and 500s on download is not a failure mode worth
shipping.

## Try it

```bash
cd diagram-poc/dws-backend && mvn spring-boot:run
B=localhost:8091/api/sfdc/opportunities/0061t00000TuVwXyZaBc/artifacts

curl -s "$B?embed=false" | jq '[.artifacts[] | {id, format, sizeBytes}]'

# the files are real files
curl -s "$B/diagram-BD-1330?embed=false" -o d.png && file d.png
curl -s "$B/summary" -o s.pdf            && file s.pdf
curl -s "$B/bill-of-materials" -o b.xlsx && file b.xlsx
# d.png: PNG image data, 1200 x 675 …
# s.pdf: PDF document, version 1.4
# b.xlsx: Microsoft Excel 2007+
```

## Consuming it from Salesforce

```js
const res  = await fetch(`${base}/api/sfdc/opportunities/${oppId}/artifacts?embed=true`);
const { artifacts } = await res.json();

// a diagram needs no download step — point an <img> at it
const diagrams = artifacts.filter(a => a.format === 'png');

// everything else is a download link
const files = artifacts.filter(a => a.format !== 'png');
```

CORS is open by default (`dws.cors.allowed-origin-patterns: "*"`) — the
Salesforce org is not known yet, and this is safe only because credentials are
off. Narrow it once the real org host is known.

## Before this is real

1. **No caller identity, so no entitlement check.** Anyone who knows an
   opportunity id gets an answer. `embed=true` filters *content*, not *access*.
2. **Rendering on every call.** The list renders each artifact to report an
   exact size, and the download renders again. Acceptable against a fixture
   where the largest file is 27 KB; against real diagrams it needs a content
   hash and a cache, with the size stored rather than measured.
3. **Documents are generated, not served.** The fixture holds document
   *metadata*, not bytes, so a "document" download is a PDF cover sheet built
   from what is known about it. That is why a source file called
   `Validation findings.xlsx` comes back as a PDF. Once documents have real
   storage behind them, `DocumentPdfRenderer` streams the stored file and the
   format follows the file rather than the kind.
4. **Diagram PNGs are drawn from the parts list**, not from the block diagram
   service's canvas. The real version fetches the rendered canvas from BLK — the
   `ArtifactRenderer` port is the seam where that swap happens, and no caller
   changes.
