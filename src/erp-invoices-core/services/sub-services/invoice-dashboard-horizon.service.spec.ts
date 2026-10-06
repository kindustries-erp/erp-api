import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InvoiceDashboardHorizonService } from './invoice-dashboard-horizon.service';

describe('InvoiceDashboardHorizonService', () => {
  let service: InvoiceDashboardHorizonService;
  let mockInvoiceRepo: any;

  beforeEach(() => {
    mockInvoiceRepo = {
      query: jest.fn(),
    };

    service = new InvoiceDashboardHorizonService(mockInvoiceRepo);
  });

  describe('getTimeHorizonInvoices', () => {
    it('should query horizon summary and paginated items accurately', async () => {
      // 1. summaryRows
      const mockSummary = [
        {
          receivableAmount: '50000000',
          payableAmount: '20000000',
          receivableTotalAmount: '80000000',
          payableTotalAmount: '30000000',
          receivedAmount: '30000000',
          paidAmount: '10000000',
          receivableExpectedAmount: '45000000',
          payableExpectedAmount: '19000000',
          receivableRiskAmount: '5000000',
          payableRiskAmount: '1000000',
          receivableCount: '5',
          payableCount: '2',
        },
      ];

      // 2. topReceivableSql
      const mockTopRec = [
        {
          taxCode: '0101',
          partnerName: 'Công ty C',
          balanceAmount: '20000000',
          contributingAmount: '20000000',
          invoiceCount: '2',
          avgLagDays: '15',
        },
      ];

      // 3. topPayableSql
      const mockTopPay = [
        {
          taxCode: '0202',
          partnerName: 'Công ty D',
          balanceAmount: '10000000',
          contributingAmount: '10000000',
          invoiceCount: '1',
          avgLagDays: '20',
        },
      ];

      // 4. monthlyTrendSql
      const mockMonthly = [
        {
          month: '2026-09',
          outTotal: '80000000',
          outPaid: '30000000',
          outBalance: '50000000',
          inTotal: '30000000',
          inPaid: '10000000',
          inBalance: '20000000',
          invoiceCount: '7',
        },
      ];

      // 5. agingBreakdownSql
      const mockAging = [
        {
          outAging0_30: '50000000',
          outAging31_60: '0',
          outAging61_90: '0',
          outAgingOver90: '0',
          inAging0_30: '20000000',
          inAging31_60: '0',
          inAging61_90: '0',
          inAgingOver90: '0',
        },
      ];

      // 6. ticketSizeSql
      const mockTicket = [
        {
          outUnder10mAmount: '10000000',
          outUnder10mCount: '1',
          out10mTo50mAmount: '40000000',
          out10mTo50mCount: '4',
        },
      ];

      // 7. branchBreakdownSql
      const mockBranch = [
        {
          branchId: 'UNASSIGNED',
          branchName: 'Chưa phân chi nhánh',
          outAmount: '50000000',
          outCount: '5',
          inAmount: '20000000',
          inCount: '2',
        },
      ];

      // 8. countSql
      const mockCount = [{ count: '1' }];

      // 9. dataSql
      const mockData = [
        {
          id: 'inv-uuid-1',
          invoiceNo: 'HD0001',
          serialNo: '1C26TAA',
          invoiceDate: '2026-09-15',
          direction: 'OUT',
          sellerName: 'Greenway VN',
          sellerTaxCode: '0316666666',
          buyerName: 'Khách hàng C',
          buyerTaxCode: '0101',
          partnerName: 'Khách hàng C',
          taxCode: '0101',
          preVatAmount: '18181818',
          vatAmount: '1818182',
          totalAmount: '20000000',
          paidAmount: '0',
          balanceAmount: '20000000',
          agingDays: '9',
          partnerAvgLagDays: '15',
          estimatedSettlementDate: '2026-09-30',
          recoveryProbability: '85',
          riskProbability: '15',
          expectedAmount: '17000000',
          riskAmount: '3000000',
          status: 'ISSUED',
        },
      ];

      mockInvoiceRepo.query
        .mockResolvedValueOnce(mockSummary)
        .mockResolvedValueOnce(mockTopRec)
        .mockResolvedValueOnce(mockTopPay)
        .mockResolvedValueOnce(mockMonthly)
        .mockResolvedValueOnce(mockAging)
        .mockResolvedValueOnce(mockTicket)
        .mockResolvedValueOnce(mockBranch)
        .mockResolvedValueOnce(mockCount)
        .mockResolvedValueOnce(mockData);

      const result = await service.getTimeHorizonInvoices('nextMonthDue', {
        page: 1,
        pageSize: 20,
        direction: 'OUT',
      });

      expect(result.summary.horizon).toBe('nextMonthDue');
      expect(result.summary.receivableAmount).toBe(50000000);
      expect(result.summary.payableAmount).toBe(20000000);
      expect(result.summary.netAmount).toBe(30000000);
      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].invoiceNo).toBe('HD0001');
      expect(result.items[0].expectedAmount).toBe(17000000);
    });

    it('should support exact search and multi-search semicolon keyword clauses', async () => {
      // 1. summary, 2. topRec, 3. topPay, 4. monthly, 5. daily, 6. aging, 7. ticket, 8. branch, 9. count, 10. data
      mockInvoiceRepo.query
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([]);

      await service.getTimeHorizonInvoices('forecastNext7Days', {
        columnSearch: JSON.stringify({
          invoiceNo: '"HD001"; "HD002"',
          partnerName: 'Công ty A; Công ty B',
        }),
      });

      const countCall = mockInvoiceRepo.query.mock.calls[8][0] as string;
      expect(countCall).toContain("ILIKE 'HD001'");
      expect(countCall).toContain("ILIKE 'HD002'");
      expect(countCall).toContain("ILIKE '%Công ty A%'");
    });
  });
});
