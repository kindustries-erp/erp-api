import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InvoiceDashboardPartnersService } from './invoice-dashboard-partners.service';

describe('InvoiceDashboardPartnersService', () => {
  let service: InvoiceDashboardPartnersService;
  let mockInvoiceRepo: any;

  beforeEach(() => {
    mockInvoiceRepo = {
      query: jest.fn(),
    };

    service = new InvoiceDashboardPartnersService(mockInvoiceRepo);
  });

  describe('getDashboardPartners', () => {
    it('should query partners, calculate payable/receivable and return paginated data', async () => {
      // Mock count query
      mockInvoiceRepo.query
        .mockResolvedValueOnce([{ count: '2' }])
        // Mock data query
        .mockResolvedValueOnce([
          {
            taxCode: '0101010101',
            partnerName: 'Công ty Cung Cấp A',
            totalInAmount: '10000000',
            totalOutAmount: '0',
            paidAmount: '4000000',
            receivedAmount: '0',
          },
          {
            taxCode: '0202020202',
            partnerName: 'Công ty Mua B',
            totalInAmount: '0',
            totalOutAmount: '20000000',
            paidAmount: '0',
            receivedAmount: '15000000',
          },
        ]);

      const result = await service.getDashboardPartners(
        1,
        20,
        'Công ty',
        '2026-01-01',
        '2026-09-30',
        undefined,
        'payableAmount',
        'DESC',
      );

      expect(mockInvoiceRepo.query).toHaveBeenCalledTimes(2);
      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);

      // Verify Company A: payableAmount = 10M - 4M = 6M
      expect(result.items[0]).toEqual({
        taxCode: '0101010101',
        partnerName: 'Công ty Cung Cấp A',
        totalInAmount: 10000000,
        totalOutAmount: 0,
        payableAmount: 6000000,
        receivableAmount: 0,
      });

      // Verify Company B: receivableAmount = 20M - 15M = 5M
      expect(result.items[1]).toEqual({
        taxCode: '0202020202',
        partnerName: 'Công ty Mua B',
        totalInAmount: 0,
        totalOutAmount: 20000000,
        payableAmount: 0,
        receivableAmount: 5000000,
      });
    });

    it('should apply columnSearch and columnFilters correctly', async () => {
      mockInvoiceRepo.query
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([]);

      await service.getDashboardPartners(
        1,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        JSON.stringify({ partnerName: 'VinFast' }),
        JSON.stringify({ taxCode: ['0101010101', '0202020202'] }),
      );

      expect(mockInvoiceRepo.query).toHaveBeenCalled();
      const countQueryCall = mockInvoiceRepo.query.mock.calls[0][0] as string;
      expect(countQueryCall).toContain('p."partnerName" ILIKE \'%VinFast%\'');
      expect(countQueryCall).toContain(
        "p.\"taxCode\" IN ('0101010101', '0202020202')",
      );
    });
  });
});
