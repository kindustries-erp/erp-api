import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InvoiceDashboardService } from './invoice-dashboard.service';
import { InvoiceDashboardStatsService } from './services/sub-services/invoice-dashboard-stats.service';
import { InvoiceDashboardPartnersService } from './services/sub-services/invoice-dashboard-partners.service';
import { InvoiceDashboardExportService } from './services/sub-services/invoice-dashboard-export.service';
import { InvoiceDashboardAnalyticsService } from './services/sub-services/invoice-dashboard-analytics.service';
import { InvoiceDashboardHorizonService } from './services/sub-services/invoice-dashboard-horizon.service';

describe('InvoiceDashboardService (Facade)', () => {
  let facadeService: InvoiceDashboardService;
  let mockStatsService: jest.Mocked<InvoiceDashboardStatsService>;
  let mockPartnersService: jest.Mocked<InvoiceDashboardPartnersService>;
  let mockExportService: jest.Mocked<InvoiceDashboardExportService>;
  let mockAnalyticsService: jest.Mocked<InvoiceDashboardAnalyticsService>;
  let mockHorizonService: jest.Mocked<InvoiceDashboardHorizonService>;

  beforeEach(() => {
    mockStatsService = {
      getDashboardStats: jest.fn(),
      getPartnerStats: jest.fn(),
    } as unknown as jest.Mocked<InvoiceDashboardStatsService>;

    mockPartnersService = {
      getDashboardPartners: jest.fn(),
    } as unknown as jest.Mocked<InvoiceDashboardPartnersService>;

    mockExportService = {
      getDetailedInvoices: jest.fn(),
      exportExcel: jest.fn(),
    } as unknown as jest.Mocked<InvoiceDashboardExportService>;

    mockAnalyticsService = {
      getDebtsAnalytics: jest.fn(),
    } as unknown as jest.Mocked<InvoiceDashboardAnalyticsService>;

    mockHorizonService = {
      getTimeHorizonInvoices: jest.fn(),
    } as unknown as jest.Mocked<InvoiceDashboardHorizonService>;

    facadeService = new InvoiceDashboardService(
      mockStatsService,
      mockPartnersService,
      mockExportService,
      mockAnalyticsService,
      mockHorizonService,
    );
  });

  describe('getDashboardStats', () => {
    it('should delegate to statsService.getDashboardStats with matching arguments', async () => {
      const mockResult = {
        cashTrend: [{ label: '2026-09', cashIn: 100, cashOut: 50 }],
      };
      mockStatsService.getDashboardStats.mockResolvedValue(mockResult as any);

      const result = await facadeService.getDashboardStats(
        '2026-09-01',
        '2026-09-30',
        'branch-uuid',
      );

      expect(mockStatsService.getDashboardStats).toHaveBeenCalledWith(
        '2026-09-01',
        '2026-09-30',
        'branch-uuid',
      );
      expect(result).toBe(mockResult);
    });
  });

  describe('getDashboardPartners', () => {
    it('should delegate to partnersService.getDashboardPartners with matching arguments', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      };
      mockPartnersService.getDashboardPartners.mockResolvedValue(
        mockResult as any,
      );

      const result = await facadeService.getDashboardPartners(
        1,
        20,
        'VinFast',
        '2026-01-01',
        '2026-09-30',
        'branch-1',
        'payableAmount',
        'DESC',
        '{}',
        '{}',
      );

      expect(mockPartnersService.getDashboardPartners).toHaveBeenCalledWith(
        1,
        20,
        'VinFast',
        '2026-01-01',
        '2026-09-30',
        'branch-1',
        'payableAmount',
        'DESC',
        '{}',
        '{}',
      );
      expect(result).toBe(mockResult);
    });
  });

  describe('getPartnerStats', () => {
    it('should delegate to statsService.getPartnerStats with matching arguments', async () => {
      const mockResult = {
        cashTrend: [{ label: '2026-09', cashIn: 50, cashOut: 0 }],
      };
      mockStatsService.getPartnerStats.mockResolvedValue(mockResult as any);

      const result = await facadeService.getPartnerStats(
        '0123456789',
        '2026-01-01',
        '2026-09-30',
      );

      expect(mockStatsService.getPartnerStats).toHaveBeenCalledWith(
        '0123456789',
        '2026-01-01',
        '2026-09-30',
      );
      expect(result).toBe(mockResult);
    });
  });

  describe('getDetailedInvoices', () => {
    it('should delegate to exportService.getDetailedInvoices', async () => {
      const mockResult = [{ invoiceNo: 'HD01' }] as any;
      mockExportService.getDetailedInvoices.mockResolvedValue(mockResult);

      const result = await facadeService.getDetailedInvoices(
        '2026-01-01',
        '2026-09-30',
        'b-1',
      );

      expect(mockExportService.getDetailedInvoices).toHaveBeenCalledWith(
        '2026-01-01',
        '2026-09-30',
        'b-1',
      );
      expect(result).toBe(mockResult);
    });
  });

  describe('exportExcel', () => {
    it('should delegate to exportService.exportExcel', async () => {
      const mockBuffer = Buffer.from('excel-data');
      mockExportService.exportExcel.mockResolvedValue(mockBuffer);

      const result = await facadeService.exportExcel(
        '2026-01-01',
        '2026-09-30',
        'b-1',
      );

      expect(mockExportService.exportExcel).toHaveBeenCalledWith(
        '2026-01-01',
        '2026-09-30',
        'b-1',
      );
      expect(result).toBe(mockBuffer);
    });
  });

  describe('getDebtsAnalytics', () => {
    it('should delegate to analyticsService.getDebtsAnalytics', async () => {
      const mockResult = { summary: {} } as any;
      mockAnalyticsService.getDebtsAnalytics.mockResolvedValue(mockResult);

      const result = await facadeService.getDebtsAnalytics(
        '2026-01-01',
        '2026-09-30',
        'b-1',
      );

      expect(mockAnalyticsService.getDebtsAnalytics).toHaveBeenCalledWith(
        '2026-01-01',
        '2026-09-30',
        'b-1',
      );
      expect(result).toBe(mockResult);
    });
  });

  describe('getTimeHorizonInvoices', () => {
    it('should delegate to horizonService.getTimeHorizonInvoices', async () => {
      const mockResult = { items: [], total: 0 } as any;
      mockHorizonService.getTimeHorizonInvoices.mockResolvedValue(mockResult);

      const query = { page: 1, pageSize: 20, direction: 'IN' as const };
      const result = await facadeService.getTimeHorizonInvoices(
        'nextWeekDue',
        query,
      );

      expect(mockHorizonService.getTimeHorizonInvoices).toHaveBeenCalledWith(
        'nextWeekDue',
        query,
      );
      expect(result).toBe(mockResult);
    });
  });
});
