import * as ExcelJS from 'exceljs';
import { GarageOpexExportService } from './garage-opex-export.service';

describe('GarageOpexExportService', () => {
  let service: GarageOpexExportService;
  let mockOpexRepo: any;
  let mockPnlService: any;

  beforeEach(() => {
    mockOpexRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: '1',
            periodYear: 2026,
            periodMonth: 10,
            categoryKey: 'TIEN_DIEN',
            categoryName: 'Tiền điện',
            amount: 5000000,
            ojAmount: 1000000,
            recurrenceType: 'monthly',
            sourceCashflowVoucherId: null,
            note: 'Tiền điện tháng 10',
            createdAt: new Date('2026-10-01'),
          },
          {
            id: '2',
            periodYear: 2026,
            periodMonth: 10,
            categoryKey: 'HOA_HONG_TRUC_TIEP',
            categoryName: 'Hoa hồng trực tiếp',
            amount: 2000000,
            ojAmount: 500000,
            recurrenceType: null,
            sourceCashflowVoucherId: 'voucher-1',
            note: '',
            createdAt: new Date('2026-10-05'),
          },
        ]),
      }),
    };

    mockPnlService = {
      getPnlReport: jest.fn().mockResolvedValue({
        revenue: {
          total: 100000000,
          ojTotal: 20000000,
          serviceTotal: 80000000,
          ojServiceTotal: 15000000,
          partsTotal: 20000000,
          ojPartsTotal: 5000000,
        },
        cogs: {
          total: 40000000,
          ojTotal: 8000000,
          partsCost: 30000000,
          ojPartsCost: 6000000,
          subcontractCost: 10000000,
          ojSubcontractCost: 2000000,
        },
        grossProfit: { total: 60000000, ojTotal: 12000000 },
        opex: {
          total: 20000000,
          ojTotal: 4000000,
          items: [
            {
              categoryKey: 'TIEN_DIEN',
              categoryName: 'Tiền điện',
              amount: 5000000,
              ojAmount: 1000000,
            },
          ],
        },
        commission: {
          total: 5000000,
          ojTotal: 1000000,
          saleCommission: 2000000,
          dvCommission: 3000000,
        },
        summary: {
          netProfitBeforeCommission: 40000000,
          netProfitAfterCommission: 35000000,
        },
      }),
    };

    service = new GarageOpexExportService(mockOpexRepo, mockPnlService);
  });

  it('exports an Excel workbook buffer with 3 worksheets', async () => {
    const buffer = await service.exportExcel({
      mode: 'by-period',
      year: 2026,
      month: 10,
    });

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    expect(workbook.worksheets.length).toBe(3);
    expect(workbook.getWorksheet('Tổng quan chi phí')).toBeDefined();
    expect(workbook.getWorksheet('Bảng kê chi tiết chi phí')).toBeDefined();
    expect(workbook.getWorksheet('Báo cáo P&L Tháng 10-2026')).toBeDefined();

    // Verify detail sheet has rows
    const detailSheet = workbook.getWorksheet('Bảng kê chi tiết chi phí');
    expect(detailSheet?.rowCount).toBeGreaterThan(4);
  });
});
