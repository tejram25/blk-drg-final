# Questions to settle before building

Companion to [architecture.md](./architecture.md) and
[data-model.md](./data-model.md).

Grouped by who can answer. The seven marked **[BLOCKER]** change the
architecture depending on the answer — get those first, because the rest is
detail that can be decided while building.

---

## Ask first — the seven that change the design

| # | Question | Ask | If the answer is… |
|---|---|---|---|
| 1 | May DWS be embedded in Salesforce at all? | Security | No → the whole tab approach dies; fall back to a deep link that opens DWS in a new tab |
| 2 | Must EU customer design data stay in the EU? | Legal | Yes → one Oracle instance is not enough; the data model assumes one |
| 3 | Two schemas in one Oracle instance — acceptable? | DBA | No → we need the fallback (one schema, one owner, read-only views) |
| 4 | Does an FAE ever need to **edit** from inside Salesforce? | Product | No → editing leaves the iframe entirely; large risk reduction |
| 5 | GoJS production licence — tier, domains, lead time, budget? | Procurement | Slow → this is the long pole, start now |
| 6 | Do DWS and BLK teams need independent Angular versions? | Eng leads | No → use module federation for DWS→BLK instead of a nested iframe |
| 7 | Artifact bytes in Oracle, or object storage? | DBA / Arch | Changes `artifact_file` — it currently carries both columns |

---

## Product / stakeholders

**Publishing and visibility (point 5)**

- Which artifact kinds may ever reach a customer? The model seeds
  `artifact_kind` with a guess — the FAE workshop should confirm the list.
- Who is the **approver**? The design owner's manager, a regional FAE lead, or
  anyone with a given Salesforce role?
- Can an artifact be **un-published** after a customer has seen it? Does
  Salesforce then show a tombstone, or does it silently disappear?
- Does publishing need a reason/comment for the audit trail?

**Design lifecycle**

- Can a design exist **without** an opportunity? (The model allows it — confirm.)
- Can one design be linked to **several** opportunities? (The model says no; a
  reference design reused elsewhere is a copy.)
- What happens when the opportunity is Closed Won / Closed Lost — does the
  design lock, archive, or carry on unchanged?
- What happens to published artifacts when the underlying **diagram is deleted**?
  Block the delete, or leave the export intact but orphaned?

**Scope of the Salesforce view**

- Is **live collaboration** in scope for the SFDC view, or is that view
  read-only? (Read-only removes a service from the integration.)
- Who may **create** a design from Salesforce — anyone who can see the
  opportunity, or a narrower group?
- Should the Salesforce view show designs owned by **other** FAEs on the same
  opportunity?

---

## Salesforce team

- Which orgs will embed this, and what are their **exact domains**? Production,
  each sandbox, My Domain variants — all of them need to be in
  `frame-ancestors`.
- Who maintains **CSP Trusted Sites**, and what is the request lead time?
- **LWC or Visualforce** for the embedding component?
- How often are sandboxes **refreshed**? Refresh changes the domain and will
  silently break the embed — who owns updating the allowlist?
- Which **profiles / permission sets** get the View Design button?
- Do **partner or community users** ever see these opportunities? They may have
  no DWS identity, and would hit a login screen inside the iframe.
- What is the org's **API call quota**, and who else is consuming it?
- Is adding **one field on Opportunity** acceptable — e.g. `Has_Design__c` — so
  sales can report on it? (With the link stored only in DWS, Salesforce cannot
  report or filter on it. Alternative: Salesforce Connect external objects.)
- Who **regression-tests the embed** after each of the three annual Salesforce
  releases?

---

## Security / IAM

- **[BLOCKER]** Is framing an internal app inside Salesforce permitted by policy?
- Does Arrow's IdP support the token flow we need — short-lived, audience-scoped?
- Does the IdP login page send `X-Frame-Options: DENY`? (Almost certainly yes,
  which is why session expiry inside the frame needs a popup, not a redirect.)
- Is the Salesforce user ↔ DWS user mapping **1:1 through the same IdP**, or do
  we need an explicit mapping table?
- What is the **session timeout** policy, and what should the user see when it
  expires mid-edit inside an iframe?
- Does a customer-facing surface trigger a **penetration test or security
  review**? What is the lead time?
- The editor already has PUBLIC / INTERNAL / RESTRICTED classifications. Who
  sets them, and may a **RESTRICTED** design ever surface in Salesforce?
- Where may the short-lived room token appear — is a token in a WebSocket query
  string acceptable, given it lands in proxy logs?

---

## DBA / infrastructure

- **[BLOCKER]** Two schemas in one instance, with cross-schema grants on views only?
- Who **owns migrations**, and what is the change-approval lead time?
- **[BLOCKER]** BLOBs in Oracle or object storage for artifact bytes? What is
  the maximum acceptable row size?
- Can a single schema be **restored independently**, or is backup instance-wide?
- How many **environments**, and do they map onto the Salesforce sandboxes?
- Connection-pool sizing with two applications on one instance.
- Is a database **trigger** acceptable for the publish guardrail, or must that
  logic live only in the application? (The model uses one deliberately.)

---

## Data / Databricks

- What is the **ingest latency** for opportunity context? The agent's answers
  are only as fresh as that pipeline.
- Can Databricks enforce **row-level security** by user, or must the agent
  filter? (Point 3 has no entitlement story; the model adds `design_member`.)
- Who **owns the ingestion pipeline** for designs and artifacts (point 4)?
- What is the **retention and PII policy** for customer design data in
  Databricks?
- Is the outbox pattern acceptable, or is there a standard CDC tool to use?

---

## Legal / compliance

- **[BLOCKER]** Data residency — must EU customer data stay in the EU?
- **Right to erasure** — if a customer requests deletion, how do we satisfy it
  across Oracle, Databricks and anything already downloaded into Salesforce?
- Do customer-visible artifacts need **confidentiality marking or watermarking**?
- Is there a **retention period** for designs on lost opportunities?

---

## Licensing / procurement

- **[BLOCKER]** GoJS production licence: which tier, which domains, what
  lead time, what budget? The evaluation watermark is currently rendered on the
  canvas and would be visible to a customer.
- Does **server-side rendering in Node** need a separate GoJS licence?
- Any other licences implicated by a customer-facing deployment?

---

## Engineering / delivery

- **[BLOCKER]** Independent Angular versions across the two teams?
- **Server-side renderer**: build it properly, or accept browser-render-at-
  publish for v1? (The cheap version means an artifact can only be published
  while a user is in the editor — no batch re-publish, no regeneration after a
  template change.)
- Where does the renderer run, and who operates it?
- Who owns the **collab relay** in production?
- Can we get a **Salesforce sandbox with developer access** for integration
  testing? Nothing about CSP, cookies, framing or downloads can be tested
  locally.
- What is the **spike's definition of done**? Suggested: a static page served
  from the real domain with the real `frame-ancestors` header, embedded in a
  sandbox org, making one authenticated API call. If that passes, the rest is
  ordinary work.

---

## Suggested order

1. **Week 1** — the seven blockers, in parallel. Most are other people's
   decisions and have lead times.
2. **Week 1** — run the embed spike. It answers questions 1 and several
   security items empirically rather than by opinion.
3. **Week 2** — the FAE workshop on artifact kinds (point 5), since that seeds
   reference data the build depends on.
4. **Ongoing** — the rest can be settled during implementation.
