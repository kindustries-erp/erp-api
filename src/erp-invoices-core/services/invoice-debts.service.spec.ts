import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Workbook } from 'exceljs';
import { InvoiceDebtsService } from './invoice-debts.service';
import { ErpInvoice } from '../entities/erp_invoice.entity';
import { InvoicePartnerType } from '../dto/get-invoice-debts.dto';

import { InvoiceDebtsQueryService } from './sub-services/invoice-debts-query.service';
import { InvoiceDebtsDetailService } from './sub-services/invoice-debts-detail.service';
import { InvoiceDebtsExportService } from './sub-services/invoice-debts-export.service';

describe('InvoiceDebtsService', () => {
  let service: InvoiceDebtsService;
  let mockInvoiceRepo: {
    query: jest.Mock;
  };

  beforeEach(async () => {
    mockInvoiceRepo = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceDebtsService,
        InvoiceDebtsQueryService,
        InvoiceDebtsDetailService,
        InvoiceDebtsExportService,
        {
          provide: getRepositoryToken(ErpInvoice),
          useValue: mockInvoiceRepo,
        },
      ],
    }).compile();

    service = module.get<InvoiceDebtsService>(InvoiceDebtsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDebts', () => {
    it('should query customers debt correctly (partner_type = CUSTOMER)', async () => {
      const mockSummary = [
        {
          totalPartners: '2',
          totalInvoiceCount: '5',
          grandTotalAmount: '50000000',
          grandTotalPaid: '30000000',
          grandTotalBalance: '20000000',
          grandTotalAging0To30: '15000000',
          grandTotalAging31To60: '5000000',
          grandTotalAging61To90: '0',
          grandTotalAgingOver90: '0',
        },
      ];

      const mockItems = [
        {
          taxCode: '0101234567',
          partnerName: 'Công ty A',
          address: 'Hà Nội',
          invoiceCount: '3',
          totalAmount: '30000000',
          paidAmount: '20000000',
          balanceAmount: '10000000',
          maxAgingDays: '15',
          weightedAgingDays: '10',
          latestInvoiceDate: '2026-08-01',
          aging0To30: '10000000',
          aging31To60: '0',
          aging61To90: '0',
          agingOver90: '0',
          count0To30: '2',
          count31To60: '0',
          count61To90: '0',
          countOver90: '0',
        },
        {
          taxCode: '0309876543',
          partnerName: 'Công ty B',
          address: 'TP.HCM',
          invoiceCount: '2',
          totalAmount: '20000000',
          paidAmount: '10000000',
          balanceAmount: '10000000',
          maxAgingDays: '45',
          weightedAgingDays: '40',
          latestInvoiceDate: '2026-07-15',
          aging0To30: '5000000',
          aging31To60: '5000000',
          aging61To90: '0',
          agingOver90: '0',
          count0To30: '1',
          count31To60: '1',
          count61To90: '0',
          countOver90: '0',
        },
      ];

      mockInvoiceRepo.query
        .mockResolvedValueOnce(mockSummary) // count & summary query
        .mockResolvedValueOnce(mockItems); // data query

      const result = await service.getDebts({
        partner_type: InvoicePartnerType.CUSTOMER,
        page: 1,
        pageSize: 20,
      });

      expect(result.total).toBe(2);
      expect(result.items.length).toBe(2);
      expect(result.items[0].taxCode).toBe('0101234567');
      expect(result.items[0].balanceAmount).toBe(10000000);
      expect(result.items[0].aging0To30).toBe(10000000);
      expect(result.items[0].count0To30).toBe(2);
      expect(result.items[1].aging31To60).toBe(5000000);
      expect(result.summary.grandTotalAmount).toBe(50000000);
      expect(result.summary.grandTotalBalance).toBe(20000000);
      expect(result.summary.grandTotalAging0To30).toBe(15000000);
      expect(result.summary.grandTotalAging31To60).toBe(5000000);
    });

    it('should query suppliers debt correctly (partner_type = SUPPLIER)', async () => {
      const mockSummary = [
        {
          totalPartners: '1',
          totalInvoiceCount: '2',
          grandTotalAmount: '100000000',
          grandTotalPaid: '80000000',
          grandTotalBalance: '20000000',
        },
      ];

      const mockItems = [
        {
          taxCode: '0105556667',
          partnerName: 'Nhà cung cấp X',
          address: 'Hải Phòng',
          invoiceCount: '2',
          totalAmount: '100000000',
          paidAmount: '80000000',
          balanceAmount: '20000000',
          maxAgingDays: '20',
          latestInvoiceDate: '2026-08-10',
        },
      ];

      mockInvoiceRepo.query
        .mockResolvedValueOnce(mockSummary)
        .mockResolvedValueOnce(mockItems);

      const result = await service.getDebts({
        partner_type: InvoicePartnerType.SUPPLIER,
        page: 1,
        pageSize: 20,
      });

      expect(result.total).toBe(1);
      expect(result.items[0].partnerName).toBe('Nhà cung cấp X');
      expect(result.summary.grandTotalPaid).toBe(80000000);
    });
  });

  describe('getColumnOptions', () => {
    it('should return static options for paymentProgress', async () => {
      const result = await service.getColumnOptions({
        column_key: 'paymentProgress',
      });
      expect(result.items.length).toBe(3);
      expect(result.items[0].value).toBe('PAID');
    });

    it('should return static options for maxAgingDays', async () => {
      const result = await service.getColumnOptions({
        column_key: 'maxAgingDays',
      });
      expect(result.items.length).toBe(5);
      expect(result.items[0].value).toBe('0-30');
    });
  });

  describe('exportDebtsExcel', () => {
    it('should generate an Excel buffer with multiple sheets, SUM/SUBTOTAL rows, freeze panes and aging header colors', async () => {
      const mockSummary = [
        {
          totalPartners: '1',
          totalInvoiceCount: '2',
          grandTotalAmount: '50000000',
          grandTotalPaid: '30000000',
          grandTotalBalance: '20000000',
          grandTotalAging0To30: '10000000',
          grandTotalAging31To60: '10000000',
          grandTotalAging61To90: '0',
          grandTotalAgingOver90: '0',
        },
      ];

      const mockItems = [
        {
          taxCode: '0101234567',
          partnerName: 'Công ty Test',
          address: 'Hà Nội',
          invoiceCount: '2',
          totalAmount: '50000000',
          paidAmount: '30000000',
          balanceAmount: '20000000',
          aging0To30: '10000000',
          aging31To60: '10000000',
          aging61To90: '0',
          agingOver90: '0',
          maxAgingDays: '15',
          weightedAgingDays: '12',
          latestInvoiceDate: '2026-08-01',
        },
      ];

      const mockDetailedInvoices = [
        {
          id: 'inv-1',
          invoiceNo: '00001',
          serialNo: '1C26TGA',
          invoiceDate: '2026-08-01',
          direction: 'OUT',
          buyerName: 'Công ty Test',
          buyerTaxCode: '0101234567',
          preVatAmount: 20000000,
          vatAmount: 2000000,
          totalAmount: 22000000,
          paidAmount: 22000000,
          balanceAmount: 0,
          agingDays: 0,
          status: 'ACTIVE',
        },
      ];

      // 1. mock summary query
      // 2. mock items query
      // 3. mock detailed invoices query
      mockInvoiceRepo.query
        .mockResolvedValueOnce(mockSummary)
        .mockResolvedValueOnce(mockItems)
        .mockResolvedValueOnce(mockDetailedInvoices);

      const buffer = await service.exportDebtsExcel({
        partner_type: InvoicePartnerType.CUSTOMER,
        date_from: '2026-08-01',
        date_to: '2026-08-31',
      });

      expect(buffer).toBeDefined();
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);

      // Verify Excel contents using exceljs
      const loadedWb = new Workbook();
      await loadedWb.xlsx.load(buffer as any);

      // Sheet 1: Tổng hợp công nợ KH
      const sheet1 = loadedWb.getWorksheet('Tổng hợp công nợ KH');
      expect(sheet1).toBeDefined();
      expect(sheet1?.views?.[0]?.state).toBe('frozen');
      expect((sheet1?.views?.[0] as any)?.ySplit).toBe(4);

      // Check SUM row (Row 1) & SUBTOTAL row (Row 2)
      expect(sheet1?.getRow(1).getCell(2).value).toBe('TỔNG CỘNG (SUM)');
      expect(sheet1?.getRow(2).getCell(2).value).toBe(
        'TỔNG THEO BỘ LỌC (SUBTOTAL)',
      );

      // Check Header row (Row 4) colors
      const s1Header = sheet1?.getRow(4);
      expect(s1Header?.getCell(1).value).toBe('STT');
      expect((s1Header?.getCell(1).fill as any)?.fgColor?.argb).toBe(
        'FF334155',
      );
      // Aging header colors
      expect(s1Header?.getCell(9).value).toBe('Nợ 0-30 ngày');
      expect((s1Header?.getCell(9).fill as any)?.fgColor?.argb).toBe(
        'FF059669',
      ); // Emerald
      expect(s1Header?.getCell(10).value).toBe('Nợ 31-60 ngày');
      expect((s1Header?.getCell(10).fill as any)?.fgColor?.argb).toBe(
        'FFD97706',
      ); // Amber
      expect(s1Header?.getCell(11).value).toBe('Nợ 61-90 ngày');
      expect((s1Header?.getCell(11).fill as any)?.fgColor?.argb).toBe(
        'FFEA580C',
      ); // Orange
      expect(s1Header?.getCell(12).value).toBe('Nợ >90 ngày');
      expect((s1Header?.getCell(12).fill as any)?.fgColor?.argb).toBe(
        'FFE11D48',
      ); // Rose

      // Verify that detailed invoices query contained partner filter
      const detailedQueryCall = mockInvoiceRepo.query.mock.calls[2][0];
      expect(detailedQueryCall).toContain('0101234567');

      // Sheet 2: Chi tiết hóa đơn đối tác
      const sheet2 = loadedWb.getWorksheet('Chi tiết hóa đơn đối tác');
      expect(sheet2).toBeDefined();
      expect(sheet2?.views?.[0]?.state).toBe('frozen');
      expect((sheet2?.views?.[0] as any)?.ySplit).toBe(4);

      expect(sheet2?.getRow(1).getCell(7).value).toBe('TỔNG CỘNG (SUM)');
      expect(sheet2?.getRow(2).getCell(7).value).toBe(
        'TỔNG THEO BỘ LỌC (SUBTOTAL)',
      );

      const s2Header = sheet2?.getRow(4);
      expect(s2Header?.getCell(1).value).toBe('STT');
      expect((s2Header?.getCell(1).fill as any)?.fgColor?.argb).toBe(
        'FF334155',
      );
      expect((s2Header?.getCell(13).fill as any)?.fgColor?.argb).toBe(
        'FF059669',
      );
      expect((s2Header?.getCell(14).fill as any)?.fgColor?.argb).toBe(
        'FFD97706',
      );
      expect((s2Header?.getCell(15).fill as any)?.fgColor?.argb).toBe(
        'FFEA580C',
      );
      expect((s2Header?.getCell(16).fill as any)?.fgColor?.argb).toBe(
        'FFE11D48',
      );
    });

    it('should return empty detailed invoices when no partners match filter', async () => {
      const mockSummary = [
        {
          totalPartners: '0',
          totalInvoiceCount: '0',
          grandTotalAmount: '0',
          grandTotalPaid: '0',
          grandTotalBalance: '0',
        },
      ];

      // 1. mock summary query
      // 2. mock items query (empty)
      mockInvoiceRepo.query
        .mockResolvedValueOnce(mockSummary)
        .mockResolvedValueOnce([]);

      const buffer = await service.exportDebtsExcel({
        partner_type: InvoicePartnerType.CUSTOMER,
        search: 'NonExistentPartner',
      });

      expect(buffer).toBeDefined();
      const loadedWb = new Workbook();
      await loadedWb.xlsx.load(buffer as any);

      const sheet2 = loadedWb.getWorksheet('Chi tiết hóa đơn đối tác');
      expect(sheet2).toBeDefined();
      expect(sheet2?.rowCount).toBe(4); // Only top 4 rows (SUM, SUBTOTAL, blank, header)
    });
  });
});
