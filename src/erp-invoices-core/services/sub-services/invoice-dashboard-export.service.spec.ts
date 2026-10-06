import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as ExcelJS from 'exceljs';
import { InvoiceDashboardExportService } from './invoice-dashboard-export.service';
import { InvoiceDashboardStatsService } from './invoice-dashboard-stats.service';
import { InvoiceDashboardPartnersService } from './invoice-dashboard-partners.service';

describe('InvoiceDashboardExportService', () => {
  let service: InvoiceDashboardExportService;
  let mockInvoiceRepo: any;
  let mockStatsService: any;
  let mockPartnersService: any;

  beforeEach(() => {
    mockInvoiceRepo = {
      query: jest.fn<any>(),
    };

    mockStatsService = {
      getDashboardStats: jest.fn<any>().mockResolvedValue({
        cashTrend: [
          {
            label: '2026-09',
            cashIn: 50000000,
            cashOut: 20000000,
            vatIn: 2000000,
            vatOut: 5000000,
          },
        ],
      }),
    };

    mockPartnersService = {
      getDashboardPartners: jest.fn<any>().mockResolvedValue({
        items: [
          {
            taxCode: '010101',
            partnerName: 'Công ty Mua A',
            totalInAmount: 0,
            totalOutAmount: 50000000,
            payableAmount: 0,
            receivableAmount: 30000000,
          },
          {
            taxCode: '020202',
            partnerName: 'Công ty Bán B',
            totalInAmount: 20000000,
            totalOutAmount: 0,
            payableAmount: 10000000,
            receivableAmount: 0,
          },
        ],
        total: 2,
        page: 1,
        pageSize: 100000,
        totalPages: 1,
      }),
    };

    service = new InvoiceDashboardExportService(
      mockInvoiceRepo,
      mockStatsService as unknown as InvoiceDashboardStatsService,
      mockPartnersService as unknown as InvoiceDashboardPartnersService,
    );
  });

  describe('getDetailedInvoices', () => {
    it('should query raw invoices and calculate remaining amounts', async () => {
      mockInvoiceRepo.query.mockResolvedValueOnce([
        {
          invoiceNo: '00001',
          serialNo: '1C26TAA',
          invoiceDate: '2026-09-01',
          direction: 'OUT',
          sellerName: 'Greenway',
          sellerTaxCode: '0316',
          buyerName: 'Công ty Mua A',
          buyerTaxCode: '010101',
          preVatAmount: '45454545',
          vatAmount: '4545455',
          totalAmount: '50000000',
          paidAmount: '20000000',
          status: 'ISSUED',
        },
      ]);

      const result = await service.getDetailedInvoices(
        '2026-09-01',
        '2026-09-30',
        'null',
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        invoiceNo: '00001',
        serialNo: '1C26TAA',
        invoiceDate: '2026-09-01',
        direction: 'OUT',
        sellerName: 'Greenway',
        sellerTaxCode: '0316',
        buyerName: 'Công ty Mua A',
        buyerTaxCode: '010101',
        preVatAmount: 45454545,
        vatAmount: 4545455,
        totalAmount: 50000000,
        paidAmount: 20000000,
        remainingAmount: 30000000,
        status: 'ISSUED',
      });
    });
  });

  describe('exportExcel', () => {
    it('should build a 5-worksheet Excel workbook and return a valid Buffer', async () => {
      mockInvoiceRepo.query.mockResolvedValueOnce([
        {
          invoiceNo: 'OUT01',
          serialNo: '1C26TAA',
          invoiceDate: '2026-09-01',
          direction: 'OUT',
          sellerName: 'Greenway',
          sellerTaxCode: '0316',
          buyerName: 'Công ty Mua A',
          buyerTaxCode: '010101',
          preVatAmount: '45454545',
          vatAmount: '4545455',
          totalAmount: '50000000',
          paidAmount: '20000000',
          status: 'ISSUED',
        },
        {
          invoiceNo: 'IN01',
          serialNo: '1C26TBB',
          invoiceDate: '2026-09-02',
          direction: 'IN',
          sellerName: 'Công ty Bán B',
          sellerTaxCode: '020202',
          buyerName: 'Greenway',
          buyerTaxCode: '0316',
          preVatAmount: '18181818',
          vatAmount: '1818182',
          totalAmount: '20000000',
          paidAmount: '10000000',
          status: 'RECEIVED',
        },
      ]);

      const buffer = await service.exportExcel(
        '2026-09-01',
        '2026-09-30',
        'b-1',
      );

      expect(buffer).toBeDefined();
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);

      // Verify workbook sheets
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const sheetNames = workbook.worksheets.map((ws) => ws.name);
      expect(sheetNames).toEqual([
        'Tổng quan',
        'Phải thu',
        'Phải trả',
        'Chi tiết phải thu',
        'Chi tiết phải trả',
      ]);
    });
  });
});
