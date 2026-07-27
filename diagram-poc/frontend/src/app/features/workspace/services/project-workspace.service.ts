import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { DiagramService } from '../../../core/services/diagram.service';
import { Artifact, ArtifactKind, OpenTab, ProjectWorkspace, SyncState } from '../models/workspace.models';

/** A fresh GoJS model, used only when no sample exists to clone from. */
const EMPTY_MODEL = '{ "class": "GraphLinksModel", "nodeDataArray": [], "linkDataArray": [] }';

/**
 * The IDE's project state.
 *
 * Salesforce is the system of record for projects and their workflow; a nightly
 * job mirrors them here. This workspace adds the engineering artefacts that hang
 * off each project — diagrams, documents, datasets, BOM, reviews — so everything
 * for a project sits in one tree.
 *
 * The catalogue is expected to run to thousands of projects, so nothing here
 * assumes the full list is browsable: you search for a project, open it, and
 * work inside it. Only the open project's artefacts are held in memory.
 */
@Injectable({ providedIn: 'root' })
export class ProjectWorkspaceService {
  private readonly diagramApi = inject(DiagramService);

  // ---- Salesforce sync ---------------------------------------------------
  readonly sync = signal<SyncState>({
    lastSync: 'Today 04:12', nextSync: 'Tomorrow 04:00',
    synced: 3184, failed: 2, running: false,
  });

  /** Kick a manual sync. The nightly job is the normal path; this is the override. */
  resync(): void {
    if (this.sync().running) return;
    this.sync.update((s) => ({ ...s, running: true }));
    setTimeout(() => this.sync.update((s) => ({
      ...s, running: false, lastSync: 'Just now', synced: s.synced + 6,
    })), 1400);
  }

  // ---- projects ----------------------------------------------------------
  private readonly all = signal<ProjectWorkspace[]>(seedProjects());
  readonly projects = this.all.asReadonly();
  readonly total = computed(() => 3184); // catalogue size reported by the sync job

  readonly openProjectId = signal<string>(seedProjects()[0].id);
  readonly openProject = computed(() =>
    this.all().find((p) => p.id === this.openProjectId()) ?? this.all()[0]);

  openProjectById(id: string): void {
    if (!this.all().some((p) => p.id === id)) return;
    this.openProjectId.set(id);
    this.tabs.set([]);
    this.activeTabId.set(null);
  }

  /** Search across the whole catalogue by name, customer, id or Salesforce id. */
  search(q: string): ProjectWorkspace[] {
    const s = q.trim().toLowerCase();
    if (!s) return this.all();
    return this.all().filter((p) =>
      `${p.name} ${p.customer} ${p.id} ${p.sfdcId} ${p.owner}`.toLowerCase().includes(s));
  }

  // ---- artefact tree -----------------------------------------------------
  /**
   * Artefacts of the open project grouped by folder.
   *
   * Every canonical folder is emitted even when empty, so a project with no
   * diagrams still shows a Diagrams folder the user can add the first one to —
   * an empty folder is a place to put something, not something to hide.
   */
  readonly tree = computed(() => {
    const byFolder = new Map<string, Artifact[]>(FOLDER_ORDER.map((f) => [f, []]));
    for (const a of this.openProject().artifacts) {
      const list = byFolder.get(a.folder) ?? [];
      list.push(a);
      byFolder.set(a.folder, list);
    }
    return [...byFolder.entries()]
      .map(([folder, items]) => ({ folder, items: items.sort((x, y) => x.name.localeCompare(y.name)) }))
      .sort((a, b) => FOLDER_ORDER.indexOf(a.folder) - FOLDER_ORDER.indexOf(b.folder));
  });

  /** The artefact kind a folder accepts, used to drive its "add" affordance. */
  kindForFolder(folder: string): ArtifactKind {
    return FOLDER_KIND[folder] ?? 'document';
  }

  countOf(kind: ArtifactKind): number {
    return this.openProject().artifacts.filter((a) => a.kind === kind).length;
  }

  // ---- editor tabs -------------------------------------------------------
  readonly tabs = signal<OpenTab[]>([]);
  readonly activeTabId = signal<string | null>(null);
  readonly activeTab = computed(() =>
    this.tabs().find((t) => t.artifactId === this.activeTabId()) ?? null);
  readonly activeArtifact = computed(() => {
    const id = this.activeTabId();
    return id ? this.openProject().artifacts.find((a) => a.id === id) ?? null : null;
  });

  open(a: Artifact): void {
    if (!this.tabs().some((t) => t.artifactId === a.id)) {
      this.tabs.update((list) => [
        ...list,
        { artifactId: a.id, projectId: this.openProject().id, name: a.name, kind: a.kind },
      ]);
    }
    this.activeTabId.set(a.id);
  }

  activate(id: string): void { this.activeTabId.set(id); }

  close(id: string): void {
    const list = this.tabs();
    const idx = list.findIndex((t) => t.artifactId === id);
    if (idx < 0) return;
    const next = list.filter((t) => t.artifactId !== id);
    this.tabs.set(next);
    if (this.activeTabId() === id) {
      // Focus the neighbour, matching how editors behave when a tab closes.
      this.activeTabId.set(next[idx]?.artifactId ?? next[idx - 1]?.artifactId ?? null);
    }
  }

  closeAll(): void { this.tabs.set([]); this.activeTabId.set(null); }

  // ---- diagram linking ---------------------------------------------------
  /** In-flight resolutions by artifact id, so a double-open can't create twice. */
  private readonly resolving = new Map<string, Observable<number>>();

  /**
   * The saved diagram behind a diagram artefact, resolved against the real
   * backend by name: use the existing diagram if one matches, otherwise create
   * it — seeded with a sample diagram's content so it never opens empty. The
   * resolved id is cached on the artefact, so later opens skip the lookup.
   */
  resolveDiagram(a: Artifact): Observable<number> {
    if (a.diagramId != null) return of(a.diagramId);
    const inflight = this.resolving.get(a.id);
    if (inflight) return inflight;

    const wanted = (a.diagramName ?? a.name).trim().toLowerCase();
    const resolved = this.diagramApi.list().pipe(
      switchMap((list) => {
        const hit = (list ?? []).find((d) => d.name.trim().toLowerCase() === wanted);
        if (hit) return of(hit.id);
        // No such diagram yet: create it from a sample so it has real content.
        const sample = (list ?? []).find((d) => d.name.startsWith('Sample - ')) ?? (list ?? [])[0];
        const content$ = sample
          ? this.diagramApi.get(sample.id).pipe(map((d) => d.contentJson))
          : of(EMPTY_MODEL);
        return content$.pipe(
          switchMap((contentJson) =>
            this.diagramApi.create({ name: a.diagramName ?? a.name, contentJson })),
          map((created) => created.id!),
        );
      }),
      map((id) => { this.rememberDiagramId(a.id, id); return id; }),
      shareReplay(1),
    );
    this.resolving.set(a.id, resolved);
    return resolved;
  }

  // ---- adding artefacts --------------------------------------------------
  /**
   * Add a file the user picked from their machine. Documents and datasets are
   * normally found in the external repository (see DocumentRepository), but
   * uploading is always available — and is the only route while that system is
   * not integrated. Uploaded artefacts are `workspace` origin, so unlike the
   * Salesforce mirror they stay editable.
   */
  async upload(file: File, kind: ArtifactKind = 'document'): Promise<Artifact> {
    const artifact: Artifact = {
      id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      kind,
      folder: kind === 'dataset' ? 'Datasets' : 'Documents',
      updated: 'Just now',
      author: 'You',
      size: file.size,
      origin: 'workspace',
      preview: kind === 'dataset' ? await readTablePreview(file) : undefined,
      summary: kind === 'dataset' ? undefined : `Uploaded ${new Date().toLocaleDateString()}.`,
    };
    this.addArtifact(artifact);
    return artifact;
  }

  /**
   * Start a new diagram on this project. The artefact is created immediately so
   * it appears in the tree; resolveDiagram() creates the backing record on the
   * server the first time it is opened.
   */
  newDiagram(name = 'Untitled diagram'): Artifact {
    const artifact: Artifact = {
      id: `dg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name, kind: 'diagram', folder: 'Diagrams',
      updated: 'Just now', author: 'You', origin: 'workspace',
      // No diagramName: resolveDiagram() falls back to the artefact's own name,
      // finds nothing, and creates a fresh diagram seeded from a sample.
    };
    this.addArtifact(artifact);
    return artifact;
  }

  /** Append an artefact to the open project and keep its rollup counts honest. */
  private addArtifact(artifact: Artifact): void {
    const openId = this.openProject().id;
    this.all.update((projects) => projects.map((p) => p.id !== openId ? p : {
      ...p,
      artifacts: [...p.artifacts, artifact],
      diagrams: artifact.kind === 'diagram' ? p.diagrams + 1 : p.diagrams,
      updated: 'Just now',
    }));
  }

  /** Persist a resolved diagram id onto the artefact in the project list. */
  private rememberDiagramId(artifactId: string, diagramId: number): void {
    this.resolving.delete(artifactId);
    this.all.update((projects) => projects.map((p) => ({
      ...p,
      artifacts: p.artifacts.map((x) => (x.id === artifactId ? { ...x, diagramId } : x)),
    })));
  }
}

const FOLDER_ORDER = ['Diagrams', 'Documents', 'Datasets', 'Bill of materials', 'Reviews'];

/** Which kind each folder holds — drives the per-folder "add" action. */
const FOLDER_KIND: Record<string, ArtifactKind> = {
  'Diagrams': 'diagram',
  'Documents': 'document',
  'Datasets': 'dataset',
  'Bill of materials': 'bom',
  'Reviews': 'review',
};

function seedProjects(): ProjectWorkspace[] {
  const base = [
    {
      id: 'PRJ-4821', sfdcId: '006Ah000012Xk9Z', name: 'BMS Controller Design',
      customer: 'Northwind Automotive', category: 'Automotive', stage: 'Design' as const,
      value: 1_240_000, owner: 'Priya Raman', health: 'ok' as const, updated: '2h ago',
      diagrams: 4, parts: 62,
      artifacts: [
        d('a1', 'Power Architecture — Rev C', 'Diagrams', 'Sample - Smart Microgrid', 'Priya Raman', '2h ago'),
        d('a2', 'BMS Sense Chain', 'Diagrams', 'Sample - 555 LED Blinker', 'Marco Silva', '1d ago'),
        d('a3', 'Cell Balancing', 'Diagrams', undefined, 'Priya Raman', '3d ago'),
        d('a4', 'Pack Interconnect', 'Diagrams', undefined, 'Tom Becker', '1w ago'),
        doc('a5', 'Requirements Spec v2.pdf', 480_000, 'salesforce',
          'Customer requirements baseline. Owned in Salesforce; synced read-only.'),
        doc('a6', 'Customer RFQ.docx', 92_000, 'salesforce',
          'Original request for quotation from Northwind Automotive.'),
        doc('a7', 'TPS563201 datasheet.pdf', 1_240_000, 'workspace',
          'Buck converter datasheet, attached during part selection.'),
        doc('a8', 'Thermal design note.md', 18_000, 'workspace',
          'Derating assumptions for the 48V rail.'),
        ds('a9', 'Thermal sweep 2026-07.csv', 214_000,
          ['Ambient °C', 'Rail V', 'Load A', 'Case °C'],
          [[25, 3.3, 0.5, 41], [25, 3.3, 1.5, 58], [45, 3.3, 1.5, 79], [45, 3.3, 2.0, 92]]),
        ds('a10', 'Load profile.xlsx', 88_000,
          ['Phase', 'Duration s', 'Current A'],
          [['Idle', 300, 0.2], ['Charge', 1800, 2.4], ['Drive', 3600, 1.8], ['Fault', 5, 6.1]]),
        { id: 'a11', name: 'Bill of materials', kind: 'bom' as const, folder: 'Bill of materials',
          updated: '2h ago', author: 'Generated', origin: 'workspace' as const },
        { id: 'a12', name: 'Design review — Rev B', kind: 'review' as const, folder: 'Reviews',
          updated: '5h ago', author: 'Aisha Khan', origin: 'workspace' as const,
          summary: 'Two findings: missing decoupling on U1, feedback divider unconnected.' },
      ],
    },
    {
      id: 'PRJ-4788', sfdcId: '006Ah000012Xj4M', name: 'IoT Gateway Module',
      customer: 'Helio Systems', category: 'Industrial IoT', stage: 'Prototype' as const,
      value: 680_000, owner: 'Marco Silva', health: 'warn' as const, updated: '5h ago',
      diagrams: 3, parts: 41,
      artifacts: [
        d('b1', 'Gateway Architecture', 'Diagrams', 'Sample - AMR Robot (FAST)', 'Marco Silva', '5h ago'),
        d('b2', 'Radio Front End', 'Diagrams', undefined, 'Marco Silva', '2d ago'),
        doc('b3', 'Certification plan.pdf', 320_000, 'salesforce', 'CE and FCC test plan.'),
        ds('b4', 'RF sweep.csv', 156_000, ['Freq MHz', 'Power dBm'],
          [[2400, 18.2], [2450, 18.6], [2500, 17.9]]),
        { id: 'b5', name: 'Bill of materials', kind: 'bom' as const, folder: 'Bill of materials',
          updated: '5h ago', author: 'Generated', origin: 'workspace' as const },
      ],
    },
    {
      id: 'PRJ-4763', sfdcId: '006Ah000012Xh8Q', name: 'Power Supply Unit',
      customer: 'Vantage Medical', category: 'Medical', stage: 'Production' as const,
      value: 2_100_000, owner: 'Aisha Khan', health: 'risk' as const, updated: '1d ago',
      diagrams: 6, parts: 118,
      artifacts: [
        d('c1', 'PSU Main', 'Diagrams', undefined, 'Aisha Khan', '1d ago'),
        d('c2', 'EMI Filter', 'Diagrams', undefined, 'Aisha Khan', '4d ago'),
        doc('c3', 'IEC 60601 compliance.pdf', 760_000, 'salesforce', 'Medical safety compliance dossier.'),
        { id: 'c4', name: 'Bill of materials', kind: 'bom' as const, folder: 'Bill of materials',
          updated: '1d ago', author: 'Generated', origin: 'workspace' as const },
        { id: 'c5', name: 'Lifecycle audit', kind: 'review' as const, folder: 'Reviews',
          updated: '3h ago', author: 'Inspection loop', origin: 'workspace' as const,
          summary: 'LM2596S-5.0 is NRND and present in a released BOM.' },
      ],
    },
    {
      id: 'PRJ-4655', sfdcId: '006Ah000012Xd2B', name: 'Motor Drive Inverter',
      customer: 'Kestrel Energy', category: 'Energy', stage: 'Won' as const,
      value: 3_450_000, owner: 'Marco Silva', health: 'ok' as const, updated: '1w ago',
      diagrams: 8, parts: 203,
      artifacts: [
        d('e1', 'Inverter Power Stage', 'Diagrams', undefined, 'Marco Silva', '1w ago'),
        d('e2', 'Gate Drive', 'Diagrams', undefined, 'Tom Becker', '1w ago'),
        doc('e3', 'Acceptance test report.pdf', 540_000, 'salesforce', 'Signed-off acceptance results.'),
        { id: 'e4', name: 'Bill of materials', kind: 'bom' as const, folder: 'Bill of materials',
          updated: '1w ago', author: 'Generated', origin: 'workspace' as const },
      ],
    },
  ];
  return base as ProjectWorkspace[];
}

/**
 * Diagram artefact. `diagramName` pins it to a specific saved diagram (the
 * backend's seeded samples); omitted, it resolves by the artefact's own name
 * and is created from sample content on first open. See resolveDiagram().
 */
/**
 * Read the first rows of an uploaded CSV/TSV so the dataset viewer has a
 * preview, matching the shape the seeded datasets use. Anything that does not
 * parse as delimited text simply gets no preview.
 */
async function readTablePreview(file: File): Promise<Artifact['preview']> {
  if (!/\.(csv|tsv|txt)$/i.test(file.name)) return undefined;
  try {
    const lines = (await file.text()).split(/\r?\n/).filter((l) => l.trim()).slice(0, 7);
    if (lines.length < 2) return undefined;
    const split = (l: string) => l.split(l.includes('\t') ? '\t' : ',').map((c) => c.trim());
    const [head, ...body] = lines;
    return {
      columns: split(head),
      rows: body.map((l) => split(l).map((c) => (c !== '' && !isNaN(Number(c)) ? Number(c) : c))),
    };
  } catch {
    return undefined;
  }
}

function d(id: string, name: string, folder: string, diagramName: string | undefined,
           author: string, updated: string): Artifact {
  return { id, name, kind: 'diagram', folder, updated, author, diagramName, origin: 'workspace' };
}
function doc(id: string, name: string, size: number,
             origin: 'salesforce' | 'workspace', summary: string): Artifact {
  return { id, name, kind: 'document', folder: 'Documents', updated: '2d ago',
    author: origin === 'salesforce' ? 'Salesforce' : 'Priya Raman', size, origin, summary };
}
function ds(id: string, name: string, size: number,
            columns: string[], rows: (string | number)[][]): Artifact {
  return { id, name, kind: 'dataset', folder: 'Datasets', updated: '3d ago',
    author: 'Test bench', size, origin: 'workspace', preview: { columns, rows } };
}
