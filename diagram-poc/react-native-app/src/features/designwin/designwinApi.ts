import { api } from '../../api/client';
import { Part } from '../parts/partsApi';

export interface DwCustomer {
  customerName: string;
  billTo: string;
  accountNumber: string;
  status: string;
}
export interface DwProject {
  projectName: string;
  projectId: string;
  stage: string;
  eau: string;
}
export interface DwBoard {
  boardName: string;
  boardNum: string;
  registrationNum: string;
  status: string;
}
export interface DwPart {
  partNumber: string;
  mfrName: string;
  description: string;
  quantity: number;
}

export function dwPartToPart(p: DwPart): Part {
  return { partNumber: p.partNumber, manufacturer: p.mfrName, supplier: '', description: p.description };
}

function list(data: any, resultKey: string, listKey: string): any[] {
  const arr = data?.[resultKey]?.[listKey];
  return Array.isArray(arr) ? arr : [];
}

async function get(path: string, query: Record<string, string | undefined>) {
  return api.get<Record<string, any>>(`/designwin/${path}`, query);
}

export const designwinApi = {
  // The Arrow API (and the mock) require a customer name or bill-to to search,
  // exactly like the desktop app — so the modal searches customers first.
  customers: async (customerName?: string, billToNumber?: string): Promise<DwCustomer[]> =>
    list(await get('customers', { customerName, billToNumber }), 'customerServiceResult', 'customers').map((c) => ({
      customerName: c.customerName ?? '',
      billTo: c.billTo ?? '',
      accountNumber: c.accountNumber ?? '',
      status: c.status ?? '',
    })),
  projects: async (customerName: string): Promise<DwProject[]> =>
    list(await get('projects', { customerName }), 'projectServiceResult', 'projects').map((p) => ({
      projectName: p.projectName ?? '',
      projectId: p.projectId ?? '',
      stage: p.stage ?? '',
      eau: `${p.eau ?? ''}`,
    })),
  boards: async (projectId: string): Promise<DwBoard[]> =>
    list(await get('boards', { projectId }), 'boardServiceResult', 'boards').map((b) => ({
      boardName: b.boardName ?? '',
      boardNum: b.boardNum ?? '',
      registrationNum: b.registrationNum ?? '',
      status: b.status ?? '',
    })),
  custParts: async (projectId: string, boardNum: string): Promise<DwPart[]> =>
    list(await get('cust-parts', { projectId, boardNum }), 'custPartServiceResult', 'parts').map((p) => ({
      partNumber: p.partNumber ?? '',
      mfrName: p.mfrName ?? '',
      description: p.description ?? '',
      quantity: parseInt(`${p.quantity ?? 1}`, 10) || 1,
    })),
};
