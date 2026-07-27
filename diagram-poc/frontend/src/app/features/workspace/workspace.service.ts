import { Injectable, computed, signal } from '@angular/core';
import {
  ActivityEntry, Campaign, CrossReference, InspectionItem, Notification, PartResult,
  Project, Region, Role, Supplier, Ticket,
} from './workspace.models';

/**
 * Data for the workspace modules.
 *
 * The engineering side (diagrams, parts search, design review) is served by the
 * real backend through its own services. The commercial modules — projects,
 * campaigns, suppliers, support, analytics — have no backend yet, so they are
 * served from here. Keeping them behind one service means swapping in real HTTP
 * calls later touches this file and nothing else.
 *
 * Region and role are workspace-wide state: pages read them to filter, and the
 * header switches them.
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  readonly region = signal<Region>('AC');
  readonly role = signal<Role>('Engineer');

  setRegion(r: Region): void { this.region.set(r); }
  setRole(r: Role): void { this.role.set(r); }

  // ---- projects ----------------------------------------------------------
  private readonly allProjects = signal<Project[]>([
    { id: 'PRJ-4821', name: 'BMS Controller Design', customer: 'Northwind Automotive', category: 'Automotive', stage: 'Design', value: 1_240_000, owner: 'Priya Raman', health: 'ok', updated: '2h ago', diagrams: 4, parts: 62 },
    { id: 'PRJ-4788', name: 'IoT Gateway Module', customer: 'Helio Systems', category: 'Industrial IoT', stage: 'Prototype', value: 680_000, owner: 'Marco Silva', health: 'warn', updated: '5h ago', diagrams: 3, parts: 41 },
    { id: 'PRJ-4763', name: 'Power Supply Unit', customer: 'Vantage Medical', category: 'Medical', stage: 'Production', value: 2_100_000, owner: 'Aisha Khan', health: 'ok', updated: '1d ago', diagrams: 6, parts: 118 },
    { id: 'PRJ-4740', name: 'Sensor Fusion Board', customer: 'Northwind Automotive', category: 'Automotive', stage: 'Discovery', value: 410_000, owner: 'Tom Becker', health: 'risk', updated: '2d ago', diagrams: 1, parts: 12 },
    { id: 'PRJ-4692', name: 'Edge Vision Camera', customer: 'Orbit Robotics', category: 'Industrial IoT', stage: 'Design', value: 930_000, owner: 'Priya Raman', health: 'ok', updated: '3d ago', diagrams: 2, parts: 55 },
    { id: 'PRJ-4655', name: 'Motor Drive Inverter', customer: 'Kestrel Energy', category: 'Energy', stage: 'Won', value: 3_450_000, owner: 'Marco Silva', health: 'ok', updated: '1w ago', diagrams: 8, parts: 203 },
  ]);
  projects = this.allProjects.asReadonly();

  readonly pipelineValue = computed(() =>
    this.allProjects().filter((p) => p.stage !== 'Lost').reduce((s, p) => s + p.value, 0));

  readonly byCategory = computed(() => {
    const m = new Map<string, number>();
    this.allProjects().forEach((p) => m.set(p.category, (m.get(p.category) ?? 0) + 1));
    return [...m.entries()].map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  });

  readonly byStage = computed(() => {
    const order: Project['stage'][] = ['Discovery', 'Design', 'Prototype', 'Production', 'Won'];
    return order.map((stage) => ({
      stage,
      count: this.allProjects().filter((p) => p.stage === stage).length,
      value: this.allProjects().filter((p) => p.stage === stage).reduce((s, p) => s + p.value, 0),
    }));
  });

  // ---- campaigns ---------------------------------------------------------
  private readonly allCampaigns = signal<Campaign[]>([
    { id: 'CMP-118', name: 'Q3 Automotive Power Push', description: 'Target tier-1 automotive accounts with the new 48V power portfolio.', status: 'active', budget: 250_000, spent: 141_500, start: '2026-07-01', end: '2026-09-30', leads: 184, converted: 23 },
    { id: 'CMP-114', name: 'Industrial IoT Starter Kits', description: 'Seed 500 evaluation kits with design-in support.', status: 'active', budget: 120_000, spent: 96_200, start: '2026-06-15', end: '2026-08-31', leads: 96, converted: 17 },
    { id: 'CMP-109', name: 'Medical Reliability Webinar', description: 'Lifecycle and compliance briefing for medical OEMs.', status: 'ended', budget: 45_000, spent: 44_100, start: '2026-04-01', end: '2026-05-15', leads: 62, converted: 9 },
  ]);
  campaigns = this.allCampaigns.asReadonly();

  addCampaign(c: Omit<Campaign, 'id' | 'leads' | 'converted' | 'spent' | 'status'>): void {
    const id = `CMP-${120 + this.allCampaigns().length}`;
    this.allCampaigns.update((list) => [
      { ...c, id, status: 'draft', spent: 0, leads: 0, converted: 0 }, ...list,
    ]);
  }

  // ---- suppliers ---------------------------------------------------------
  readonly suppliers = signal<Supplier[]>([
    { id: 'SUP-01', name: 'Texas Instruments', tier: 'Franchise', categories: ['Power', 'Analog', 'MCU'], otd: 97, quality: 99, leadTimeDays: 42, activeProjects: 14 },
    { id: 'SUP-02', name: 'Murata', tier: 'Franchise', categories: ['Passives', 'RF'], otd: 94, quality: 98, leadTimeDays: 35, activeProjects: 11 },
    { id: 'SUP-03', name: 'Würth Elektronik', tier: 'Preferred', categories: ['Passives', 'Connectors'], otd: 91, quality: 97, leadTimeDays: 28, activeProjects: 8 },
    { id: 'SUP-04', name: 'Analog Devices', tier: 'Franchise', categories: ['Analog', 'Sensors'], otd: 89, quality: 99, leadTimeDays: 56, activeProjects: 9 },
    { id: 'SUP-05', name: 'Vishay', tier: 'Approved', categories: ['Passives', 'Discretes'], otd: 86, quality: 95, leadTimeDays: 49, activeProjects: 5 },
  ]).asReadonly();

  // ---- support / query ---------------------------------------------------
  private readonly allTickets = signal<Ticket[]>([
    { id: 'SQ-2291', title: 'Power Management IC Design Support', project: 'BMS Controller Design', part: 'TPS563201DDCR', priority: 'high', status: 'in-progress', requester: 'Northwind Automotive', assignee: 'Priya Raman', age: '4h' },
    { id: 'SQ-2288', title: 'Block Diagram for Automotive Sensor', project: 'Sensor Fusion Board', part: '—', priority: 'medium', status: 'open', requester: 'Northwind Automotive', assignee: 'Unassigned', age: '1d' },
    { id: 'SQ-2280', title: 'Alternate for EOL buck regulator', project: 'Power Supply Unit', part: 'LM2596S-5.0', priority: 'high', status: 'waiting', requester: 'Vantage Medical', assignee: 'Marco Silva', age: '2d' },
    { id: 'SQ-2274', title: 'Thermal derating on 48V rail', project: 'Motor Drive Inverter', part: 'IRFB4110', priority: 'low', status: 'closed', requester: 'Kestrel Energy', assignee: 'Aisha Khan', age: '6d' },
  ]);
  tickets = this.allTickets.asReadonly();

  addTicket(t: Pick<Ticket, 'title' | 'project' | 'part' | 'priority'>): void {
    const id = `SQ-${2300 + this.allTickets().length}`;
    this.allTickets.update((list) => [
      { ...t, id, status: 'open', requester: 'Internal', assignee: 'Unassigned', age: 'just now' }, ...list,
    ]);
  }

  // ---- part intelligence -------------------------------------------------
  readonly parts = signal<PartResult[]>([
    { mpn: 'TPS563201DDCR', manufacturer: 'Texas Instruments', description: 'Buck converter, 4.5–17V in, 3A', category: 'Power', lifecycle: 'Active', stock: 12_480, price: 0.68, leadTimeWeeks: 6, match: 96 },
    { mpn: 'MP2315GJ-Z', manufacturer: 'Monolithic Power', description: 'Buck converter, 4.5–24V in, 3A', category: 'Power', lifecycle: 'Active', stock: 8_120, price: 0.74, leadTimeWeeks: 8, match: 91 },
    { mpn: 'LM2596S-5.0', manufacturer: 'Texas Instruments', description: 'Buck regulator, 3A, fixed 5V', category: 'Power', lifecycle: 'NRND', stock: 640, price: 1.92, leadTimeWeeks: 22, match: 78 },
    { mpn: 'GRM155R71C104KA88D', manufacturer: 'Murata', description: 'Cap, 0.1µF 0402 X7R 16V', category: 'Passives', lifecycle: 'Active', stock: 1_240_000, price: 0.004, leadTimeWeeks: 4, match: 74 },
    { mpn: 'RC0402FR-07100KL', manufacturer: 'Yageo', description: 'Res, 100kΩ 0402 0.1%', category: 'Passives', lifecycle: 'Active', stock: 890_000, price: 0.003, leadTimeWeeks: 3, match: 71 },
    { mpn: '744325220', manufacturer: 'Würth Elektronik', description: 'Inductor, 2.2µH shielded, 5.4A', category: 'Passives', lifecycle: 'Active', stock: 24_300, price: 0.41, leadTimeWeeks: 5, match: 69 },
  ]).asReadonly();

  readonly recentSearches = signal<string[]>([
    'buck converter 12V to 3.3V 2A', '0.1uF 0402 X7R', 'CAN transceiver automotive',
    'LM2596 alternate', 'shielded inductor 2.2uH',
  ]).asReadonly();

  // ---- fast repository ---------------------------------------------------
  readonly crossRefs = signal<CrossReference[]>([
    { original: 'LM2596S-5.0', originalMfr: 'Texas Instruments', alternate: 'TPS563201DDCR', alternateMfr: 'Texas Instruments', kind: 'functional', confidence: 88, note: 'Higher efficiency, smaller package. Requires layout change.' },
    { original: 'GRM155R71C104KA88D', originalMfr: 'Murata', alternate: 'CL05B104KO5NNNC', alternateMfr: 'Samsung', kind: 'exact', confidence: 99, note: 'Drop-in equivalent.' },
    { original: 'IRFB4110', originalMfr: 'Infineon', alternate: 'IPP041N12N3', alternateMfr: 'Infineon', kind: 'parametric', confidence: 82, note: 'Lower Rds(on); verify gate drive.' },
  ]).asReadonly();

  // ---- inspection loop ---------------------------------------------------
  readonly inspections = signal<InspectionItem[]>([
    { id: 'INS-31', title: 'NRND part in production BOM', scope: 'Power Supply Unit', severity: 'risk', detail: 'LM2596S-5.0 is NRND and appears in a released BOM. Qualify an alternate before the next build.', owner: 'Aisha Khan', age: '3h', status: 'open' },
    { id: 'INS-29', title: 'Single-source component', scope: 'BMS Controller Design', severity: 'warn', detail: 'Three line items have no approved second source.', owner: 'Priya Raman', age: '1d', status: 'acknowledged' },
    { id: 'INS-27', title: 'Lead time exceeds build window', scope: 'Sensor Fusion Board', severity: 'warn', detail: 'Analog Devices sensor quotes 56 days against a 30-day build window.', owner: 'Tom Becker', age: '2d', status: 'open' },
    { id: 'INS-22', title: 'Design review not run before release', scope: 'Edge Vision Camera', severity: 'info', detail: 'Rev B was released without a recorded design review.', owner: 'Priya Raman', age: '5d', status: 'resolved' },
  ]).asReadonly();

  // ---- activity + notifications -----------------------------------------
  readonly activity = signal<ActivityEntry[]>([
    { who: 'Claude', action: 'added a decoupling capacitor to', target: 'Buck Converter — Rev C', when: '2m', kind: 'diagram' },
    { who: 'Marco Silva', action: 'routed the feedback network on', target: 'Buck Converter — Rev C', when: '18m', kind: 'diagram' },
    { who: 'Aisha Khan', action: 'flagged an NRND part in', target: 'Power Supply Unit', when: '3h', kind: 'review' },
    { who: 'Priya Raman', action: 'moved to Design stage', target: 'BMS Controller Design', when: '5h', kind: 'project' },
    { who: 'Tom Becker', action: 'requested a cross reference for', target: 'LM2596S-5.0', when: '1d', kind: 'part' },
    { who: 'Marketing', action: 'launched', target: 'Q3 Automotive Power Push', when: '2d', kind: 'campaign' },
  ]).asReadonly();

  private readonly notes = signal<Notification[]>([
    { id: 'N1', title: 'NRND part in production BOM', detail: 'Power Supply Unit · LM2596S-5.0', when: '3h', severity: 'risk', read: false },
    { id: 'N2', title: 'Design review finished', detail: 'Buck Converter — Rev C · 2 findings', when: '5h', severity: 'warn', read: false },
    { id: 'N3', title: 'Campaign hit 75% of budget', detail: 'Q3 Automotive Power Push', when: '1d', severity: 'info', read: false },
  ]);
  notifications = this.notes.asReadonly();
  readonly unreadCount = computed(() => this.notes().filter((n) => !n.read).length);
  markAllRead(): void { this.notes.update((l) => l.map((n) => ({ ...n, read: true }))); }
}
