import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KgaraApiCoreController } from './kgara-api-core.controller';
import { KgaraCaseFinancialController } from './controllers/kgara-case-financial.controller';
import { KgaraCase } from './entities/kgara_case.entity';
import { KgaraCaseLinkedInvoice } from './entities/kgara_case_linked_invoice.entity';
import { KgaraGrossProfit } from './entities/kgara_gross_profit.entity';
import { KgaraCaseSettlement } from './entities/kgara_case_settlement.entity';
import { DocumentTraceabilityService } from '../common/services/document-traceability.service';
import { GarageSmartSettlementService } from './services/garage-smart-settlement.service';
import { KgaraCaseQueryService } from './services/kgara-case-query.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../auth/guards/core-rbac.guard';

describe('KgaraCaseFinancialController (Bidirectional Netoff & Financials)', () => {
  let controller: KgaraCaseFinancialController;
  let rootController: KgaraApiCoreController;
  let caseRepo: any;
  let linkedInvoiceRepo: any;
  let settlementRepo: any;
  let grossProfitRepo: any;
  let caseQueryService: any;

  beforeEach(async () => {
    const mockRepo = () => ({
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn().mockImplementation((e) => e),
      save: jest
        .fn()
        .mockImplementation((e) => Promise.resolve({ id: 'saved-id', ...e })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      query: jest.fn(),
      manager: {
        query: jest.fn(),
      },
    });

    caseRepo = mockRepo();
    linkedInvoiceRepo = mockRepo();
    settlementRepo = mockRepo();
    grossProfitRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KgaraCaseFinancialController, KgaraApiCoreController],
      providers: [
        { provide: getRepositoryToken(KgaraCase), useValue: caseRepo },
        {
          provide: getRepositoryToken(KgaraCaseLinkedInvoice),
          useValue: linkedInvoiceRepo,
        },
        {
          provide: getRepositoryToken(KgaraGrossProfit),
          useValue: grossProfitRepo,
        },
        {
          provide: getRepositoryToken(KgaraCaseSettlement),
          useValue: settlementRepo,
        },
        { provide: DocumentTraceabilityService, useValue: {} },
        {
          provide: GarageSmartSettlementService,
          useValue: { getSuggestionsForCase: jest.fn() },
        },
        {
          provide: KgaraCaseQueryService,
          useValue: {
            recalculateCaseSettlementSummary: jest
              .fn()
              .mockResolvedValue(undefined),
            exportCompletedCasesExcel: jest.fn(),
            findCaseServices: jest.fn(),
            getCaseServiceColumnOptions: jest.fn(),
            exportCaseServicesExcel: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CoreRbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<KgaraCaseFinancialController>(
      KgaraCaseFinancialController,
    );
    rootController = module.get<KgaraApiCoreController>(KgaraApiCoreController);
    caseQueryService = module.get<KgaraCaseQueryService>(KgaraCaseQueryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(rootController).toBeDefined();
  });

  describe('getLinkedInvoices', () => {
    it('should query linked invoices with totalAmount and direction', async () => {
      linkedInvoiceRepo.query.mockResolvedValue([
        {
          id: 'link-1',
          invoiceId: 'inv-1',
          invoiceNo: '1646',
          direction: 'IN',
          totalAmount: '6300000',
          sellerName: 'HAPS',
        },
      ]);

      const res = await controller.getLinkedInvoices('case-1');
      expect(res).toHaveLength(1);
      expect(res[0].totalAmount).toBe('6300000');
      expect(linkedInvoiceRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('i.total_amount as "totalAmount"'),
        ['case-1'],
      );
    });
  });

  describe('getCaseFinancialSummary', () => {
    it('should compute financial summary based strictly on cashflow settlements', async () => {
      caseRepo.findOne.mockResolvedValue({
        id: 'case-1',
        soChungTu: 'GR-001',
        tinhTrangDichVu: 3,
        tienCoThue: 10000000,
        chiPhi: 6300000,
      });
      grossProfitRepo.findOne.mockResolvedValue(null);

      settlementRepo.find.mockResolvedValue([
        {
          id: 'set-1',
          settlementType: 'PAYMENT',
          sourceChannel: 'ON_SYSTEM',
          amount: '1279293',
        },
      ]);

      const res = await controller.getCaseFinancialSummary('case-1');
      expect(res.breakdown.payments.directPaymentOnSystem).toBe(1279293);
      expect(res.breakdown.payments.totalPaid).toBe(1279293);
      expect(res.breakdown.payments.remainingPayable).toBe(6300000 - 1279293);
    });
  });

  describe('addCaseSettlement', () => {
    it('should create decoupled settlement and recalculate case summary without touching invoice netoff', async () => {
      const res = await controller.addCaseSettlement('case-1', {
        bankTransactionId: 'txn-1',
        settlementType: 'PAYMENT',
        sourceChannel: 'ON_SYSTEM',
        amount: 6300000,
      });

      expect(res.id).toBe('saved-id');
      expect(settlementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-1',
          bankTransactionId: 'txn-1',
          settlementType: 'PAYMENT',
          sourceChannel: 'ON_SYSTEM',
          amount: 6300000,
        }),
      );
      expect(settlementRepo.save).toHaveBeenCalled();
      expect(
        caseQueryService.recalculateCaseSettlementSummary,
      ).toHaveBeenCalledWith('case-1');
      expect(settlementRepo.manager.query).not.toHaveBeenCalled();
    });
  });

  describe('removeCaseSettlement', () => {
    it('should remove settlement and recalculate case summary without touching invoice netoff', async () => {
      const res = await controller.removeCaseSettlement('case-1', 'set-1');
      expect(res.success).toBe(true);
      expect(settlementRepo.delete).toHaveBeenCalledWith({
        id: 'set-1',
        caseId: 'case-1',
      });
      expect(
        caseQueryService.recalculateCaseSettlementSummary,
      ).toHaveBeenCalledWith('case-1');
      expect(settlementRepo.manager.query).not.toHaveBeenCalled();
    });

    it('should safely ignore temporary settlement IDs without querying DB', async () => {
      const res = await controller.removeCaseSettlement(
        'case-1',
        'tmp-msyvp0zr-1c3at9',
      );
      expect(res.success).toBe(true);
      expect(res.message).toBe('Ignored non-persisted temporary ID');
      expect(settlementRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('updateCaseSettlement', () => {
    it('should reject editing ON_SYSTEM settlement with BadRequestException', async () => {
      settlementRepo.findOne.mockResolvedValue({
        id: 'set-1',
        caseId: 'case-1',
        sourceChannel: 'ON_SYSTEM',
        amount: 5000000,
      });

      await expect(
        controller.updateCaseSettlement('case-1', 'set-1', {
          amount: 6000000,
        }),
      ).rejects.toThrow('Sao kê ngân hàng chỉ có thể thêm hoặc xóa');
    });

    it('should update OFF_SYSTEM_MANUAL settlement fields successfully', async () => {
      const existing = {
        id: 'set-manual-1',
        caseId: 'case-1',
        sourceChannel: 'OFF_SYSTEM_MANUAL',
        amount: 5000000,
        category: 'Tiền mặt',
        note: 'Ghi chú cũ',
      };
      settlementRepo.findOne.mockResolvedValue(existing);
      settlementRepo.save.mockImplementation(async (item: any) => item);

      const res = (await controller.updateCaseSettlement(
        'case-1',
        'set-manual-1',
        {
          amount: 5500000,
          note: 'Ghi chú mới',
        },
      )) as any;

      expect(res.amount).toBe(5500000);
      expect(res.note).toBe('Ghi chú mới');
      expect(settlementRepo.save).toHaveBeenCalled();
    });
  });
});
