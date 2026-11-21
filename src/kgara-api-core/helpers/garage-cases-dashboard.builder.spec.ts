import * as ExcelJS from 'exceljs';
import { buildCasesDashboard } from './garage-cases-dashboard.builder';
import type {
  CaseDashboardRow,
  Sheet1Summary,
} from './kgara-completed-cases-sheet.builder';

const row = (
  caseNo: string,
  vehicleKey: string,
  revenue = 100,
): CaseDashboardRow => ({
  caseNo,
  vehicleKey,
  customerName: 'Khách A',
  classification: 'Sửa chữa chung',
  receivedDate: null,
  completionDate: new Date(2026, 6, 10),
  issuedDate: null,
  revenue,
  cost: 60,
  profit: 40,
  receivable: 0,
  payable: 0,
  received: 0,
  paid: 0,
  expected: 0,
  planned: 0,
});

const cellValues = (ws: ExcelJS.Worksheet): unknown[] => {
  const values: unknown[] = [];
  ws.eachRow((r) => r.eachCell((c) => values.push(c.value)));
  return values;
};

describe('buildCasesDashboard (KPI SỐ XE, nhãn số lệnh)', () => {
  it('KPI đếm xe khác nhau; tiêu đề ghi số lệnh; không còn nhãn SỐ PHIẾU', () => {
    const rows = [
      row('PDV-1', '51A12345'),
      row('PDV-2', '51A12345'),
      row('PDV-3', '29B99999'),
      row('PDV-4', 'case-id-4'),
    ];
    const summary: Sheet1Summary = {
      sums: { doanhThu: 400, chiPhi: 240, loiNhuan: 160 },
      rows,
      columns: [],
    };
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Dashboard');

    buildCasesDashboard(ws, summary, { dateBasis: 'completion' });

    const values = cellValues(ws);
    expect(values).toContain('SỐ XE (4 lệnh)');
    expect(values).toContain(3);
    expect(values).not.toContain('SỐ PHIẾU DỊCH VỤ');
    expect(values).not.toContain('Số lệnh: 4');
  });

  it('không có phiếu: KPI SỐ XE = 0 và nhãn 0 lệnh', () => {
    const summary: Sheet1Summary = { sums: {}, rows: [], columns: [] };
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Dashboard');

    const charts = buildCasesDashboard(ws, summary, {
      dateBasis: 'completion',
    });

    expect(charts).toEqual([]);
    const values = cellValues(ws);
    expect(values).toContain('SỐ XE (0 lệnh)');
    expect(values).toContain(0);
  });
});
