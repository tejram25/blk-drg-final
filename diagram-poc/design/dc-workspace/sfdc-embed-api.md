# The Salesforce embed API

One endpoint. Salesforce calls it once per opportunity and renders what comes
back. It does not need to know which tabs exist, what order they go in, or how
to draw any of them — **adding a tab here is not a Salesforce release.**

```
GET /api/sfdc/opportunities/{opportunityId}/tabs?embed=true
```

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

**What `embed=true` actually changes.** Not styling. Internal content is left
out of the response, so a client reading the raw HTML cannot recover it:

- internal-only documents are not in the list, and the tab badge counts what is
  actually shown
- the internal margin figure is absent
- action controls (*Raise a query*, *Ask the assistant*) are not rendered
- every tab reports `readOnly: true`

## Response

```jsonc
{
  "opportunityId": "0061t00000AbCdEfGhI",
  "projectId":     "PRJ-001",
  "name":          "EV Battery Management System",
  "customer":      "Tesla Motors",
  "value":         "$2.4M",
  "stage":         "Design Phase",
  "region":        "AC",
  "owner":         "John Smith",
  "embed":         true,
  "generatedAt":   "2026-08-07T03:59:06.630896067Z",
  "tabs": [
    {
      "key":         "overview",        // stable; safe in a URL or a DOM id
      "label":       "Overview",        // what the user sees
      "icon":        "layout-list",     // Lucide name, same as the workspace UI
      "order":       1,                 // ascending
      "badge":       null,              // short count/status, or null
      "readOnly":    true,
      "contentType": "text/html",
      "html":        "<div style=…>…</div>"
    }
    // …6 more
  ]
}
```

The header fields are a copy of what Salesforce already holds. They are
returned so the embed can render standalone without a second lookup — not
because this service owns them.

### The tabs

| # | key | Label | Badge counts |
|---|---|---|---|
| 1 | `overview` | Overview | — |
| 2 | `block-diagrams` | Block Diagrams | diagrams |
| 3 | `part-intel` | Part Intelligence | parts |
| 4 | `fast-repo` | FAST Repository | documents **this variant will show** |
| 5 | `support` | Support / Query | **open** queries only |
| 6 | `ai-assistant` | AI Assistant | suggestions |
| 7 | `supplier-collab` | Suppliers | suppliers |

### About the HTML

Each `html` is a self-contained fragment — a `<div>` and its children. No
`<html>`/`<body>` wrapper, no `<script>`, and **no stylesheet dependency**:
every rule is inline. Drop it into a container and it renders, with nothing to
install and nothing that can collide with Salesforce's own styles.

Every interpolated value is HTML-escaped. That matters more than it looks: the
fixture is static today, but the moment this reads real project names, notes
and query subjects, unescaped output is stored XSS on a customer-facing page.
Escaping from the start makes that change safe by default.

## Fixture

Three opportunities, held in code (`MockOpportunityCatalog`). The numbers
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
cd diagram-poc/backend && mvn spring-boot:run

curl -s "localhost:8080/api/sfdc/opportunities/0061t00000AbCdEfGhI/tabs?embed=true" | jq '.tabs[] | {order, key, badge}'

# the difference the flag makes
curl -s "localhost:8080/api/sfdc/opportunities/0061t00000AbCdEfGhI/tabs?embed=false" | grep -c "Thermal design note"   # 1
curl -s "localhost:8080/api/sfdc/opportunities/0061t00000AbCdEfGhI/tabs?embed=true"  | grep -c "Thermal design note"   # 0
```

## Consuming it from Salesforce

```js
const res  = await fetch(`${base}/api/sfdc/opportunities/${oppId}/tabs?embed=true`);
const data = await res.json();

data.tabs.forEach(tab => {
  // tab.label + tab.badge drive the tab strip
  // tab.html goes into the panel — it needs no CSS of yours
  panel.innerHTML = tab.html;
});
```

The API's origin must be in `app.cors.allowed-origins`. The defaults already
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
3. **The dark theme is a choice, not a constraint.** The fragments match the
   Design Workspace so the embed reads as the workspace. If Salesforce wants
   Lightning's light surface instead, it is the palette constants at the top of
   `OpportunityTabHtml` and nothing else.
