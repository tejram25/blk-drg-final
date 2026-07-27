/** Shared domain types for the Smart Ehub workspace modules. */

export type Role = 'Sales' | 'Engineer' | 'Leadership';
export type Region = 'AC' | 'EMEA' | 'AP';

export type ProjectStage = 'Discovery' | 'Design' | 'Prototype' | 'Production' | 'Won' | 'Lost';
export type Priority = 'low' | 'medium' | 'high';
export type Health = 'ok' | 'warn' | 'risk';

export interface Project {
  id: string;
  name: string;
  customer: string;
  category: string;
  stage: ProjectStage;
  /** Design-win value in USD. */
  value: number;
  owner: string;
  health: Health;
  updated: string;
  diagrams: number;
  parts: number;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'ended';
  budget: number;
  spent: number;
  start: string;
  end: string;
  leads: number;
  converted: number;
}

export interface Supplier {
  id: string;
  name: string;
  tier: 'Franchise' | 'Preferred' | 'Approved';
  categories: string[];
  /** On-time delivery, percent. */
  otd: number;
  quality: number;
  leadTimeDays: number;
  activeProjects: number;
}

export interface Ticket {
  id: string;
  title: string;
  project: string;
  part: string;
  priority: Priority;
  status: 'open' | 'in-progress' | 'waiting' | 'closed';
  requester: string;
  assignee: string;
  age: string;
}

export interface PartResult {
  mpn: string;
  manufacturer: string;
  description: string;
  category: string;
  lifecycle: 'Active' | 'NRND' | 'EOL';
  stock: number;
  price: number;
  leadTimeWeeks: number;
  /** 0..100 — how well it matches the current search. */
  match: number;
}

export interface CrossReference {
  original: string;
  originalMfr: string;
  alternate: string;
  alternateMfr: string;
  /** exact | functional | parametric */
  kind: 'exact' | 'functional' | 'parametric';
  confidence: number;
  note: string;
}

export interface InspectionItem {
  id: string;
  title: string;
  scope: string;
  severity: 'risk' | 'warn' | 'info';
  detail: string;
  owner: string;
  age: string;
  status: 'open' | 'acknowledged' | 'resolved';
}

export interface DiagramCard {
  id: number;
  name: string;
  category: string;
  owner: string;
  updated: string;
  blocks: number;
  parts: number;
  visibility: 'Private' | 'Team' | 'Public';
  /** Present when the diagram is backed by a real saved record. */
  real?: boolean;
}

export interface ActivityEntry {
  who: string;
  action: string;
  target: string;
  when: string;
  kind: 'diagram' | 'project' | 'part' | 'review' | 'campaign';
}

export interface Notification {
  id: string;
  title: string;
  detail: string;
  when: string;
  severity: 'info' | 'warn' | 'risk';
  read: boolean;
}

// ---------------------------------------------------------------------------
// Project workspace — the IDE model.
//
// Projects are owned by Salesforce and synced here once a day; Salesforce keeps
// the workflow, this workspace keeps the engineering artefacts that hang off it.
// A project is therefore a container: diagrams, documents, datasets, parts and
// reviews all live under one node, which is why the UI is shaped like an IDE.
// ---------------------------------------------------------------------------

export type ArtifactKind = 'diagram' | 'document' | 'dataset' | 'bom' | 'review';

export interface Artifact {
  id: string;
  name: string;
  kind: ArtifactKind;
  /** Folder path inside the project, e.g. "Diagrams/Power". */
  folder: string;
  updated: string;
  author: string;
  /** Bytes, for documents and datasets. */
  size?: number;
  /** Backing diagram id when kind === 'diagram' and it is a real saved record. */
  diagramId?: number;
  /** Where the artefact came from. Salesforce-sourced items are read-only here. */
  origin: 'salesforce' | 'workspace';
  /** Dataset preview: header row + a few rows. */
  preview?: { columns: string[]; rows: (string | number)[][] };
  /** Document summary shown in the viewer. */
  summary?: string;
}

export interface ProjectWorkspace extends Project {
  /** Salesforce record id this project mirrors. */
  sfdcId: string;
  artifacts: Artifact[];
}

export interface SyncState {
  lastSync: string;
  nextSync: string;
  /** Projects pulled in the last run. */
  synced: number;
  failed: number;
  running: boolean;
}

/** An artefact open in an editor tab. */
export interface OpenTab {
  artifactId: string;
  projectId: string;
  name: string;
  kind: ArtifactKind;
  dirty?: boolean;
}
