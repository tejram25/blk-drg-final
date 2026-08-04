# Stakeholder Q&A — round 1

What we asked, what came back, what it changed in the design, and what is still
open. Companion to [architecture.md](./architecture.md),
[data-model.md](./data-model.md) and [open-questions.md](./open-questions.md).

Answers are paraphrased. Where an answer contradicts an earlier stakeholder
point, that is called out — one of them does.

---

## At a glance

| # | Question | Verdict | Design impact |
|---|---|---|---|
| 1 | How is the initial design context created? | **Answered** | `opportunity_id` stays nullable; `design.brief` added |
| 2 | How should DWS be presented in Salesforce? | **Answered, with a gap** | Read-only embed + undock confirmed; *location on the page* still unknown |
| 3 | Are final artefacts maintained in Databricks? | **Answered — and it corrects point 4** | Artifacts stay in Oracle. Outbox carries metadata only |
| 4 | Do we maintain SF/DWS user context? | **Answered, needs a guard** | No personalization — but identity columns stay, for entitlement and audit |

Two blockers closed (old #4, and the ad-hoc design question). One new blocker
opened (#8, where the embed lives). Net: the model did not have to change
shape — three small additions and one comment correction.

---

## 1. How is the initial design context created?

**We asked:** does a design always start from a Salesforce opportunity, or can
an FAE start one cold? And where does the agent get its context from?

**Answer:** both. A design can start from an opportunity *or* as a standalone,
ad-hoc session with no opportunity at all. Separately, Databricks is intended
as a **unified business context layer** — it aggregates Salesforce alongside
FAST, SiliconExpert and the engineering knowledge base, and the agent retrieves
from that aggregate rather than from Salesforce directly.

**What changed:**

- `design.opportunity_id` stays **nullable**, and now carries a comment saying
  so is deliberate rather than an oversight. It was already nullable; this
  confirms it.
- Added `design.brief VARCHAR2(4000 CHAR)` — the user's own statement of what
  they are designing ("48 V automotive BMS, 16 cells, ASIL-B, 10k/yr"). For a
  linked design this is useful; for an ad-hoc design it is the **only** intent
  signal the agent has, because there is no opportunity to resolve.
- `architecture.md` now describes Databricks as a context layer over several
  sources, not as a Salesforce mirror.

**Still needs clarity:**

- Can an ad-hoc design be **linked to an opportunity later**? The model allows
  it (just set the column), but does anything else have to happen at that
  moment — re-run the agent, re-index in Databricks, notify anyone?
- **Whose entitlement rules win** across the aggregated sources? A user
  entitled to the design but not to a SiliconExpert record must not see the
  latter leak out through an agent answer. Aggregation makes this sharper than
  it was when the only source was Salesforce.
- What is the **ingest latency** per source? The agent is only as fresh as the
  slowest pipeline.

---

## 2. How should DWS be presented in Salesforce?

**We asked:** full app inside the opportunity, or a narrow read-only view? Does
an FAE ever need to *edit* from inside Salesforce?

**Answer:** an embedded, read-only view on the opportunity. Editing is done
"undocked" — outside the embed.

**What changed:** this validates the recommendation already in
`architecture.md` §6: the embed is a published-artifact summary, and **Open in
Design Workspace** opens the real app in a new top-level tab. Old blocker #4 is
closed, and it closes in the direction that removes the most risk — no
GoJS canvas, no collab socket, no autosave inside a third-party frame.

One correction to make out loud: **Salesforce has no floating-dock concept.**
"Undock" cannot mean a draggable panel. In practice it means either a
full-page Lightning tab or a new browser tab. Worth confirming which, because
they feel quite different to a user mid-task.

**Still needs clarity — this is the new blocker:**

- **Where on the Opportunity page does the embed actually go?** Nobody named a
  location. A right-rail component is roughly 300 px wide; a canvas preview
  needs closer to 900. If the answer is "right rail", the embed can only be a
  list of links — which may be fine, but it is a different deliverable from
  what the diagrams currently show.
- Related list, custom Lightning tab, or separate app page?
- Who **regression-tests the embed** after each of the three annual Salesforce
  releases? (Carried over — still unowned.)

---

## 3. Are final design artefacts maintained in Databricks?

**We asked:** stakeholder point 4 said final artefacts would be maintained in
Databricks. Does that mean Databricks becomes the artifact store — and if so,
what is the system of record?

**Answer, and this is the important one:** no. Diagram JSON, canvas objects,
versions and attachments stay in Oracle. Databricks receives **linkage** (design
↔ opportunity ↔ artifact ids), **design metadata** (name, brief, customer,
region, stage) and **derived semantics** (AI summaries, tags, embeddings).

**This is a correction to their own earlier point 4**, not a new requirement.
Worth flagging in writing so it does not get re-litigated in three weeks — the
earlier phrasing is what prompted the question.

**What changed:**

- `outbox_event.payload` comment rewritten to say **metadata only, never
  diagram JSON or artifact bytes**. Serialising a whole design into that column
  would quietly rebuild the artifact store this answer rejects.
- A paragraph in `data-model.md` and one in `architecture.md` stating that
  `dws.design` / `dws.design_artifact` remain the system of record, and that
  Databricks could be rebuilt from scratch without losing a design.
- Ownership matrix in `architecture.md` gained a row separating "AI context"
  from "design metadata copies".

**A useful side effect we noticed while checking this:** the lazy-call design
means the Salesforce embed reads `v_published_artifact_v1` **live**, on click.
There is no cached copy in Salesforce, so freshness is immediate — an artifact
published thirty seconds ago shows on the next click. No cache-invalidation
work is needed. This is now written down in `architecture.md` §6 so nobody
builds a sync job for a problem that does not exist.

**Still needs clarity:**

- Do **AI summaries and tags flow back** into DWS, or stay in Databricks? This
  decides whether `design` grows a summary column, whether the DWS UI can show
  a tag without calling the agent, and who regenerates them when a design
  changes.
- If Databricks is down, does DWS **degrade gracefully** (no recommendations,
  everything else fine) or is it a hard dependency?
- **Erasure** now has to be satisfied in two systems. Who executes it?

---

## 4. Do we need to maintain the SF/DWS user context?

**We asked:** does the experience need to know who the user is across the two
systems — for personalization, for "my designs", for filtering?

**Answer:** no personalization is required.

**What changed:** nothing in the schema. But this answer needs a guard around
it, because it is one short sentence away from being misread as "do not store
user data", which would break the model.

Three columns are **load-bearing** and cannot be dropped:

| Column | Why it cannot go |
|---|---|
| `design.owner_email` | Who the design belongs to; drives the default `design_member` row |
| `design_member.user_email` | The entire entitlement check — without it, any authenticated user can open any design |
| `artifact_publication.actor_email` | Who made something customer-visible. This is the audit trail for the one action with external consequences |

"No personalization" means the UI does not tailor itself per user. It does not
mean the system is anonymous. The distinction matters most at the publish
boundary: an artifact reaching a customer with no record of who approved it is
not an acceptable audit position.

**Still needs clarity:**

- If identity is **not** carried into the Salesforce embed, who is the audit
  subject on a download — the org, or the person?
- Does "no personalization" also rule out a **"my designs"** list in DWS proper?
  That is personalization in the literal sense but is really just a filter, and
  it is the first thing an FAE will ask for.

---

## What this round did not touch

Still fully open, in priority order:

1. **Security** — may DWS be framed in Salesforce at all? Nothing else matters
   if the answer is no.
2. **Legal** — EU data residency. The data model assumes one Oracle instance.
3. **DBA** — two schemas in one instance; artifact bytes in Oracle or object
   storage.
4. **Procurement** — GoJS production licence. Longest lead time, and the
   evaluation watermark is currently rendered on the canvas.
5. **Eng leads** — independent Angular versions across the two teams, which
   decides nested iframe vs module federation.
6. **Salesforce** — exact domains for `frame-ancestors`, CSP Trusted Sites
   ownership, sandbox refresh handling.

Full list with the "if the answer is…" consequences in
[open-questions.md](./open-questions.md).

---

## Suggested next move

The four answers cost nothing structurally — the model absorbed them with one
new column and three comment changes, which is a decent sign the shape is
right. The two things worth chasing before any code is written are **question 8
(where the embed lives)** and the **security blocker on framing**, because they
are the only two that can invalidate the approach rather than adjust it.
