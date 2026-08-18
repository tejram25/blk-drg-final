# dc-workspace — Backend Contract: Projects, Artifacts & Sync

Status: design + reference implementation (mock-backed)
Scope: the API the IDE shell (`ProjectWorkspaceService` on the frontend) calls to
load projects, browse a project's engineering artefacts, and see the state of the
Salesforce mirror.

## 1. Model in one paragraph

**Salesforce is the system of record** for projects and their workflow. A nightly
job mirrors the project catalogue into the workspace — thousands of projects. The
workspace adds the **engineering artefacts** that hang off each project (diagrams,
documents, datasets, BOM, reviews) so everything for a project lives in one tree.
Every artefact carries a **provenance** (`origin`): `salesforce` artefacts are
read-only mirrors; `workspace` artefacts are created here and fully editable. The
catalogue is never returned whole — projects are **paged and searched**; only the
open project's artefacts are loaded.

## 2. Conventions (match the existing codebase)

- Base path `/api`, thin `@RestController`s delegating to a service interface.
- DTOs are Java `record`s in `com.example.diagram.web.dto`.
- Auth via `Authentication auth` → `emailOf(auth)`; session-cookie auth as today.
- Errors thrown by the service, mapped centrally by `GlobalExceptionHandler`:
  - `NotFoundException` → **404** `{ "message": ... }`
  - `IllegalArgumentException` → **400**
  - `AccessDeniedException` → **403** (used to enforce `salesforce` read-only)
- Timestamps are absolute ISO-8601 `Instant`; the client renders them relative
  ("2h ago"). Money (`value`) is whole USD as a `long`.
- Pagination is a small hand-rolled envelope (`Page<T>`), not Spring Data's, to
  keep the JSON shape stable and lean.

## 3. Endpoints

All under `/api/workspace`. `Page<T> = { content: T[], page, size, totalElements, totalPages }`.

### Projects

| Method | Path | Purpose | Response |
|---|---|---|---|
| GET | `/projects?q=&stage=&health=&owner=&page=0&size=25` | Search/paginate the catalogue. Filters optional; `q` matches name, customer, id, Salesforce id, owner. Newest-updated first. `size` clamped to 100. | `Page<WorkspaceProjectSummary>` |
| GET | `/projects/{id}` | One project with its artefacts (flat; client groups into folders). | `WorkspaceProjectDetail` — 404 if unknown |

### Artifacts

| Method | Path | Purpose | Response |
|---|---|---|---|
| GET | `/projects/{projectId}/artifacts` | List a project's artefacts. | `ArtifactSummary[]` |
| GET | `/projects/{projectId}/artifacts/{artifactId}` | One artefact + body (dataset `preview` / review·doc `summary`). | `ArtifactDetail` — 404 |
| GET | `/projects/{projectId}/artifacts/{artifactId}/content` | Download the raw bytes. | `application/octet-stream` (+ `Content-Disposition`) |
| POST | `/projects/{projectId}/artifacts` | Create a **workspace** artefact. `multipart/form-data`: `metadata` (JSON `NewArtifactRequest`) + optional `file`. | **201** `ArtifactSummary` |
| PUT | `/projects/{projectId}/artifacts/{artifactId}` | Rename / re-file. Body `UpdateArtifactRequest`. | `ArtifactSummary` — **403** if `origin=salesforce` |
| DELETE | `/projects/{projectId}/artifacts/{artifactId}` | Remove a workspace artefact. | **204** — **403** if `origin=salesforce` |

Provenance is the write-authority: there is no way to create, edit, or delete a
`salesforce`-origin artefact through the API — those change only via the nightly
sync. This is enforced in the service (`AccessDeniedException`), so every route
gets it uniformly.

### Sync

| Method | Path | Purpose | Response |
|---|---|---|---|
| GET | `/sync/status` | Mirror state for the status bar. | `SyncStatus` |
| POST | `/sync/run` | Manual override ("Sync now"). Idempotent while a run is in flight. | **202** `SyncRun` |
| GET | `/sync/history?page=0&size=20` | Recent runs, newest first. | `Page<SyncRun>` |

## 4. DTO shapes

```jsonc
// WorkspaceProjectSummary — list row, Ctrl+O picker, search hit
{ "id": "PRJ-4821", "sfdcId": "006Ah000012Xk9Z", "name": "BMS Controller Design",
  "customer": "Northwind Automotive", "category": "Automotive",
  "stage": "Design",              // Discovery | Design | Prototype | Production | Won | Lost
  "value": 1240000,               // whole USD
  "owner": "Priya Raman",
  "health": "ok",                 // ok | warn | risk
  "updatedAt": "2026-07-27T08:12:00Z",
  "diagrams": 4, "parts": 62 }    // rollup counts

// WorkspaceProjectDetail = summary + "artifacts": ArtifactSummary[]

// ArtifactSummary
{ "id": "art-1", "name": "Power Architecture — Rev C",
  "kind": "diagram",              // diagram | document | dataset | bom | review
  "folder": "Diagrams",
  "updatedAt": "2026-07-27T08:12:00Z", "author": "Priya Raman",
  "size": null,                   // bytes for file-backed artefacts, else null
  "diagramId": 1,                 // links a diagram artefact to the GoJS record, else null
  "origin": "workspace" }         // salesforce (read-only) | workspace (editable)

// ArtifactDetail = ArtifactSummary + body:
//   "preview": { "columns": ["Ambient °C", ...], "rows": [[25,3.3,0.5,41], ...] }  // datasets
//   "summary": "Two findings: missing decoupling on U1..."                         // reviews/docs

// NewArtifactRequest (multipart "metadata" part)
{ "name": "Thermal notes.md", "kind": "document", "folder": "Documents" }  // folder optional → derived from kind

// UpdateArtifactRequest  { "name": "...", "folder": "..." }   // null fields unchanged

// SyncStatus
{ "lastSync": "2026-07-27T04:12:00Z", "nextSync": "2026-07-28T04:00:00Z",
  "synced": 3182, "failed": 2, "total": 3184, "running": false }

// SyncRun
{ "id": "run-0001", "trigger": "nightly",   // nightly | manual
  "triggeredBy": null,                        // email for manual, null for nightly
  "status": "partial",                        // running | success | partial | failed
  "startedAt": "...", "finishedAt": "...",    // finishedAt null while running
  "synced": 3182, "failed": 2 }
```

## 5. Frontend mapping

The DTOs are the frontend `workspace.models.ts` shapes with the mock's relative
strings replaced by absolute `Instant`s:

| Frontend (`ProjectWorkspaceService`) | Contract |
|---|---|
| `search(q)` over in-memory `projects` | `GET /projects?q=` (paged) |
| `openProjectById(id)` / `openProject().artifacts` | `GET /projects/{id}` |
| `open(a)` / artefact viewer preview·summary | `GET …/artifacts/{id}` |
| `sync` signal | `GET /sync/status` |
| `resync()` | `POST /sync/run` |
| (new) sync history panel | `GET /sync/history` |

Adopting it on the frontend is a drop-in: replace the seeded signals in
`ProjectWorkspaceService` with `HttpClient` calls, keep the `Instant`→relative
formatting in the template.

## 6. Reference implementation (in this repo)

Compile-checkable and runnable against the mock, matching the repo's
`IntegrationService`/`MockIntegrationService` pattern:

- DTOs — `web/dto/`: `Page`, `WorkspaceProjectSummary`, `WorkspaceProjectDetail`,
  `ArtifactSummary`, `ArtifactDetail`, `DatasetPreview`, `NewArtifactRequest`,
  `UpdateArtifactRequest`, `SyncStatus`, `SyncRun`.
- Service — `service/WorkspaceProjectService` (interface) +
  `service/impl/MockWorkspaceProjectService` (`@Service`, seeded to mirror the
  frontend's four projects; reports a `3184`-project catalogue while
  materialising the seed; enforces provenance).
- Controllers — `web/WorkspaceProjectController`, `WorkspaceArtifactController`,
  `WorkspaceSyncController`.

Swap `MockWorkspaceProjectService` for a real implementation (Salesforce nightly
mirror + artefact storage) behind the same interface — no controller or DTO
change (DIP/OCP).

## 7. Going real — what a live implementation adds

- **Persistence.** Projects table populated by the nightly mirror; `artifact`
  table (id, project_id, kind, folder, origin, blob ref, author, updated_at);
  binaries in object storage, `content` streamed not buffered.
- **Sync job.** Scheduled Salesforce pull (upsert by `sfdcId`), writing a
  `sync_run` row per run; `SyncStatus` derived from the latest run + schedule.
  `POST /sync/run` enqueues rather than runs inline; `202` already reflects that.
- **Scale.** `GET /projects` hits an indexed query (name/customer/owner/stage/
  health), server-side sort, keyset pagination if offset gets expensive at
  thousands+.
- **Authorization.** Row-level scoping by region/role (the header already carries
  both) — filter the catalogue and gate artefact writes per user, in the service.
- **Provenance guarantee stays put.** `salesforce` artefacts remain 403 on write
  regardless of role; only the sync job writes them.
