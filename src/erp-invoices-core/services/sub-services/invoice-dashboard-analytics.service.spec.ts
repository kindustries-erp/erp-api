import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InvoiceDashboardAnalyticsService } from './invoice-dashboard-analytics.service';
import { InvoiceDashboardStatsService } from './invoice-dashboard-stats.service';

describe('InvoiceDashboardAnalyticsService', () => {
  let service: InvoiceDashboardAnalyticsService;
  let mockInvoiceRepo: any;
  let mockStatsService: any;

  beforeEach(() => {
    mockInvoiceRepo = {
      query: jest.fn<any>(),
    };

    mockStatsService = {
      getDashboardStats: jest.fn<any>().mockResolvedValue({
        cashTrend: [
          {
            label: '2026-09',
            cashIn: 10000000,
            cashOut: 5000000,
            vatIn: 500000,
            vatOut: 1000000,
          },
        ],
      }),
    };

    service = new InvoiceDashboardAnalyticsService(
      mockInvoiceRepo,
      mockStatsService as unknown as InvoiceDashboardStatsService,
    );
  });

  describe('getDebtsAnalytics', () => {
    it('should aggregate aging brackets, calculate IFRS 9 expected cashflow & provisions', async () => {
      // 1. summaryRows (OUT and IN)
      const mockSummaryRows = [
        {
          direction: 'OUT',
          totalAmount: '100000000',
          paidAmount: '40000000',
          remainingAmount: '60000000',
          aging0To30: '30000000',
          aging31To60: '15000000',
          aging61To90: '10000000',
          agingOver90: '5000000',
          dueNextWeek: '10000000',
        },
        {
          direction: 'IN',
          totalAmount: '50000000',
          paidAmount: '30000000',
          remainingAmount: '20000000',
          aging0To30: '10000000',
          aging31To60: '5000000',
          aging61To90: '3000000',
          agingOver90: '2000000',
          dueNextWeek: '5000000',
        },
      ];

      // 2. topReceivableCustomers
      const mockTopCustomers = [
        {
          taxCode: '010101',
          partnerName: 'Khách hàng VIP',
          totalAmount: '50000000',
          balanceAmount: '30000000',
          overdueAmount: '10000000',
          maxAgingDays: '45',
        },
      ];

      // 3. topPayableSuppliers
      const mockTopSuppliers = [
        {
          taxCode: '020202',
          partnerName: 'Nhà cung cấp NVL',
          totalAmount: '30000000',
          balanceAmount: '15000000',
          overdueAmount: '5000000',
          maxAgingDays: '40',
        },
      ];

      // 4. forecastLagRows
      const mockForecastLagRows = [
        {
          direction: 'OUT',
          forecastNext7Days: '20000000',
          forecastNext30Days: '45000000',
        },
        {
          direction: 'IN',
          forecastNext7Days: '10000000',
          forecastNext30Days: '15000000',
        },
      ];

      mockInvoiceRepo.query
        .mockResolvedValueOnce(mockSummaryRows)
        .mockResolvedValueOnce(mockTopCustomers)
        .mockResolvedValueOnce(mockTopSuppliers)
        .mockResolvedValueOnce(mockForecastLagRows);

      const result = await service.getDebtsAnalytics(
        '2026-01-01',
        '2026-09-30',
        'b-1',
      );

      expect(mockInvoiceRepo.query).toHaveBeenCalledTimes(4);
      expect(result.summary.totalReceivable).toBe(100000000);
      expect(result.summary.remainingReceivable).toBe(60000000);
      expect(result.summary.totalPayable).toBe(50000000);
      expect(result.summary.remainingPayable).toBe(20000000);
      expect(result.summary.netBalance).toBe(40000000);
      expect(result.summary.collectionRate).toBe(40);
      expect(result.summary.paymentRate).toBe(60);

      // Verify Aging Comparison
      expect(result.agingComparison).toHaveLength(4);
      expect(result.agingComparison[0]).toEqual({
        bracket: '0_30',
        label: '0-30 ngày',
        receivableAmount: 30000000,
        payableAmount: 10000000,
        netAmount: 20000000,
      });

      // Verify Time Horizons
      expect(result.timeHorizons.nextWeekDue).toEqual({
        receivable: 10000000,
        payable: 5000000,
        net: 5000000,
      });

      // Verify Forecast Horizons
      expect(result.forecastHorizons.next7Days).toEqual({
        receivable: 20000000,
        payable: 10000000,
        net: 10000000,
      });
      expect(result.forecastHorizons.next30Days).toEqual({
        receivable: 45000000,
        payable: 15000000,
        net: 30000000,
      });

      // Verify IFRS 9 ECL math:
      // expRec = 30M*0.85 + 15M*0.6 + 10M*0.3 + 5M*0.1 = 25.5M + 9M + 3M + 0.5M = 38M
      expect(result.forecastHorizons.expectedCashflow.receivable).toBe(
        38000000,
      );
      // riskRec = 30M*0.15 + 15M*0.4 + 10M*0.7 + 5M*0.9 = 4.5M + 6M + 7M + 4.5M = 22M
      expect(result.forecastHorizons.defaultRiskProvision.receivableRisk).toBe(
        22000000,
      );
    });
  });
});
