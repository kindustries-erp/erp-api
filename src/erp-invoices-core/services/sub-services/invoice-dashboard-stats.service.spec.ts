import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { InvoiceDashboardStatsService } from './invoice-dashboard-stats.service';

describe('InvoiceDashboardStatsService', () => {
  let service: InvoiceDashboardStatsService;
  let mockInvoiceRepo: jest.Mocked<Repository<ErpInvoice>>;
  let mockQueryBuilder: any;

  beforeEach(() => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    };

    mockInvoiceRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    } as unknown as jest.Mocked<Repository<ErpInvoice>>;

    service = new InvoiceDashboardStatsService(mockInvoiceRepo);
  });

  describe('getDashboardStats', () => {
    it('should aggregate monthly cashIn, cashOut, vatIn, vatOut and return cashTrend', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([
        {
          month: '2026-08',
          cashIn: '1000000',
          cashOut: '500000',
          vatIn: '50000',
          vatOut: '100000',
        },
        {
          month: '2026-09',
          cashIn: '2000000',
          cashOut: '800000',
          vatIn: '80000',
          vatOut: '200000',
        },
      ]);

      const result = await service.getDashboardStats(
        '2026-08-01',
        '2026-09-30',
        'null',
      );

      expect(mockInvoiceRepo.createQueryBuilder).toHaveBeenCalledWith('inv');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'inv.branch_id IS NULL',
      );
      expect(result.cashTrend).toHaveLength(2);
      expect(result.cashTrend[0]).toEqual({
        label: '2026-08',
        cashIn: 1000000,
        cashOut: 500000,
        vatIn: 50000,
        vatOut: 100000,
      });
      expect(result.cashTrend[1]).toEqual({
        label: '2026-09',
        cashIn: 2000000,
        cashOut: 800000,
        vatIn: 80000,
        vatOut: 200000,
      });
    });

    it('should filter by branch_id when provided', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      await service.getDashboardStats(
        '2026-01-01',
        '2026-09-30',
        'branch-uuid-123',
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'inv.branch_id = :branchId',
        { branchId: 'branch-uuid-123' },
      );
    });
  });

  describe('getPartnerStats', () => {
    it('should query monthly cash trend for a specific partner tax code', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([
        {
          month: '2026-09',
          cashIn: '3500000',
          cashOut: '1200000',
        },
      ]);

      const result = await service.getPartnerStats(
        '0102030405',
        '2026-09-01',
        '2026-09-30',
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(inv.seller_tax_code = :taxCode OR inv.buyer_tax_code = :taxCode)',
        { taxCode: '0102030405' },
      );
      expect(result.cashTrend).toEqual([
        {
          label: '2026-09',
          cashIn: 3500000,
          cashOut: 1200000,
        },
      ]);
    });
  });
});
