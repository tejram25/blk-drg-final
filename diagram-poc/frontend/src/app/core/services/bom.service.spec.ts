import { BomService } from './bom.service';

describe('BomService', () => {
  let service: BomService;

  beforeEach(() => (service = new BomService()));

  const part = (name: string, supplier = 'TI', mfr = 'TI') => ({
    arwPartNum: { name },
    supp: { name: supplier },
    mfr: { name: mfr },
    invOrgs: [{ desc: `${name} description` }],
  });

  it('groups identical parts and tallies quantity', () => {
    const rows = service.build([part('INA250A3PWR'), part('INA250A3PWR'), part('LM317')]);
    expect(rows.length).toBe(2);
    const ina = rows.find((r) => r.partNumber === 'INA250A3PWR')!;
    expect(ina.quantity).toBe(2);
    expect(ina.supplier).toBe('TI');
  });

  it('falls back to a placeholder part number when missing', () => {
    const rows = service.build([{ supp: { name: 'X' } }]);
    expect(rows[0].partNumber).toBe('Unknown');
  });

  it('renders CSV with a header and quoted fields containing commas', () => {
    const rows = service.build([{ arwPartNum: { name: 'A' }, invOrgs: [{ desc: 'has, comma' }] }]);
    const csv = service.toCsv(rows);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('#,Part Number,Manufacturer,Supplier,Description,Qty');
    expect(lines[1]).toContain('"has, comma"');
  });
});
