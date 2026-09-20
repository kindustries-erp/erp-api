import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InvoiceDebtsService } from './invoice-debts.service';
import { ErpInvoice } from '../entities/erp_invoice.entity';
import { InvoicePartnerType } from '../dto/get-invoice-debts.dto';

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
          latestInvoiceDate: '2026-08-01',
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
          latestInvoiceDate: '2026-07-15',
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
      expect(result.summary.grandTotalAmount).toBe(50000000);
      expect(result.summary.grandTotalBalance).toBe(20000000);
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
});
