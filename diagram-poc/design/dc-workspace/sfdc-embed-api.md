# The Salesforce embed API

One endpoint. Salesforce calls it once per opportunity and renders what comes
back. It does not need to know which tabs exist, what order they go in, or how
to draw any of them — **adding a tab here is not a Salesforce release.**

```
GET /api/sfdc/opportunities/{opportunityId}/tabs?embed=true
```

Served by the **Design Workspace backend** (`diagram-poc/dws-backend`, port
8081), not by the block diagram backend. That split is the architecture, not an
accident: DWS owns designs, documents and approval; BLK owns diagrams. See
[dws-backend/README.md](../../dws-backend/README.md) for the internals.

| | |
|---|---|
| Auth | **None.** POC only — see [Before this is real](#before-this-is-real) |
| Content type | `application/json` |
| Caching | None. Every call reads live, so a change is visible on the next click |

## Parameters

| Name | In | Default | Meaning |
|---|---|---|---|
| `opportunityId` | path | — | Salesforce opportunity id |
| `embed` | query | `true` | `true` returns the embedded variant. `false` returns the same tabs with the controls the workspace itself shows |

`embed` defaults to `true` because the only caller today is the embed —
forgetting the parameter must not serve the internal variant by accident.

**What `embed=true` actually changes.** Internal content is left out of the
payload, so a client reading the raw JSON cannot recover it:

- internal-only documents are not in `items`, and the badge counts what is
  actually returned
- the `margin` field is absent from `overview`
- documents carry no `visibility` field, because there is nothing to disclose
- every tab reports `readOnly: true`

On the wire the flag becomes an `Audience` — `embedded` or `internal` — and the
response echoes which one it used. It is an enum rather than a boolean inside
the service so a third audience is a new constant, not a change to every
signature that carries the flag.

## Response

Data, not markup — the client renders. Every tab has the **same shape**: some
tab-level key/value pairs, then a list of items that are each themselves a set
of key/value pairs. One renderer covers all seven tabs, and a tab gaining a
field is a server change, not a Salesforce release.

```jsonc
{
  "opportunityId": "0061t00000TuVwXyZaBc",
  "designId":      "PRJ-008",
  "name":          "Railway Signaling System",
  "customer":      "Hitachi Rail",
  "value":         "$4.5M",
  "stage":         "Validation/Testing",
  "region":        "AP",
  "owner":         "Anna Martinez",
  "audience":      "embedded",          // or "internal"
  "generatedAt":   "2026-08-07T04:16:58.489663435Z",

  "tabs": [
    {
      "key":      "part-intel",          // stable; safe in a URL or a DOM id
      "label":    "Part Intelligence",   // what the user sees
      "icon":     "search",              // Lucide name, same as the workspace UI
      "order":    3,                     // ascending
      "badge":    "4",                   // for the tab strip, or null
      "readOnly": true,

      // tab-level summary
      "fields": [
        { "key": "partCount",   "label": "Parts",                  "value": "4", "tone": "neutral" },
        { "key": "partsAtRisk", "label": "Not in full production", "value": "1", "tone": "warning" }
      ],

      // the rows — each one its own object of key/value pairs
      "items": [
        {
          "key":      "SN65HVD255",
          "title":    "SN65HVD255",
          "subtitle": "Texas Instruments",
          "fields": [
            { "key": "function",  "label": "Function",  "value": "CAN transceiver", "tone": "neutral"  },
            { "key": "lifecycle", "label": "Lifecycle", "value": "Last time buy",   "tone": "critical" },
            { "key": "leadTime",  "label": "Lead time", "value": "30 weeks",        "tone": "neutral"  },
            { "key": "stock",     "label": "Stock",     "value": "60",              "tone": "neutral"  }
          ]
        }
      ],

      "note": "1 part is not in full production. See the AI Assistant tab for alternates."
    }
    // …6 more
  ]
}
```

The header fields are a copy of what Salesforce already holds. They are
returned so the embed can render standalone without a second lookup — not
because this service owns them.

### Field

| Field | Meaning |
|---|---|
| `key` | stable identifier — branch on this, never show it |
| `label` | the human label |
| `value` | already formatted for display; always a string |
| `tone` | `neutral` · `positive` · `warning` · `critical` · `info` |

**`tone` is domain knowledge, not styling.** Knowing that *Last time buy* is
critical and *NRND* is a warning belongs on the server, not in a switch
statement inside a Lightning component. The client maps the five tones to
whatever colours it likes and never has to parse a value.

### Item

`key`, `title`, `subtitle` (may be null), and `fields` — the row's own pairs,
in display order. `items` is empty for a tab that is only a summary
(`overview`).

### The tabs

| # | key | Label | Items are | Badge counts |
|---|---|---|---|---|
| 1 | `overview` | Overview | — (fields only) | — |
| 2 | `block-diagrams` | Block Diagrams | diagrams | diagrams |
| 3 | `part-intel` | Part Intelligence | parts | parts |
| 4 | `fast-repo` | FAST Repository | documents | documents **this variant returns** |
| 5 | `support` | Support / Query | queries | **open** queries only |
| 6 | `ai-assistant` | AI Assistant | suggestions | suggestions |
| 7 | `supplier-collab` | Suppliers | suppliers | suppliers |

Counts always describe what the caller actually received — the document badge
reads `2` on the embedded variant and `4` on the internal one, and there is a
test holding it to that.

## Fixture

Three designs, held in code (`InMemoryDesignRepository`, behind the
`DesignRepository` port). The numbers
mirror the Design Workspace prototype so the embed and the workspace tell the
same story about the same projects.

| Opportunity id | Project | Customer | Notable |
|---|---|---|---|
| `0061t00000AbCdEfGhI` | PRJ-001 EV Battery Management System | Tesla Motors | an NRND part, 2 of 4 documents customer-visible |
| `0061t00000JkLmNoPqRs` | PRJ-003 Smart Grid Controller | ABB Ltd | design frozen, no open queries |
| `0061t00000TuVwXyZaBc` | PRJ-008 Railway Signaling System | Hitachi Rail | 2 open queries, a last-time-buy part, a diagram needing rework |

Anything else returns **404** with a message naming the opportunity — the
honest answer, since "no project is linked to it" and "you may not see it" are
different states and only the first exists today.

## Try it

```bash
cd diagram-poc/dws-backend && mvn spring-boot:run

curl -s "localhost:8081/api/sfdc/opportunities/0061t00000AbCdEfGhI/tabs?embed=true" | jq '.tabs[] | {order, key, badge}'

# the difference the flag makes
for e in true false; do
  curl -s "localhost:8081/api/sfdc/opportunities/0061t00000AbCdEfGhI/tabs?embed=$e" \
    | jq --arg e "$e" '"embed=\($e): \([.tabs[] | select(.key=="fast-repo") | .items[].key] | join(", "))"'
done
```

## Consuming it from Salesforce

One renderer, because every tab is the same shape:

```js
const res  = await fetch(`${base}/api/sfdc/opportunities/${oppId}/tabs?embed=true`);
const data = await res.json();

// tab.label + tab.badge drive the tab strip
function renderTab(tab) {
  return {
    summary: tab.fields.map(f => ({ label: f.label, value: f.value, css: TONE[f.tone] })),
    rows:    tab.items.map(i => ({
      title:    i.title,
      subtitle: i.subtitle,
      cells:    i.fields.map(f => ({ label: f.label, value: f.value, css: TONE[f.tone] })),
    })),
    note: tab.note,
  };
}

const TONE = {
  neutral:  'slds-text-color_default',
  positive: 'slds-text-color_success',
  warning:  'slds-text-color_warning',
  critical: 'slds-text-color_error',
  info:     'slds-text-color_weak',
};
```

The API's origin must be in `dws.cors.allowed-origin-patterns`. The defaults already
cover `*.lightning.force.com`, `*.my.salesforce.com`, `*.visualforce.com` and
`*.builder.salesforce-experience.com`.

## Before this is real

Three things this POC deliberately does not do:

1. **No caller identity, so no entitlement check.** Today the endpoint answers
   anyone who knows an opportunity id. The design calls for a server-side
   membership check deciding which designs a caller may see; `embed=true`
   filters *content*, not *access*.
2. **No approval gate.** The fixture marks documents customer-visible by hand.
   In the real thing that flag is set by an approver and enforced by the
   database, not by whoever writes the fixture.
3. **Values are display-formatted strings, not typed.** `"$4.5M"`, `"24 weeks"`,
   `"2 days ago"` — deliberate for a POC, because the shape stays uniform and
   the client never has to format. If Salesforce needs to sort or filter on
   these, the fields need machine-readable siblings (`valueRaw`, `unit`,
   `updatedAt`) rather than a parser on the client.
